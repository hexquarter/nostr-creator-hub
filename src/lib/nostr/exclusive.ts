import { type Filter, type NostrEvent } from "nostr-tools";
import { getSatoshisAmountFromBolt11 } from "nostr-tools/nip57";
import { base64ToBytes, bytesToBase64, bytesToUtf8, hexToBytes, utf8ToBytes } from "../crypto";
import { publishEvent, queryEvents } from "./relays";
import type { AppSigner } from "./signer";
import { fetchKeyFromKeybox, keyboxUrl, listKeyboxPosts, uploadPostKey } from "./keybox";
import {
  BADGE_ANNOUNCE_KIND,
  badgeAnnouncementDTag,
  getCreatorBadge,
  getPostUnlocks,
  postUnlockAnnouncementDTag,
} from "./badges";
import { lightningAddressUrl } from "./zaps";

/**
 * Members-only posts are encrypted end to end: the relay only ever stores
 * ciphertext, and the decryption key travels in NIP-44-encrypted app-data
 * events addressed to the pubkeys that are allowed to read.
 *
 *   - publishing: the text is sealed with a random per-post key (AES-GCM) and
 *     the post carries `["encrypted", "crays1"]` instead of plaintext.
 *   - key delivery (kind 30078, replaceable): one event per recipient, d-tag
 *     `crays:key:<postId>:<recipient>`, NIP-44-encrypted to that recipient.
 *     A self-addressed copy lets the author (and their other devices) recover
 *     the key from relays.
 *   - key requests (kind 30078): a reader who paid after publication asks the
 *     creator with d-tag `crays:keyreq:<postId>`. The creator's client —
 *     running while they are signed in — verifies the payment and answers
 *     with a key delivery.
 *
 * The creator's client is the key server, so a reader unlocks as soon as the
 * creator is online (their key server runs whenever they use Crays). Payment
 * is proven with the BOLT-11 invoice the buyer settled, checked against the
 * creator's own LUD-21 verify endpoint; without it the client falls back to
 * the signed purchase receipts it already knows about.
 */
export const EXCLUSIVE_SCHEME = "crays1";
const KEY_TAG = "crays-key";
const KEYREQ_TAG = "crays-keyreq";
const KEY_BYTES = 32;
const REQUEST_POLL_MS = 4000;
const REQUEST_POLL_ATTEMPTS = 10;

export function isEncryptedPost(event: NostrEvent): boolean {
  return event.tags.some((tag) => tag[0] === "encrypted" && tag[1] === EXCLUSIVE_SCHEME);
}

// ---------- Content encryption ----------

export function generateContentKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(KEY_BYTES)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function aesKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    hexToBytes(keyHex) as unknown as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

