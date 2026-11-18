import { useEffect, useSyncExternalStore } from "react";
import type { NostrEvent } from "nostr-tools";
import { PRICE_RELAYS, pool, queryEvents, warmRelays } from "./relays";

export type BtcPrice = {
  usd: number;
  fxRates: Record<string, number>;
  sources: Record<string, number>;
  updatedAt: number;
  currency: string;
};

let current: BtcPrice | null = null;
let started = false;
const listeners = new Set<() => void>();

function parsePriceEvent(event: NostrEvent): BtcPrice | null {
  try {
    const body = JSON.parse(event.content) as {
      median?: number;
      fxRates?: Record<string, number>;
      sources?: Record<string, number>;
    };
    const usd = Number(body.median);
    if (!Number.isFinite(usd) || usd <= 0) return null;
    const currency = event.tags.find((tag) => tag[0] === "currency")?.[1] ?? "USD";
    return {
      usd,
      fxRates: body.fxRates ?? {},
      sources: body.sources ?? {},
      updatedAt: event.created_at,
      currency,
    };
  } catch {
    return null;
  }
}

function publish(next: BtcPrice) {
  if (current && current.updatedAt > next.updatedAt) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  warmRelays([...PRICE_RELAYS]);

  queryEvents(
    { kinds: [30078], "#t": ["pricestr"], limit: 1 },
    { relays: [...PRICE_RELAYS], timeout: 4500 },
  )
    .then((events) => {
      for (const event of events) {
        const parsed = parsePriceEvent(event);
        if (parsed) publish(parsed);
      }
    })
    .catch(() => undefined);

  pool.subscribeMany(
    [...PRICE_RELAYS],
    {
      kinds: [30078],
      "#t": ["pricestr"],
      since: Math.floor(Date.now() / 1000) - 900,
    },
    {
      maxWait: 8000,
      onevent: (event) => {
        const parsed = parsePriceEvent(event);
        if (parsed) publish(parsed);
      },
    },
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return current;
}

/** Live BTC/USD price published by pricestr.xyz over Nostr (kind 30078). */
export function useBtcPrice(): BtcPrice | null {
  useEffect(() => {
    start();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

export function satsToUsd(sats: number, price: BtcPrice | null) {
  if (!price) return null;
  return (sats / 100_000_000) * price.usd;
}

export function usdToSats(usd: number, price: BtcPrice | null) {
  if (!price) return null;
  return Math.round((usd / price.usd) * 100_000_000);
}

export function formatUsd(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSats(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString("en-US");
}
