import type { NostrEvent } from "nostr-tools";

/**
 * Primal's caching service speaks a small, non-standard protocol on top of
 * Nostr: a REQ whose filter only contains a `cache` field. We keep a single
 * shared socket and multiplex requests over it so profile search is fast and
 * doesn't pay a WebSocket handshake per keystroke.
 *
 * @see https://github.com/PrimalHQ/primal-server
 */
const PRIMAL_CACHE_URLS = ["wss://cache2.primal.net/v1", "wss://cache1.primal.net/v1"];

/** Raw event shape Primal returns. Aggregate responses have no pubkey/sig. */
type CacheEvent = Partial<NostrEvent> & { content?: unknown };

type PendingRequest = {
  events: CacheEvent[];
  resolve: (events: CacheEvent[]) => void;
  timer: ReturnType<typeof setTimeout>;
};

let socket: WebSocket | null = null;
let socketUrlIndex = 0;
let connecting: Promise<WebSocket | null> | null = null;
const pending = new Map<string, PendingRequest>();
let subCounter = 0;

function isBrowser() {
  return typeof window !== "undefined" && typeof WebSocket !== "undefined";
}

function finishRequest(subId: string) {
  const entry = pending.get(subId);
  if (!entry) return;
  pending.delete(subId);
  clearTimeout(entry.timer);
  entry.resolve(entry.events);
}

function finishAll() {
  for (const subId of [...pending.keys()]) finishRequest(subId);
}

function attachHandlers(ws: WebSocket) {
  ws.onmessage = (message) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(message.data));
    } catch {
      return;
    }
    if (!Array.isArray(parsed)) return;
    const [type, subId, payload] = parsed;
    if (type === "EVENT") {
      const entry = typeof subId === "string" ? pending.get(subId) : undefined;
      if (entry && payload && typeof payload === "object") {
        entry.events.push(payload as CacheEvent);
      }
      return;
    }
    if (type === "EOSE" || type === "CLOSED" || type === "NOTICE") {
      if (typeof subId === "string") finishRequest(subId);
    }
  };

  const cleanup = () => {
    if (socket === ws) {
      socket = null;
      connecting = null;
    }
    finishAll();
  };
  ws.onclose = cleanup;
  ws.onerror = () => {
    // onclose normally follows, but make sure a failed socket can't stall us.
    try {
      ws.close();
    } catch {
      // already gone
    }
    cleanup();
  };
}

function openSocket(): Promise<WebSocket | null> {
  if (!isBrowser()) return Promise.resolve(null);
  if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(socket);
  if (connecting) return connecting;

  connecting = new Promise<WebSocket | null>((resolve) => {
    const url = PRIMAL_CACHE_URLS[socketUrlIndex % PRIMAL_CACHE_URLS.length];
    let settled = false;
    const settle = (value: WebSocket | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      socketUrlIndex += 1;
      connecting = null;
      settle(null);
      return;
    }

    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      socketUrlIndex += 1;
      connecting = null;
      settle(null);
    }, 4000);

    ws.onopen = () => {
      clearTimeout(timer);
      socket = ws;
      socketUrlIndex = 0;
      attachHandlers(ws);
      settle(ws);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      socketUrlIndex += 1;
      connecting = null;
      settle(null);
    };
    ws.onclose = () => {
      clearTimeout(timer);
      if (socket === ws) socket = null;
      if (connecting) connecting = null;
      settle(null);
    };
  });

  return connecting;
}

async function cacheRequest(
  method: string,
  args: Record<string, unknown>,
  timeout = 3000,
): Promise<CacheEvent[]> {
  if (!isBrowser()) return [];
  const ws = await openSocket();
  if (!ws || ws.readyState !== WebSocket.OPEN) return [];

  const subId = `crays-${++subCounter}`;
  return new Promise<CacheEvent[]>((resolve) => {
    const timer = setTimeout(() => finishRequest(subId), timeout);
    pending.set(subId, { events: [], resolve, timer });
    try {
      ws.send(JSON.stringify(["REQ", subId, { cache: [method, args] }]));
    } catch {
      finishRequest(subId);
    }
  });
}

/** Full kind-0 events from Primal's user search index. */
export async function primalUserSearchEvents(query: string, limit: number): Promise<NostrEvent[]> {
  const events = await cacheRequest("user_search", { query, limit }, 3000);
  return events.filter(
    (event): event is NostrEvent =>
      event.kind === 0 &&
      typeof event.pubkey === "string" &&
      typeof event.content === "string" &&
      typeof event.created_at === "number",
  );
}

/** Follower counts keyed by pubkey, from Primal's precomputed user stats. */
export async function primalFollowerCounts(pubkeys: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = Array.from(new Set(pubkeys.filter((pubkey) => /^[0-9a-f]{64}$/i.test(pubkey))));
  if (unique.length === 0) return map;

  const events = await cacheRequest("user_infos", { pubkeys: unique }, 3000);
  for (const event of events) {
    // 10000133 = USER_FOLLOWER_COUNTS, 10000108 = USER_SCORES.
    if (event.kind !== 10000133 && event.kind !== 10000108) continue;
    let parsed: unknown;
    try {
      parsed =
        typeof event.content === "string" ? JSON.parse(event.content) : (event.content as unknown);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    for (const [pubkey, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      map.set(pubkey.toLowerCase(), value);
    }
  }
  return map;
}
