import type { NostrEvent } from "nostr-tools";
import { publishEvent, queryEvents } from "./relays";
import type { AppSigner } from "./signer";

export type DirectMessage = {
  id: string;
  /** Sender pubkey. */
  from: string;
  /** Recipient pubkey (the `p` tag). */
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

function firstTag(event: NostrEvent, name: string) {
  return event.tags.find((tag) => tag[0] === name)?.[1] ?? "";
}

/**
 * Load NIP-04 direct messages both sent and received by `pubkey`, decrypted
 * with the active signer. Messages that fail to decrypt are skipped.
 */
export async function fetchDirectMessages(
  signer: AppSigner,
  pubkey: string,
): Promise<DirectMessage[]> {
  if (!signer.nip04Decrypt) {
    throw new Error("Your signer doesn't support encrypted messages.");
  }

  const [incoming, outgoing] = await Promise.all([
    queryEvents({ kinds: [4], "#p": [pubkey], limit: 200 }, { timeout: 6500 }),
    queryEvents({ kinds: [4], authors: [pubkey], limit: 200 }, { timeout: 6500 }),
  ]);

  const seen = new Set<string>();
  const events: NostrEvent[] = [];
  for (const event of [...incoming, ...outgoing]) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    events.push(event);
  }

  const messages: DirectMessage[] = [];
  for (const event of events) {
    const mine = event.pubkey === pubkey;
    const counterparty = mine ? firstTag(event, "p") : event.pubkey;
    if (!counterparty) continue;
    try {
      const content = await signer.nip04Decrypt(counterparty, event.content);
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

  return messages.sort((a, b) => a.createdAt - b.createdAt);
}

export function groupThreads(messages: DirectMessage[]): DirectThread[] {
  const threads = new Map<string, DirectMessage[]>();
  for (const message of messages) {
    const counterparty = message.mine ? message.to : message.from;
    const list = threads.get(counterparty) ?? [];
    list.push(message);
    threads.set(counterparty, list);
  }
  return [...threads.entries()]
    .map(([counterparty, list]) => ({
      counterparty,
      messages: list,
      last: list[list.length - 1],
    }))
    .sort((a, b) => b.last.createdAt - a.last.createdAt);
}

export async function sendDirectMessage(
  signer: AppSigner,
  recipient: string,
  text: string,
): Promise<NostrEvent> {
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
