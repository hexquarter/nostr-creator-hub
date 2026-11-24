/**
 * Breez Spark wallet used for card / Apple Pay purchases through MoonPay.
 *
 * Crays is a static site, so this wallet lives entirely in the browser. The
 * first card checkout creates a BIP-39 seed, stores it locally, and connects to
 * the Breez Spark SDK. MoonPay then tops the wallet up; the same wallet pays
 * the creator's BOLT-11 invoice over Lightning.
 *
 * The Breez SDK (and its 12 MB WASM module) is only imported when a fan
 * actually starts a card purchase, so the normal app bundle stays small.
 */

import type { BreezSdk, LightningAddressInfo, Seed, SdkEvent } from "@breeztech/breez-sdk-spark";
import { randomHex } from "@/lib/nostr/signer";

const API_KEY = (import.meta.env.VITE_BREEZ_API_KEY as string | undefined)?.trim();

/** Card checkout is available only once a Breez API key is configured. */
export const BREEZ_MOONPAY_CONFIGURED = Boolean(API_KEY);

const SEED_STORAGE_KEY = "crays.breez.seed.v1";
const WALLET_ID_STORAGE_KEY = "crays.breez.wallet-id.v1";
const STORAGE_DIR_PREFIX = "crays-breez-wallet";

/** A little extra so Lightning routing fees don't eat into the invoice. */
export function fundingSatsFor(amountSats: number) {
  return amountSats + Math.max(100, Math.ceil(amountSats * 0.02));
}

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function readMnemonic(): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(SEED_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeMnemonic(mnemonic: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(SEED_STORAGE_KEY, mnemonic);
  } catch {
    // If storage fails the wallet only lives for this page session.
  }
}

