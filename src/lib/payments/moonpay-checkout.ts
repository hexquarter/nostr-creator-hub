import { randomHex } from "@/lib/nostr/signer";
import { fetchProfile } from "@/lib/nostr/profiles";
import { lightningAddressFor } from "@/lib/nostr/lightning";
import { requestPaymentDetails } from "@/lib/nostr/zaps";
import {
  createMoonPayUrl,
  fundingSatsFor,
  payLightningInvoice,
  waitForBreezBalance,
} from "./breez-wallet";

/**
 * Card / Apple Pay purchases through Breez MoonPay.
 *
 * A purchase is a two-step flow:
 *
 *   1. MoonPay tops up the browser's Breez Spark wallet (card, Apple Pay or
 *      Google Pay — no wallet or seed phrase for the fan).
 *   2. Crays pays the creator's BOLT-11 invoice from that wallet, so the
 *      creator still receives Lightning sats directly and Crays never holds
 *      the money.
 *
 * The order is persisted locally so a checkout can survive the redirect to
 * MoonPay and finish on the next page load.
 */

export type MoonPayPurchaseMode = "subscribe" | "post";

export type MoonPayOrderStatus = "awaiting-funds" | "paying" | "paid" | "granted";

export type PendingMoonPayOrder = {
  orderId: string;
  buyerPubkey: string;
  creator: string;
  name: string;
  mode: MoonPayPurchaseMode;
  /** Price charged for the membership or single post, in sats. */
  sats: number;
  /** Amount asked from MoonPay, including a small Lightning-fee buffer. */
  fundingSats: number;
  postSats?: number;
  postId?: string;
  amountUsd?: number | null;
  /** MoonPay checkout URL, kept so the fan can reopen it. */
  url?: string;
  quoteId?: string;
  delivery?: "crosschain" | "bitcoin";
  invoice?: string;
  verifyUrl?: string;
  paymentId?: string;
  status: MoonPayOrderStatus;
  createdAt: number;
  updatedAt: number;
  grantedAt?: number;
};

export type StartMoonPayOrderInput = {
  buyerPubkey: string;
  creator: string;
  name: string;
  mode: MoonPayPurchaseMode;
  sats: number;
  postSats?: number;
  postId?: string;
  amountUsd?: number | null;
};

const ORDER_PREFIX = "crays.moonpay.v1.order";
const INDEX_PREFIX = "crays.moonpay.v1.pending";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function orderKey(orderId: string) {
  return `${ORDER_PREFIX}.${orderId}`;
}

function indexKey(buyerPubkey: string) {
  return `${INDEX_PREFIX}.${buyerPubkey}`;
}

function isOrder(value: unknown): value is PendingMoonPayOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<PendingMoonPayOrder>;
  return (
    typeof order.orderId === "string" &&
    typeof order.buyerPubkey === "string" &&
    typeof order.creator === "string" &&
    typeof order.sats === "number" &&
    typeof order.fundingSats === "number" &&
    (order.mode === "subscribe" || order.mode === "post") &&
    (order.status === "awaiting-funds" ||
      order.status === "paying" ||
      order.status === "paid" ||
      order.status === "granted") &&
    typeof order.createdAt === "number"
  );
}

export function loadMoonPayOrder(orderId: string): PendingMoonPayOrder | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(orderKey(orderId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isOrder(parsed)) return null;
    if (Date.now() - parsed.createdAt > MAX_AGE_MS) {
      window.localStorage.removeItem(orderKey(orderId));
      window.localStorage.removeItem(indexKey(parsed.buyerPubkey));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveMoonPayOrder(order: PendingMoonPayOrder) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(orderKey(order.orderId), JSON.stringify(order));
    window.localStorage.setItem(indexKey(order.buyerPubkey), order.orderId);
  } catch {
    // A missing cache only means the checkout can't be resumed later.
  }
}

function patchMoonPayOrder(
  order: PendingMoonPayOrder,
  patch: Partial<PendingMoonPayOrder>,
): PendingMoonPayOrder {
  const latest = loadMoonPayOrder(order.orderId) ?? order;
  const next = { ...latest, ...patch, updatedAt: Date.now() };
  saveMoonPayOrder(next);
  return next;
}

