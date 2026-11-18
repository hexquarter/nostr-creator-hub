import { SimplePool, type Filter, type NostrEvent } from "nostr-tools";

/** Relays that Crays reads and writes by default. */
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
  "wss://relay.nostr.band",
] as const;

/** PriceStr publishes its signed oracle events here (plus backups). */
export const PRICE_RELAYS = [
  "wss://relay.pricestr.xyz",
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
] as const;

const RELAYS_STORAGE_KEY = "crays.custom-relays.v1";

export const pool = new SimplePool();

let customRelays: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function loadCustomRelays() {
  if (loaded || !canUseStorage()) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(RELAYS_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        customRelays = parsed.filter((r): r is string => typeof r === "string");
      }
    }
  } catch {
    // ignore bad local state
  }
}

export function getRelayList(): string[] {
  loadCustomRelays();
  return Array.from(new Set([...DEFAULT_RELAYS, ...customRelays]));
}

export function getCustomRelays(): string[] {
  loadCustomRelays();
  return customRelays;
}

export function normalizeRelayUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let url = raw;
  if (!/^wss?:\/\//i.test(url)) url = `wss://${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "wss:" && parsed.protocol !== "ws:") return null;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function persist() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(RELAYS_STORAGE_KEY, JSON.stringify(customRelays));
  } catch {
    // ignore quota errors
  }
  listeners.forEach((l) => l());
}

export function addRelay(input: string) {
  const relay = normalizeRelayUrl(input);
  if (!relay) throw new Error("That doesn't look like a relay URL.");
  if (!customRelays.includes(relay)) {
    customRelays = [...customRelays, relay];
    persist();
  }
  return relay;
}

export function removeRelay(relay: string) {
  customRelays = customRelays.filter((r) => r !== relay);
  persist();
}

export function subscribeRelays(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isBrowser() {
  return typeof window !== "undefined";
}

type QueryOptions = { timeout?: number; relays?: string[] };

/** Read events from the relay set, de-duplicated and newest first. */
export async function queryEvents(
  filter: Filter,
  options: QueryOptions = {},
): Promise<NostrEvent[]> {
  if (!isBrowser()) return [];
  const relays = options.relays ?? getRelayList();
  const events = await pool.querySync(relays, filter, { maxWait: options.timeout ?? 4500 });
  return dedupeEvents(events);
}

/** Run several filters in parallel (e.g. mentions + reactions). */
export async function queryEventsMany(
  filters: Filter[],
  options: QueryOptions = {},
): Promise<NostrEvent[]> {
  if (!isBrowser()) return [];
  const groups = await Promise.all(filters.map((filter) => queryEvents(filter, options)));
  return dedupeEvents(groups.flat());
}

export function dedupeEvents(events: NostrEvent[]): NostrEvent[] {
  const byId = new Map<string, NostrEvent>();
  for (const event of events) {
    const existing = byId.get(event.id);
    if (!existing || event.created_at > existing.created_at) byId.set(event.id, event);
  }
  return [...byId.values()].sort((a, b) => b.created_at - a.created_at);
}

export type PublishReport = { delivered: number; failed: number; relays: string[] };

/** Publish to as many relays as will accept the event. */
export async function publishEvent(
  event: NostrEvent,
  relays = getRelayList(),
): Promise<PublishReport> {
  if (!isBrowser()) throw new Error("Publishing requires a browser connection.");
  const results = await Promise.allSettled(pool.publish(relays, event));
  const ok: string[] = [];
  const failed: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") ok.push(relays[i]);
    else failed.push(relays[i]);
  });
  if (ok.length === 0) {
    throw new Error("Couldn't reach any relay. Check your connection and try again.");
  }
  return { delivered: ok.length, failed: failed.length, relays: ok };
}
