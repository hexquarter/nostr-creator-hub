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

/** Don't hang the whole UI on a relay that never opens its socket. */
const CONNECT_TIMEOUT = 2200;
/** Default upper bound for a single query. */
const DEFAULT_QUERY_TIMEOUT = 2800;
/** How long a query result is reused before it is fetched again. */
const CACHE_TTL = 30_000;
const CACHE_LIMIT = 250;

let customRelays: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();

type RelayHandle = Awaited<ReturnType<SimplePool["ensureRelay"]>>;

const connectCache = new Map<string, Promise<RelayHandle | null>>();
const queryCache = new Map<string, { at: number; ttl: number; events: NostrEvent[] }>();
const inFlight = new Map<string, Promise<NostrEvent[]>>();

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
    invalidateQueries();
    persist();
  }
  return relay;
}

export function removeRelay(relay: string) {
  customRelays = customRelays.filter((r) => r !== relay);
  invalidateQueries();
  persist();
}

export function subscribeRelays(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function isBrowser() {
  return typeof window !== "undefined";
}

/** Drop cached reads, e.g. right after publishing an event. */
export function invalidateQueries() {
  queryCache.clear();
  inFlight.clear();
}

function connect(relay: string): Promise<RelayHandle | null> {
  const cached = connectCache.get(relay);
  if (cached) return cached;
  const pending = pool.ensureRelay(relay, { connectionTimeout: CONNECT_TIMEOUT }).catch(() => {
    connectCache.delete(relay);
    return null;
  });
  connectCache.set(relay, pending);
  return pending;
}

/**
 * Open relay sockets ahead of the first query. Called once when the app boots
 * so the handshake overlaps with rendering instead of blocking the first feed.
 */
export function warmRelays(relays = getRelayList()) {
  if (!isBrowser()) return;
  for (const relay of relays) void connect(relay);
}

function remember(key: string, events: NostrEvent[]) {
  // An empty result can mean "the relays had nothing" or "every relay was
  // unreachable", so only trust it for a moment.
  queryCache.set(key, {
    at: Date.now(),
    ttl: events.length === 0 ? 5_000 : CACHE_TTL,
    events,
  });
  if (queryCache.size > CACHE_LIMIT) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
}

type QueryOptions = {
  timeout?: number;
  relays?: string[];
  /** Skip the in-memory cache (used by explicit refresh buttons). */
  fresh?: boolean;
};

async function runQuery(relays: string[], filter: Filter, timeout: number): Promise<NostrEvent[]> {
  if (relays.length === 0) return [];

  return new Promise<NostrEvent[]>((resolve) => {
    const chunks: NostrEvent[][] = [];
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const subs: Array<{ close: () => void }> = [];
    let finished = 0;
    let failed = 0;
    let settled = false;
    let grace: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      if (grace) clearTimeout(grace);
      clearTimers();
      for (const sub of subs) {
        try {
          sub.close();
        } catch {
          // relay already gone
        }
      }
      resolve(dedupeEvents(chunks.flat()));
    };

    const isSearch = typeof filter.search === "string" && filter.search.trim().length > 0;
    // NIP-50 search results come from a subset of relays and can be slower than
    // relays that quickly return nothing. For search, wait for all relays or the
    // deadline so perfect display-name matches aren't missed.
    const needed = Math.min(2, relays.length);
    const deadline = setTimeout(finish, timeout + (isSearch ? 500 : 250));
    timers.add(deadline);

    const maybeFinish = () => {
      if (settled) return;
      if (finished + failed >= relays.length) {
        finish();
        return;
      }
      if (isSearch) return;
      if (finished >= needed && !grace) {
        grace = setTimeout(finish, 150);
      }
    };

    for (const url of relays) {
      // Don't wait for every socket: a dead relay must not hold the UI. Each
      // relay starts its own subscription as soon as it connects.
      const relayPromise = isSearch
        ? pool.ensureRelay(url, { connectionTimeout: 5000 }).catch(() => null)
        : connect(url);
      void relayPromise.then((relay) => {
        if (settled) return;
        if (!relay) {
          failed += 1;
          maybeFinish();
          return;
        }

        let done = false;
        const events: NostrEvent[] = [];
        const settle = () => {
          if (done) return;
          done = true;
          chunks.push(events);
          finished += 1;
          maybeFinish();
        };
        const timer = setTimeout(settle, timeout);
        timers.add(timer);
        try {
          const sub = relay.subscribe([filter], {
            onevent(event) {
              events.push(event);
            },
            oneose: settle,
            onclose: settle,
          });
          subs.push(sub);
        } catch {
          clearTimeout(timer);
          timers.delete(timer);
          settle();
        }
      });
    }
  });
}

/** Read events from the relay set, de-duplicated and newest first. */
export async function queryEvents(
  filter: Filter,
  options: QueryOptions = {},
): Promise<NostrEvent[]> {
  if (!isBrowser()) return [];
  const relays = options.relays ?? getRelayList();
  const key = JSON.stringify([filter, relays]);

  if (!options.fresh) {
    const hit = queryCache.get(key);
    if (hit && Date.now() - hit.at < hit.ttl) return hit.events;
    const running = inFlight.get(key);
    if (running) return running;
  }

  const task = runQuery(relays, filter, options.timeout ?? DEFAULT_QUERY_TIMEOUT)
    .then((events) => {
      remember(key, events);
      return events;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return task;
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
  // Our own event changed state (follows, profile, bookmarks…), so reads that
  // were cached before the write must not win.
  invalidateQueries();
  return { delivered: ok.length, failed: failed.length, relays: ok };
}