export function clearMoonPayOrder(orderId: string) {
  if (!canUseStorage()) return;
  try {
    const order = loadMoonPayOrder(orderId);
    window.localStorage.removeItem(orderKey(orderId));
    if (order) {
      const index = window.localStorage.getItem(indexKey(order.buyerPubkey));
      if (index === orderId) window.localStorage.removeItem(indexKey(order.buyerPubkey));
    }
  } catch {
    // ignore
  }
}

/** The unfinished card purchase for this account, if there is one. */
export function getPendingMoonPayOrder(buyerPubkey: string): PendingMoonPayOrder | null {
  if (!canUseStorage()) return null;
  try {
    const orderId = window.localStorage.getItem(indexKey(buyerPubkey));
    if (!orderId) return null;
    const order = loadMoonPayOrder(orderId);
    if (!order || order.status === "granted" || order.buyerPubkey !== buyerPubkey) {
      window.localStorage.removeItem(indexKey(buyerPubkey));
      return null;
    }
    // `paid` orders only need the local grant to finish.
    return order;
  } catch {
    return null;
  }
}

function cleanUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("moonpay");
  url.searchParams.delete("moonpay_order");
  return url;
}

function redirectUrlFor(orderId: string) {
  const url = cleanUrl();
  url.searchParams.set("moonpay", "return");
  url.searchParams.set("moonpay_order", orderId);
  return url.toString();
}

/** Read a MoonPay return URL and clear its markers so refreshes don't repeat it. */
export function consumeMoonPayReturn(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const status = params.get("moonpay");
  const orderId = params.get("moonpay_order");
  if (!status) return null;

  params.delete("moonpay");
  params.delete("moonpay_order");
  const query = params.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
  );

  return status === "return" && orderId ? orderId : null;
}

/** Create the local order and obtain its MoonPay checkout URL. */
export async function startMoonPayOrder(
  input: StartMoonPayOrderInput,
): Promise<{ order: PendingMoonPayOrder; url: string }> {
  const orderId = randomHex(16);
  const fundingSats = fundingSatsFor(input.sats);
  const order: PendingMoonPayOrder = {
    ...input,
    orderId,
    fundingSats,
    status: "awaiting-funds",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveMoonPayOrder(order);

  try {
    const result = await createMoonPayUrl({
      amountSat: fundingSats,
      amountUsd: input.amountUsd,
      redirectUrl: redirectUrlFor(orderId),
    });
    const next = patchMoonPayOrder(order, {
      url: result.url,
      quoteId: result.quoteId,
      delivery: result.delivery,
    });
    return { order: next, url: result.url };
  } catch (error) {
    clearMoonPayOrder(orderId);
    throw error;
  }
}

export class MoonPayPendingError extends Error {
  readonly code = "MOONPAY_PENDING";
  constructor(readonly balanceSats: number) {
    super("Your card payment is still arriving. This can take a few minutes.");
    this.name = "MoonPayPendingError";
  }
}

/*
 * Cross-tab driver election.
 *
 * A desktop checkout keeps polling in the Crays tab while the fan pays on
 * their phone (QR) or in a MoonPay tab. If MoonPay redirects back into a new
 * tab, that tab must not open a second Breez wallet and race the first one.
 * The original tab announces that it is driving; a redirected tab that hears
 * it stays put.
 */
const DRIVER_CHANNEL = "crays-moonpay-driver";
const tabId = randomHex(8);
const drivingOrders = new Set<string>();
let driverChannel: BroadcastChannel | null = null;

function ensureDriverChannel() {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!driverChannel) {
    driverChannel = new BroadcastChannel(DRIVER_CHANNEL);
    driverChannel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; orderId?: string; tabId?: string };
      if (
        data?.type === "query" &&
        data.orderId &&
        data.tabId !== tabId &&
        drivingOrders.has(data.orderId)
      ) {
        driverChannel?.postMessage({ type: "driving", orderId: data.orderId, tabId });
      }
    };
  }
  return driverChannel;
}

function claimDriver(orderId: string) {
  drivingOrders.add(orderId);
  ensureDriverChannel();
}

function releaseDriver(orderId: string) {
  drivingOrders.delete(orderId);
}

/** True when another Crays tab is already finishing this order. */
export function hasOtherMoonPayDriver(orderId: string): Promise<boolean> {
  const channel = ensureDriverChannel();
  if (!channel) return Promise.resolve(false);

  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; orderId?: string; tabId?: string };
      if (data?.type === "driving" && data.orderId === orderId && data.tabId !== tabId) {
        window.clearTimeout(timer);
        channel.removeEventListener("message", onMessage);
        resolve(true);
      }
    };
    const timer = window.setTimeout(() => {
      channel.removeEventListener("message", onMessage);
      resolve(false);
    }, 700);
    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "query", orderId, tabId });
  });
}

