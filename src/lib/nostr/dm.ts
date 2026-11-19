import {
  finalizeEvent,
  generateSecretKey,
  getEventHash,
  nip44,
  verifyEvent,
  type NostrEvent,
} from "nostr-tools";
import { publishEvent, queryEvents } from "./relays";
import type { AppSigner } from "./signer";

export type DirectMessage = {
  id: string;
  /** Sender pubkey. */
  from: string;
  /** Recipient pubkey (or counterparty for 1:1 threads). */
  to: string;
  content: string;
  createdAt: number;
  mine: boolean;
  event: NostrEvent;
};

export type DirectThread = {
  counterparty: string;
  messages: DirectMessage[];
  last: DirectMessage;
};

function firstTag(event: { tags?: string[][] }, name: string) {
  return event.tags?.find((tag) => tag[0] === name)?.[1] ?? "";
}

function pTags(event: { tags?: string[][] }): string[] {
  return (event.tags ?? [])
    .filter((tag) => tag[0] === "p" && tag[1])
    .map((tag) => tag[1]);
}

function randomCreatedAt() {
  const twoDays = 2 * 24 * 60 * 60;
  return Math.floor(Date.now() / 1000) - Math.floor(Math.random() * twoDays);
}

type Rumor = {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  [key: string]: unknown;
};

async function unwrapNip17(
  wrap: NostrEvent,
  signer: AppSigner,
): Promise<{ rumor: Rumor } | null> {
  if (wrap.kind !== 1059 || !signer.nip44Decrypt) return null;
  try {
    const seal = JSON.parse(await signer.nip44Decrypt(wrap.pubkey, wrap.content)) as NostrEvent;
    if (!seal || seal.kind !== 13) return null;
    if (!verifyEvent(seal)) return null;
    const rumor = JSON.parse(await signer.nip44Decrypt(seal.pubkey, seal.content)) as Rumor;
    if (!rumor || rumor.pubkey !== seal.pubkey) return null;
    if (!rumor.id) {
      try {
        rumor.id = getEventHash(rumor as unknown as NostrEvent);
      } catch {
        // keep undefined; caller will fall back
      }
    }
    return { rumor };
  } catch {
    return null;
  }
}

function wrapSeal(seal: NostrEvent, recipient: string): NostrEvent {
  const sk = generateSecretKey();
  const content = nip44.encrypt(
    JSON.stringify(seal),
    nip44.getConversationKey(sk, recipient),
  );
  return finalizeEvent(
    {
      kind: 1059,
      created_at: randomCreatedAt(),
      content,
      tags: [["p", recipient]],
    },
    sk,
  );
}

async function sendNip17(
  signer: AppSigner,
  myPubkey: string,
  recipient: string,
  text: string,
): Promise<NostrEvent> {
  if (!signer.nip44Encrypt) {
    throw new Error("Your signer doesn't support NIP-44 encrypted messages.");
  }
  const created_at = Math.floor(Date.now() / 1000);
  const rumorBase = {
    kind: 14,
    created_at,
    content: text,
    tags: [["p", recipient]],
  };
  const rumor: Rumor = {
    ...rumorBase,
    pubkey: myPubkey,
    id: getEventHash({ ...rumorBase, pubkey: myPubkey } as unknown as NostrEvent),
  };

  const targets = Array.from(new Set([myPubkey, recipient]));
  const wraps = await Promise.all(
    targets.map(async (target) => {
      const seal = await signer.signEvent({
        kind: 13,
        created_at: randomCreatedAt(),
        content: await signer.nip44Encrypt!(target, JSON.stringify(rumor)),
        tags: [],
      });
      return wrapSeal(seal, target);
    }),
  );

  const results = await Promise.allSettled(wraps.map((wrap) => publishEvent(wrap)));
  const delivered = results.some((result) => result.status === "fulfilled");
  if (!delivered) {
    throw new Error("Couldn't deliver the message to any relay.");
  }
  return wraps.find((wrap) => firstTag(wrap, "p") === recipient) ?? wraps[wraps.length - 1];
}

/**
 * Load direct messages for `pubkey`, including modern NIP-17 (gift-wrapped,
 * kind 14/1059) and legacy NIP-04 (kind 4) messages, decrypted with the active
 * signer. Messages that can't be decrypted are skipped.
 */