/** Seal the post text: `<iv b64>.<ciphertext b64>` is what the relay stores. */
export async function encryptContent(plaintext: string, keyHex: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    await aesKey(keyHex),
    utf8ToBytes(plaintext) as unknown as BufferSource,
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ct))}`;
}

export async function decryptContent(envelope: string, keyHex: string): Promise<string> {
  const [iv, ct] = envelope.split(".");
  if (!iv || !ct) throw new Error("Malformed encrypted content.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) as unknown as BufferSource },
    await aesKey(keyHex),
    base64ToBytes(ct) as unknown as BufferSource,
  );
  return bytesToUtf8(new Uint8Array(plain));
}

// ---------- Local key cache (per account, like purchases) ----------

const KEYS_PREFIX = "crays.post-keys.v1";
let keyOwner: string | null = null;
let keyCache: Map<string, string> | null = null;

function keysStorageKey(pubkey: string) {
  return `${KEYS_PREFIX}.${pubkey}`;
}

function loadKeys(pubkey: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const raw = window.localStorage.getItem(keysStorageKey(pubkey));
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [postId, key] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof key === "string" && key.length === KEY_BYTES * 2) map.set(postId, key);
        }
      }
    }
  } catch {
    // fresh cache
  }
  return map;
}

export function setKeyOwner(pubkey: string | null) {
  if (keyOwner === pubkey) return;
  keyOwner = pubkey;
  keyCache = pubkey ? loadKeys(pubkey) : null;
}

function persistKeys() {
  if (!keyOwner || !keyCache) return;
  try {
    window.localStorage.setItem(
      keysStorageKey(keyOwner),
      JSON.stringify(Object.fromEntries(keyCache)),
    );
  } catch {
    // ignore quota errors
  }
}

export function getCachedKey(postId: string): string | null {
  if (!keyCache) keyCache = keyOwner ? loadKeys(keyOwner) : new Map();
  return keyCache.get(postId) ?? null;
}

/** Every cached key this account owns, as `[postId, key]` pairs. */
export function getOwnedKeys(): Array<[string, string]> {
  if (!keyCache) keyCache = keyOwner ? loadKeys(keyOwner) : new Map();
  return [...keyCache.entries()];
}

function saveCachedKey(postId: string, key: string) {
  if (!keyCache) keyCache = keyOwner ? loadKeys(keyOwner) : new Map();
  if (keyCache.get(postId) === key) return;
  keyCache.set(postId, key);
  persistKeys();
}

// ---------- Event helpers ----------

function tagValue(event: NostrEvent, name: string) {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}

function deliveryDTag(postId: string, recipient: string) {
  return `crays:key:${postId}:${recipient}`;
}

function requestDTag(postId: string) {
  return `crays:keyreq:${postId}`;
}

type KeyPayload = { v: number; post: string; key: string };

async function publishEncryptedAppData(input: {
  signer: AppSigner;
  dTag: string;
  recipient: string;
  tag: string;
  plaintext: string;
}): Promise<NostrEvent> {
  if (!input.signer.nip44Encrypt) {
    throw new Error("Your signer doesn't support NIP-44 encryption, so keys can't be delivered.");
  }
  const content = await input.signer.nip44Encrypt(input.recipient, input.plaintext);
  const event = await input.signer.signEvent({
    kind: BADGE_ANNOUNCE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["d", input.dTag],
      ["p", input.recipient],
      ["t", input.tag],
    ],
    content,
  });
  await publishEvent(event);
  return event;
}

async function decryptAppData(
  signer: AppSigner,
  sender: string,
  content: string,
): Promise<KeyPayload | null> {
  if (!signer.nip44Decrypt) return null;
  try {
    const parsed = JSON.parse(await signer.nip44Decrypt(sender, content)) as Partial<KeyPayload>;
    if (
      typeof parsed.post !== "string" ||
      typeof parsed.key !== "string" ||
      parsed.key.length !== KEY_BYTES * 2
    ) {
      return null;
    }
    return { v: 1, post: parsed.post, key: parsed.key };
  } catch {
    return null;
  }
}

// ---------- Publishing: seal a new post ----------

/** Members with an active badge at publish time, straight from their receipts. */
export async function fetchMemberPubkeys(creator: string, timeout = 6000): Promise<string[]> {
  if (typeof window === "undefined") return [];
  const events = await queryEvents(
    {
      kinds: [BADGE_ANNOUNCE_KIND],
      "#d": [badgeAnnouncementDTag(creator)],
      limit: 500,
    },
    { timeout, fresh: true },
  );
  const now = Math.floor(Date.now() / 1000);
  const members = new Set<string>();
  for (const event of events) {
    const expires = Number(tagValue(event, "expires"));
    if (!Number.isFinite(expires) || expires <= now) continue;
    members.add(event.pubkey);
  }
  return [...members];
}

/**
 * Give the new post's key to the author (so any device can read it back) and
 * to everyone with an active membership right now. Best effort per recipient:
 * the post is already sealed, and a relay hiccup must not lose the publish.
 *
 * When a keybox is configured, the key is also deposited there so purchases
 * made while the creator is offline can still unlock the post.
 */
export async function deliverNewPostKeys(input: {
  signer: AppSigner;
  creator: string;
  postId: string;
  key: string;
  /** The creator's Lightning address, for the keybox deposit. */
  address?: string;
  /** Prices the keybox checks paid invoices against (sats). */
  badgeSats?: number;
  unlockSats?: number;
}): Promise<{ delivered: number; failed: number; deposited: boolean }> {
  saveCachedKey(input.postId, input.key);
  const recipients = new Set<string>([input.creator]);
  try {
    (await fetchMemberPubkeys(input.creator)).forEach((pubkey) => recipients.add(pubkey));
  } catch {
    // Members unknown right now; they can still request the key.
  }
  let delivered = 0;
  let failed = 0;
  await Promise.allSettled(
    [...recipients].map(async (recipient) => {
      try {
        await publishEncryptedAppData({
          signer: input.signer,
          dTag: deliveryDTag(input.postId, recipient),
          recipient,
          tag: KEY_TAG,
          plaintext: JSON.stringify({ v: 1, post: input.postId, key: input.key }),
        });
        delivered += 1;
      } catch {
        failed += 1;
      }
    }),
  );
  // Deposit the key with the keybox so readers who pay later — while the
  // creator is offline — can still redeem their invoice for it.
  let deposited = false;
  if (input.address) {
    deposited = await uploadPostKey({
      signer: input.signer,
      address: input.address,
      badgeSats: input.badgeSats ?? 0,
      unlockSats: input.unlockSats ?? 0,
      postId: input.postId,
      key: input.key,
    });
  }
  return { delivered, failed, deposited };
}

// ---------- Reading: obtain a key ----------

/** Self-addressed deliveries let the author recover keys on a new device. */
export async function restoreOwnKeys(signer: AppSigner, pubkey: string): Promise<number> {
  let events: NostrEvent[] = [];
  try {
    events = await queryEvents(
      {
        kinds: [BADGE_ANNOUNCE_KIND],
        authors: [pubkey],
        "#t": [KEY_TAG],
        "#p": [pubkey],
        limit: 500,
      },
      { timeout: 6000, fresh: true },
    );
  } catch {
    return 0;
  }
  let restored = 0;
  for (const event of events) {
    if (getCachedKey(tagValue(event, "d")?.split(":")?.[2] ?? "")) continue;
    const payload = await decryptAppData(signer, event.pubkey, event.content);
    if (!payload) continue;
    saveCachedKey(payload.post, payload.key);
    restored += 1;
  }
  return restored;
}

/** Look for a delivery addressed to `myPubkey` (exact d-tag) and decrypt it. */
export async function fetchPostKeyFromRelay(input: {
  signer: AppSigner;
  creator: string;
  postId: string;
  myPubkey: string;
}): Promise<string | null> {
  const events = await queryEvents(
    {
      kinds: [BADGE_ANNOUNCE_KIND],
      authors: [input.creator],
      "#d": [deliveryDTag(input.postId, input.myPubkey)],
      limit: 1,
    },
    { timeout: 5000, fresh: true },
  );
  const newest = [...events].sort((a, b) => b.created_at - a.created_at)[0];
  if (!newest) return null;
  const payload = await decryptAppData(input.signer, newest.pubkey, newest.content);
  if (!payload || payload.post !== input.postId) return null;
  saveCachedKey(input.postId, payload.key);
  return payload.key;
}

export async function publishKeyRequest(input: {
  signer: AppSigner;
  creator: string;
  postId: string;
  invoice?: string;
}): Promise<void> {
  const payload: Record<string, unknown> = { v: 1, post: input.postId };
  if (input.invoice) payload.pr = input.invoice;
  await publishEncryptedAppData({
    signer: input.signer,
    dTag: requestDTag(input.postId),
    recipient: input.creator,
    tag: KEYREQ_TAG,
    plaintext: JSON.stringify(payload),
  });
}

/**
 * Get the decryption key for a post the reader is entitled to: local cache
 * first, then relay deliveries, then the keybox (settled invoice, works while
 * the creator is offline), and finally a signed request to the creator that is
 * polled until their key server answers (they must be online to respond).
 */
export async function ensurePostKey(input: {
  signer: AppSigner;
  myPubkey: string;
  creator: string;
  postId: string;
  /** The author never asks themselves for the key. */
  isAuthor?: boolean;
}): Promise<string | null> {
  const cached = getCachedKey(input.postId);
  if (cached) return cached;
  try {
    const fromRelay = await fetchPostKeyFromRelay({
      signer: input.signer,
      creator: input.creator,
      postId: input.postId,
      myPubkey: input.myPubkey,
    });
    if (fromRelay) return fromRelay;
  } catch {
    // fall through to the keybox / request flows
  }

  // The settled invoice is the payment proof the keybox redeems.
  const invoice =
    getCreatorBadge(input.creator)?.invoice ??
    getPostUnlocks().find((unlock) => unlock.postId === input.postId)?.invoice;

  if (invoice && keyboxUrl()) {
    try {
      const fromKeybox = await fetchKeyFromKeybox(input.creator, input.postId, invoice);
      if (fromKeybox) {
        saveCachedKey(input.postId, fromKeybox);
        return fromKeybox;
      }
    } catch {
      // fall through to the request flow
    }
  }

  if (input.isAuthor) return null;

  try {
    await publishKeyRequest({
      signer: input.signer,
      creator: input.creator,
      postId: input.postId,
      invoice: invoice ?? undefined,
    });
  } catch {
    return null;
  }
  for (let attempt = 0; attempt < REQUEST_POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_POLL_MS));
    try {
      const key = await fetchPostKeyFromRelay({
        signer: input.signer,
        creator: input.creator,
        postId: input.postId,
        myPubkey: input.myPubkey,
      });
      if (key) return key;
    } catch {
      // keep polling
    }
  }
  return null;
}

// ---------- Creator-side key server ----------

type KeyRequestEvent = { event: NostrEvent; requester: string; postId: string; invoice?: string };

const verifyEndpointCache = new Map<string, string>();

/**
 * LUD-21: the verify URL rides on the invoice response, so probing the
 * creator's own LNURL endpoint once is enough — it is the same URL for every
 * invoice that service issues.
 */
async function fetchVerifyEndpoint(address: string): Promise<string | null> {
  const domain = address.split("@")[1]?.toLowerCase();
  if (domain && verifyEndpointCache.has(domain)) return verifyEndpointCache.get(domain) ?? null;
  if (!address.includes("@")) return null;
  try {
    const metaResponse = await fetch(lightningAddressUrl(address));
    if (!metaResponse.ok) return null;
    const meta = (await metaResponse.json()) as {
      callback?: string;
      minSendable?: number;
    };
    if (!meta.callback) return null;
    const callback = new URL(meta.callback);
    callback.searchParams.set("amount", String(Math.max(1000, meta.minSendable ?? 1000)));
    const invoiceResponse = await fetch(callback.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!invoiceResponse.ok) return null;
    const invoiceBody = (await invoiceResponse.json()) as { verify?: string };
    if (!invoiceBody.verify) return null;
    const resolved = new URL(invoiceBody.verify, callback);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return null;
    verifyEndpointCache.set(domain, resolved.toString());
    return resolved.toString();
  } catch {
    return null;
  }
}

/** Ask the creator's Lightning service whether this exact invoice settled. */
async function verifySettledInvoice(
  address: string,
  invoice: string,
): Promise<"settled" | "unsettled" | "unsupported"> {
  const endpoint = await fetchVerifyEndpoint(address);
  if (!endpoint) return "unsupported";
  try {
    const url = new URL(endpoint);
    url.searchParams.set("invoice", invoice);
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return "unsettled";
    const body = (await response.json()) as { status?: string };
    return body.status === "settled" ? "settled" : "unsettled";
  } catch {
    return "unsettled";
  }
}

let cachedBadgePrice: { creator: string; sats: number; at: number } | null = null;

/** The creator's monthly membership price, from their latest premium post. */
async function badgePriceFor(creator: string): Promise<number> {
  if (cachedBadgePrice?.creator === creator && Date.now() - cachedBadgePrice.at < 10 * 60 * 1000) {
    return cachedBadgePrice.sats;
  }
  try {
    const events = await queryEvents(
      { kinds: [1, 30023], authors: [creator], limit: 100 },
      { timeout: 5000, fresh: true },
    );
    const premium = events
      .filter((event) => isFinitePrice(tagValue(event, "premium")))
      .sort((a, b) => b.created_at - a.created_at)[0];
    if (premium) {
      const sats = Number(tagValue(premium, "premium"));
      cachedBadgePrice = { creator, sats, at: Date.now() };
      return sats;
    }
  } catch {
    // Price unknown; callers treat 0 as "no membership check".
  }
  return 0;
}

/** The single-post unlock price from the post's own tags, 0 when unknown. */
async function unlockPriceFor(creator: string, postId: string): Promise<number> {
  try {
    const events = await queryEvents({ ids: [postId], limit: 1 }, { timeout: 5000, fresh: true });
    const post = events[0];
    const unlockTag = post ? tagValue(post, "premium-unlock") : undefined;
    return isFinitePrice(unlockTag) ? Number(unlockTag) : 0;
  } catch {
    return 0;
  }
}

/** The cheapest legitimate route to this post: the badge or the unlock price. */
async function expectedPriceFor(input: { creator: string; postId: string }): Promise<number> {
  const badge = await badgePriceFor(input.creator);
  const unlock = await unlockPriceFor(input.creator, input.postId);
  const expected = Math.min(
    badge > 0 ? badge : Number.POSITIVE_INFINITY,
    unlock > 0 ? unlock : Number.POSITIVE_INFINITY,
  );
  return Number.isFinite(expected) ? expected : 0;
}

function isFinitePrice(value: string | undefined) {
  if (!value) return false;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0;
}

async function hasValidReceipt(input: {
  requester: string;
  creator: string;
  postId: string;
}): Promise<boolean> {
  const filters: Filter[] = [
    {
      kinds: [BADGE_ANNOUNCE_KIND],
      authors: [input.requester],
      "#d": [postUnlockAnnouncementDTag(input.postId)],
      limit: 1,
    },
    {
      kinds: [BADGE_ANNOUNCE_KIND],
      authors: [input.requester],
      "#d": [badgeAnnouncementDTag(input.creator)],
      limit: 1,
    },
  ];
  const results = await Promise.allSettled(
    filters.map((filter) => queryEvents(filter, { timeout: 5000, fresh: true })),
  );
  const now = Math.floor(Date.now() / 1000);
  return results.some((result) => {
    if (result.status !== "fulfilled") return false;
    return result.value.some((event) => {
      const d = tagValue(event, "d") ?? "";
      if (d.startsWith("crays:unlock:")) return true;
      const expires = Number(tagValue(event, "expires"));
      return d.startsWith("crays:badge:") && Number.isFinite(expires) && expires > now;
    });
  });
}

/**
 * Decide whether a requester may receive the key. A settled invoice on the
 * creator's own service is the strongest proof; the signed receipts are the
 * fallback when that service can't verify payments.
 */
async function authorizeRequest(input: {
  creator: string;
  address: string;
  request: KeyRequestEvent;
}): Promise<boolean> {
  const { request } = input;
  if (request.invoice) {
    const status = await verifySettledInvoice(input.address, request.invoice);
    if (status === "settled") {
      const expected = await expectedPriceFor({ creator: input.creator, postId: request.postId });
      let paid = 0;
      try {
        paid = getSatoshisAmountFromBolt11(request.invoice);
      } catch {
        paid = 0;
      }
      return expected === 0 ? true : paid >= expected;
    }
    if (status === "unsettled") return false;
    // "unsupported": the creator's Lightning service can't verify invoices.
  }
  return hasValidReceipt({
    requester: request.requester,
    creator: input.creator,
    postId: request.postId,
  });
}

const servedRequests = new Set<string>();

function markServed(id: string) {
  // The set only needs to cover a session; keep it bounded.
  if (servedRequests.size > 2000) servedRequests.clear();
  servedRequests.add(id);
}

async function serveKeyRequests(signer: AppSigner, creator: string, address: string) {
  let events: NostrEvent[] = [];
  try {
    events = await queryEvents(
      {
        kinds: [BADGE_ANNOUNCE_KIND],
        "#p": [creator],
        "#t": [KEYREQ_TAG],
        since: Math.floor(Date.now() / 1000) - 15 * 60,
        limit: 200,
      },
      { timeout: 6000, fresh: true },
    );
  } catch {
    return;
  }
  // One request per requester/postId pair: keep the newest event only.
  const latest = new Map<string, NostrEvent>();
  for (const event of events) {
    const postId = (tagValue(event, "d") ?? "").slice("crays:keyreq:".length);
    if (!postId) continue;
    const slot = `${event.pubkey}:${postId}`;
    const current = latest.get(slot);
    if (!current || current.created_at < event.created_at) latest.set(slot, event);
  }

  for (const event of latest.values()) {
    if (servedRequests.has(event.id)) continue;
    markServed(event.id);
    const postId = (tagValue(event, "d") ?? "").slice("crays:keyreq:".length);
    const key = getCachedKey(postId);
    if (!key) continue; // key unknown (e.g. older device never restored it)
    let invoice: string | undefined;
    try {
      const parsed = JSON.parse(event.content) as { pr?: unknown };
      if (typeof parsed.pr === "string") invoice = parsed.pr;
    } catch {
      // Receipt-based verification then.
    }
    try {
      const allowed = await authorizeRequest({
        creator,
        address,
        request: { event, requester: event.pubkey, postId, invoice },
      });
      if (!allowed) continue;
      await publishEncryptedAppData({
        signer,
        dTag: deliveryDTag(postId, event.pubkey),
        recipient: event.pubkey,
        tag: KEY_TAG,
        plaintext: JSON.stringify({ v: 1, post: postId, key }),
      });
    } catch {
      // Leave it to the next poll.
      servedRequests.delete(event.id);
    }
  }
}

/**
 * Deposit every key this account already holds with the keybox, so posts
 * published before the keybox was configured keep unlocking for readers who
 * pay while the creator is offline. Prices come from each post's own tags.
 */
export async function syncCreatorKeysToKeybox(input: {
  signer: AppSigner;
  creator: string;
  address: string;
}): Promise<number> {
  if (!keyboxUrl()) return 0;
  const stored = await listKeyboxPosts(input.signer, input.creator);
  if (!stored) return 0; // keybox unreachable — nothing to sync against
  const storedSet = new Set(stored);
  const badgeSats = await badgePriceFor(input.creator);
  let uploaded = 0;
  for (const [postId, key] of getOwnedKeys()) {
    if (storedSet.has(postId)) continue;
    const unlockSats = await unlockPriceFor(input.creator, postId);
    const ok = await uploadPostKey({
      signer: input.signer,
      address: input.address,
      badgeSats,
      unlockSats,
      postId,
      key,
    });
    if (ok) uploaded += 1;
  }
  return uploaded;
}

/**
 * Run the creator's key server while they are signed in: answer key requests
 * from readers who paid, and keep the keybox (when configured) stocked with
 * keys so it can serve while the creator is offline. Returns a stop function.
 */
export function startCreatorKeyServer(
  signer: AppSigner,
  creator: string,
  address: string,
): () => void {
  let stopped = false;
  let running = false;
  let initialized = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      // Once per session: pull this account's own keys back from relays, so a
      // new device can serve and read everything the old one could, then
      // deposit anything the keybox is missing.
      if (!initialized) {
        initialized = true;
        await restoreOwnKeys(signer, creator);
        void syncCreatorKeysToKeybox({ signer, creator, address }).catch(() => undefined);
      }
      await serveKeyRequests(signer, creator, address);
    } catch {
      // keep the server alive; the next tick retries
    } finally {
      running = false;
    }
  };

  void tick();
  const interval = window.setInterval(tick, 30_000);
  const onVisible = () => {
    if (document.visibilityState === "visible") void tick();
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    stopped = true;
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