export type MoonPayProgress = "waiting-funds" | "creating-invoice" | "paying" | "verifying";

export type MoonPayFulfillment = {
  order: PendingMoonPayOrder;
  invoice?: string;
  verifyUrl?: string;
  paymentId: string;
};

const activeRuns = new Map<string, Promise<MoonPayFulfillment>>();

/**
 * Wait for MoonPay's funds, then pay the creator's invoice.
 *
 * Concurrent callers (two tabs, a re-render, a resumed checkout) share one
 * promise, and the Breez payment idempotency key is the order id, so a retry
 * cannot pay twice.
 */
export function runMoonPayOrder(
  order: PendingMoonPayOrder,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    onProgress?: (progress: MoonPayProgress) => void;
    onBalance?: (balance: number) => void;
  } = {},
): Promise<MoonPayFulfillment> {
  const running = activeRuns.get(order.orderId);
  if (running) return running;

  claimDriver(order.orderId);
  const run = fulfillMoonPayOrder(order, options).finally(() => {
    activeRuns.delete(order.orderId);
    releaseDriver(order.orderId);
  });
  activeRuns.set(order.orderId, run);
  return run;
}

async function fulfillMoonPayOrder(
  order: PendingMoonPayOrder,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    onProgress?: (progress: MoonPayProgress) => void;
    onBalance?: (balance: number) => void;
  },
): Promise<MoonPayFulfillment> {
  let current = loadMoonPayOrder(order.orderId) ?? order;

  // Already sent: only the local unlock is left.
  if (current.status === "paid" && current.paymentId) {
    options.onProgress?.("verifying");
    return {
      order: current,
      invoice: current.invoice,
      verifyUrl: current.verifyUrl,
      paymentId: current.paymentId,
    };
  }

  options.onProgress?.("waiting-funds");
  const target = order.sats + Math.max(25, Math.ceil(order.sats * 0.01));
  const balance = await waitForBreezBalance(target, {
    timeoutMs: options.timeoutMs ?? 5 * 60 * 1000,
    signal: options.signal,
    onBalance: options.onBalance,
  });
  if (balance < target) throw new MoonPayPendingError(balance);

  options.onProgress?.("creating-invoice");
  current = patchMoonPayOrder(current, { status: "paying" });

  // Reuse an invoice from an interrupted attempt when it is still available;
  // otherwise ask the creator's wallet for a fresh one.
  let invoice = current.invoice;
  let verifyUrl = current.verifyUrl;
  if (!invoice) {
    const profile = await fetchProfile(order.creator).catch(() => null);
    const address = lightningAddressFor(order.creator, profile);
    const details = await requestPaymentDetails(address, order.sats);
    invoice = details.invoice;
    verifyUrl = details.verifyUrl;
    current = patchMoonPayOrder(current, { invoice, verifyUrl });
  }

  options.onProgress?.("paying");
  const payment = await payLightningInvoice({
    invoice,
    amountSats: order.sats,
    idempotencyKey: `crays-moonpay:${order.orderId}`,
  });
  current = patchMoonPayOrder(current, {
    status: "paid",
    invoice,
    verifyUrl,
    paymentId: payment.paymentId,
  });

  options.onProgress?.("verifying");
  // `sendPayment` completing means the invoice settled, so unlock right away.
  // The stored LUD-21 verify URL is kept for diagnostics only; it must never
  // strand a fan who already paid.
  return { order: current, invoice, verifyUrl, paymentId: payment.paymentId };
}

/**
 * Grant the purchase exactly once, even when the checkout modal and a resumed
 * return both finish at the same time.
 */
export async function completeMoonPayOrder(
  order: PendingMoonPayOrder,
  grant: () => void | Promise<void>,
): Promise<boolean> {
  const attempt = async () => {
    const latest = loadMoonPayOrder(order.orderId);
    if (!latest || latest.grantedAt) return false;
    await grant();
    const after = loadMoonPayOrder(order.orderId) ?? latest;
    saveMoonPayOrder({
      ...after,
      status: "granted",
      grantedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return true;
  };

  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(`crays-moonpay-grant:${order.orderId}`, attempt);
  }
  return attempt();
}