export async function fetchDirectMessages(
  signer: AppSigner,
  pubkey: string,
): Promise<DirectMessage[]> {
  const canNip17 = typeof signer.nip44Decrypt === "function";
  const canNip04 = typeof signer.nip04Decrypt === "function";
  if (!canNip17 && !canNip04) {
    throw new Error("Your signer doesn't support encrypted messages.");
  }

  const messages: DirectMessage[] = [];
  const seen = new Set<string>();

  if (canNip17) {
    try {
      const wraps = await queryEvents({ kinds: [1059], "#p": [pubkey], limit: 400 }, { timeout: 7000 });
      for (const wrap of wraps) {
        if (seen.has(wrap.id)) continue;
        const unwrapped = await unwrapNip17(wrap, signer);
        if (!unwrapped) continue;
        const rumor = unwrapped.rumor;
        if (rumor.kind !== 14) continue;
        const mine = rumor.pubkey === pubkey;
        const participants = pTags(rumor);
        const counterparty = mine
          ? participants.find((p) => p !== pubkey) ?? participants[0] ?? ""
          : rumor.pubkey;
        if (!counterparty) continue;
        const id = rumor.id || wrap.id;
        if (seen.has(id)) continue;
        seen.add(id);
        seen.add(wrap.id);
        messages.push({
          id,
          from: rumor.pubkey,
          to: mine ? counterparty : pubkey,
          content: typeof rumor.content === "string" ? rumor.content : "",
          createdAt: rumor.created_at,
          mine,
          event: wrap,
        });
      }
    } catch {
      // ignore NIP-17 fetch/decrypt failures and fall through to NIP-04
    }
  }

  if (canNip04) {
    try {
      const [incoming, outgoing] = await Promise.all([
        queryEvents({ kinds: [4], "#p": [pubkey], limit: 200 }, { timeout: 6500 }),
        queryEvents({ kinds: [4], authors: [pubkey], limit: 200 }, { timeout: 6500 }),
      ]);

      const events: NostrEvent[] = [];
      for (const event of [...incoming, ...outgoing]) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        events.push(event);
      }

      for (const event of events) {
        const mine = event.pubkey === pubkey;
        const counterparty = mine ? firstTag(event, "p") : event.pubkey;
        if (!counterparty) continue;
        try {
          const content = await signer.nip04Decrypt!(counterparty, event.content);
          messages.push({
            id: event.id,
            from: event.pubkey,
            to: mine ? counterparty : pubkey,
            content,
            createdAt: event.created_at,
            mine,
            event,
          });
        } catch {
          // Not decryptable with this key (or malformed) — skip it.
        }
      }
    } catch {
      // ignore NIP-04 fetch failures
    }
  }

  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

export function groupThreads(messages: DirectMessage[]): DirectThread[] {
  const threads = new Map<string, DirectMessage[]>();
  for (const message of messages) {
    const counterparty = message.mine ? message.to : message.from;
    if (!counterparty) continue;
    const list = threads.get(counterparty) ?? [];
    list.push(message);
    threads.set(counterparty, list);
  }
  return [...threads.entries()]
    .map(([counterparty, list]) => {
      list.sort((a, b) => a.createdAt - b.createdAt);
      return {
        counterparty,
        messages: list,
        last: list[list.length - 1],
      };
    })
    .sort((a, b) => b.last.createdAt - a.last.createdAt);
}

export async function sendDirectMessage(
  signer: AppSigner,
  recipient: string,
  text: string,
): Promise<NostrEvent> {
  const myPubkey = await signer.getPublicKey();
  if (signer.nip44Encrypt) {
    try {
      return await sendNip17(signer, myPubkey, recipient, text);
    } catch (error) {
      if (!signer.nip04Encrypt) throw error;
      // fall back to legacy NIP-04 if NIP-17 delivery fails
    }
  }

  if (!signer.nip04Encrypt) {
    throw new Error("Your signer doesn't support encrypted messages.");
  }
  const ciphertext = await signer.nip04Encrypt(recipient, text);
  const event = await signer.signEvent({
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    content: ciphertext,
    tags: [["p", recipient]],
  });
  await publishEvent(event);
  return event;
}