function readWalletId(): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(WALLET_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeWalletId(id: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(WALLET_ID_STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

function randomWalletId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createSdk(): Promise<BreezSdk> {
  if (!API_KEY) {
    throw new Error("Card checkout isn't connected yet. Add VITE_BREEZ_API_KEY to enable MoonPay.");
  }
  if (typeof window === "undefined") {
    throw new Error("The Breez wallet only runs in the browser.");
  }

  const [breez, bip39, english] = await Promise.all([
    import("@breeztech/breez-sdk-spark/web"),
    import("@scure/bip39"),
    import("@scure/bip39/wordlists/english.js"),
  ]);

  await breez.default();

  let mnemonic = readMnemonic();
  if (!mnemonic) {
    mnemonic = bip39.generateMnemonic(english.wordlist, 128);
    storeMnemonic(mnemonic);
  }

  // Keep each seed in its own SDK database. If local storage is cleared, the
  // next wallet gets a fresh id instead of colliding with the old IndexedDB.
  let walletId = readWalletId();
  if (!walletId) {
    walletId = randomWalletId();
    storeWalletId(walletId);
  }

  const config = breez.defaultConfig("mainnet");
  config.apiKey = API_KEY;
  // Background tasks let the SDK claim MoonPay's on-chain deposit and finish
  // conversions without the checkout modal having to stay in the foreground.
  config.backgroundTasksEnabled = true;

  const seed: Seed = { type: "mnemonic", mnemonic };
  return breez.connect({
    config,
    seed,
    storageDir: `${STORAGE_DIR_PREFIX}-${walletId}`,
  });
}

let sdkPromise: Promise<BreezSdk> | null = null;

/** Connect once per page; every checkout path shares the same wallet. */
export function getBreezSdk(): Promise<BreezSdk> {
  if (!BREEZ_MOONPAY_CONFIGURED) {
    return Promise.reject(
      new Error("Card checkout isn't connected yet. Add VITE_BREEZ_API_KEY to enable MoonPay."),
    );
  }
  if (!sdkPromise) {
    sdkPromise = createSdk().catch((error) => {
      sdkPromise = null;
      throw error;
    });
  }
  return sdkPromise;
}

export type MoonPayUrlResult = {
  url: string;
  /** Present when MoonPay delivers USDC on Solana instead of on-chain BTC. */
  quoteId?: string;
  delivery: "crosschain" | "bitcoin";
};

/** Turn terse SDK errors into something a fan can act on. */
export function breezErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/api key|base64|jwt|unauthor|401|403/i.test(message)) {
    return "Card checkout isn't configured correctly. Check the Breez API key.";
  }
  if (/network|fetch|failed to fetch|timeout/i.test(message)) {
    return "Couldn't reach the card provider. Check your connection and try again.";
  }
  return message || "Card checkout failed. Please try again.";
}

/**
 * Ask the Breez SDK for a MoonPay checkout URL.
 *
 * USDC on Solana settles much faster than an on-chain Bitcoin purchase, so it
 * is preferred when a USD amount is available. If the conversion route isn't
 * available the SDK falls back to the documented Bitcoin delivery.
 */
export async function createMoonPayUrl(input: {
  amountSat: number;
  amountUsd?: number | null;
  redirectUrl: string;
}): Promise<MoonPayUrlResult> {
  const sdk = await getBreezSdk();
  const configured = (import.meta.env.VITE_BREEZ_MOONPAY_DELIVERY as string | undefined)
    ?.trim()
    .toLowerCase();
  const canUseCrossChain =
    configured !== "bitcoin" &&
    input.amountUsd != null &&
    Number.isFinite(input.amountUsd) &&
    // MoonPay's USDC-on-Solana checkout refuses anything below about $20.
    input.amountUsd >= 20;

  if (canUseCrossChain) {
    try {
      const response = await sdk.buyBitcoin({
        type: "moonpay",
        delivery: {
          type: "crossChain",
          amount: BigInt(Math.round(input.amountUsd! * 1_000_000)),
          feeMode: "feesExcluded",
        },
        redirectUrl: input.redirectUrl,
      });
      return {
        url: response.url,
        quoteId: response.crossChainInfo?.quoteId,
        delivery: "crosschain",
      };
    } catch (error) {
      console.warn("MoonPay USDC delivery unavailable; using on-chain Bitcoin.", error);
    }
  }

  const response = await sdk.buyBitcoin({
    type: "moonpay",
    delivery: { type: "bitcoin", amountSat: input.amountSat },
    redirectUrl: input.redirectUrl,
  });
  return { url: response.url, delivery: "bitcoin" };
}

async function claimMatureDeposits(sdk: BreezSdk) {
  try {
    const { deposits } = await sdk.listUnclaimedDeposits({});
    await Promise.all(
      deposits
        .filter((deposit) => deposit.isMature && !deposit.claimError)
        .map((deposit) =>
          sdk.claimDeposit({ txid: deposit.txid, vout: deposit.vout }).catch(() => undefined),
        ),
    );
  } catch {
    // A deposit that can't be claimed yet just stays pending; keep polling.
  }
}

export async function getBreezBalance(): Promise<number> {
  const sdk = await getBreezSdk();
  // Claim any MoonPay deposit that has matured since the last visit, so the
  // balance reflects funds the user already paid for.
  await claimMatureDeposits(sdk);
  const info = await sdk.getInfo({ ensureSynced: true });
  return info.balanceSats;
}

/**
 * True when a Breez wallet seed exists locally and the SDK is configured.
 * Deliberately does not import the SDK — checking localStorage is cheap, so
 * the UI can decide whether a wallet exists before paying the 12 MB import.
 */
export function hasBreezWallet(): boolean {
  return BREEZ_MOONPAY_CONFIGURED && readMnemonic() !== null;
}

/**
 * The sats encoded in a BOLT-11 human-readable part (`lnbc10u1…`), or null
 * when the invoice is amountless. Spark's `prepareSendPayment` needs an
 * explicit amount, so callers must supply one for amountless invoices.
 */
export function bolt11AmountSats(invoice: string): number | null {
  const match = invoice
    .trim()
    .toLowerCase()
    .match(/^ln(bc|tb)(\d+)([munp])?1/);
  if (!match) return null;
  const value = Number(match[2]);
  if (!Number.isFinite(value) || value <= 0) return null;
  const millisats =
    match[3] === "m"
      ? value * 100_000_000
      : match[3] === "u"
        ? value * 100_000
        : match[3] === "n"
          ? value * 100
          : match[3] === "p"
            ? value / 10
            : value * 100_000_000;
  return Math.round(millisats / 1000);
}

/**
 * A BOLT-11 invoice that pays directly into the browser wallet, so receiving
 * stays self-custodial: it pays directly into the browser wallet.
 */
export async function receiveLightningInvoice(
  amountSats: number,
  memo = "Crays deposit",
): Promise<{ invoice: string }> {
  const sdk = await getBreezSdk();
  const response = await sdk.receivePayment({
    paymentMethod: { type: "bolt11Invoice", description: memo, amountSats },
  });
  return { invoice: response.paymentRequest };
}

/**
 * The wallet's own self-custodial Lightning address: the account's npub
 * registered as the username on Breez's LNURL server. Payments to it settle
 * directly into the Spark wallet — no mint, no profile, no third party.
 *
 * Idempotent: a wallet that already registered an address keeps it.
 */
export async function ensureLightningAddress(npub: string): Promise<LightningAddressInfo> {
  const sdk = await getBreezSdk();
  const existing = await sdk.getLightningAddress();
  if (existing) return existing;
  const register = (username: string) =>
    sdk.registerLightningAddress({ username, description: "Crays Lightning Wallet" });
  if (await sdk.checkLightningAddressAvailable({ username: npub })) {
    return register(npub);
  }
  // The npub username is taken on this domain (e.g. registered from another
  // install whose wallet was reset): fall back to a distinguishable variant.
  return register(`${npub.slice(0, 40)}-${randomHex(4)}`);
}

/**
 * Wait until the wallet holds at least `targetSats`.
 *
 * MoonPay's on-chain delivery can take a few minutes to confirm, so this is
 * intentionally patient. The caller can abort it or retry later; the purchase
 * stays recorded either way.
 */
export async function waitForBreezBalance(
  targetSats: number,
  options: {
    timeoutMs?: number;
    signal?: AbortSignal;
    onBalance?: (balance: number) => void;
  } = {},
): Promise<number> {
  const sdk = await getBreezSdk();
  const deadline = Date.now() + (options.timeoutMs ?? 5 * 60 * 1000);
  let lastBalance = 0;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const info = await sdk.getInfo({ ensureSynced: true });
      lastBalance = info.balanceSats;
      options.onBalance?.(lastBalance);
      if (lastBalance >= targetSats) return lastBalance;
      await claimMatureDeposits(sdk);
    } catch {
      // Transient sync errors shouldn't cancel a purchase that is in flight.
    }
    await delay(4000, options.signal);
  }

  return lastBalance;
}

export type BreezInvoicePayment = {
  paymentId: string;
  amountSats: number;
  feesSats: number;
  status: string;
};

async function waitForPaymentCompletion(sdk: BreezSdk, paymentId: string) {
  const deadline = Date.now() + 60_000;
  let payment = (await sdk.getPayment({ paymentId })).payment;
  while (payment.status === "pending" && Date.now() < deadline) {
    await delay(2500);
    payment = (await sdk.getPayment({ paymentId })).payment;
  }
  return payment;
}

/**
 * Pay a BOLT-11 invoice from the card wallet. The idempotency key makes a
 * resumed checkout safe: repeating the same order never pays twice.
 */
export async function payLightningInvoice(input: {
  invoice: string;
  amountSats: number;
  idempotencyKey: string;
}): Promise<BreezInvoicePayment> {
  const sdk = await getBreezSdk();
  const prepareResponse = await sdk.prepareSendPayment({
    paymentRequest: { type: "input", input: input.invoice },
    amount: BigInt(input.amountSats),
    // The creator receives the full invoice amount; routing fees come out of
    // the buffer funded by MoonPay.
    feePolicy: "feesExcluded",
  });
  const sent = await sdk.sendPayment({
    prepareResponse,
    idempotencyKey: input.idempotencyKey,
  });
  const payment = await waitForPaymentCompletion(sdk, sent.payment.id);
  if (payment.status === "failed") {
    throw new Error("The card wallet couldn't complete the Lightning payment. Please try again.");
  }
  return {
    paymentId: payment.id,
    amountSats: Number(payment.amount),
    feesSats: Number(payment.fees),
    status: payment.status,
  };
}

/** Best-effort wallet event subscription for future UI indicators. */
export async function onBreezEvent(listener: (event: SdkEvent) => void) {
  const sdk = await getBreezSdk();
  const id = await sdk.addEventListener({ onEvent: listener });
  return () => {
    void sdk.removeEventListener(id).catch(() => undefined);
  };
}
