import { useSyncExternalStore } from "react";

/**
 * The Crays badge is the platform subscription a creator pays for, monthly, to
 * unlock the paid side of Crays: selling memberships, publishing members-only
 * posts and getting paid by fans.
 *
 * It is separate from the memberships readers buy from a creator, so the two
 * prices never get mixed up: Crays bills the creator, the creator bills their
 * audience.
 */
export type CreatorPass = {
  active: boolean;
  activatedAt: number;
  expiresAt: number;
  plan: "monthly";
  /** Sats actually paid for the current period, when known. */
  sats?: number;
};

export const CREATOR_PASS_DAYS = 30;
/** Crays' monthly price, billed in sats at the live BTC rate. */
export const CREATOR_PASS_USD = 50;

/**
 * Where creators pay for the Crays badge. Point this at the real Crays
 * Lightning address (or LNURL) with `VITE_CRAYS_LIGHTNING_ADDRESS`; the
 * fallback is a placeholder until that address exists.
 */
export const CREATOR_PASS_ADDRESS =
  (import.meta.env.VITE_CRAYS_LIGHTNING_ADDRESS as string | undefined)?.trim() || "crays@npub.cash";

/**
 * False while checkout still points at the placeholder address, which cannot
 * issue invoices. The modal shows a setup notice instead of pretending a
 * payment went through.
 */
export const CREATOR_PASS_CONFIGURED = Boolean(
  (import.meta.env.VITE_CRAYS_LIGHTNING_ADDRESS as string | undefined)?.trim(),
);

export type CardOnramp = {
  id: "cashapp" | "moonpay" | "spark";
  label: string;
  description: string;
  href: string;
  /** Cash App pays the existing invoice, so it needs one first. */
  needsInvoice?: boolean;
};

/**
 * Fiat on-ramps for creators who don't hold sats yet. This mirrors the Breez
 * Spark SDK's "buy bitcoin" flow: the provider returns a URL to open in the
 * browser (or the Cash App app), and the purchase arrives over Lightning.
 *
 * The full SDK widget needs a Breez API key and a native/server runtime, so the
 * static web build deep-links the providers instead:
 * - Cash App gets the BOLT-11 invoice itself, which lets it fund the payment
 *   from a card or Cash App balance (an amountless invoice would only allow
 *   paying from an existing BTC balance).
 * - MoonPay opens its buy page with the USD amount prefilled. Replace the URL
 *   with an SDK-generated `buy_bitcoin` link to enable Apple Pay / Google Pay
 *   checkout for the Crays account.
 * - Spark opens the Spark wallet, where the user can buy Bitcoin and then pay
 *   the same invoice.
 */
export function cardOnramps(invoice?: string, usd = CREATOR_PASS_USD): CardOnramp[] {
  const env = import.meta.env;
  const cashAppOverride = (env.VITE_CRAYS_CASHAPP_URL as string | undefined)?.trim();
  const moonpay = (env.VITE_CRAYS_MOONPAY_URL as string | undefined)?.trim();
  const spark = (env.VITE_CRAYS_SPARK_URL as string | undefined)?.trim();
  const moonpayPrefill = `https://www.moonpay.com/buy/btc?baseCurrencyAmount=${Math.round(
    usd,
  )}&baseCurrencyCode=usd&defaultCurrencyCode=btc`;
  return [
    {
      id: "cashapp",
      label: "Cash App",
      description: "Pay this invoice from your Cash App balance or a debit card.",
      href:
        cashAppOverride ||
        (invoice ? `https://cash.app/launch/lightning/${invoice}` : "https://cash.app/"),
      needsInvoice: !cashAppOverride,
    },
    {
      id: "moonpay",
      label: "MoonPay",
      description: "Buy Bitcoin with Apple Pay, Google Pay or a card.",
      href: moonpay || moonpayPrefill,
    },
    {
      id: "spark",
      label: "Spark",
      description: "Buy Bitcoin in Spark, then pay the same invoice.",
      href: spark || "https://spark.money",
    },
  ];
}

const STORAGE_PREFIX = "crays.creator-pass.v2";
const LEGACY_STORAGE_KEY = "crays.creator-pass.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

/** The badge belongs to a creator account, not to the device. */
let owner: string | null = null;
let cache: CreatorPass | null | undefined;
const listeners = new Set<() => void>();

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function storageKey(pubkey: string) {
  return `${STORAGE_PREFIX}.${pubkey}`;
}

function isPass(value: unknown): value is CreatorPass {
  if (!value || typeof value !== "object") return false;
  const pass = value as Partial<CreatorPass>;
  return (
    pass.active === true &&
    typeof pass.activatedAt === "number" &&
    typeof pass.expiresAt === "number"
  );
}

function parsePass(raw: string | null): CreatorPass | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPass(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function load(pubkey: string): CreatorPass | null {
  if (!canUseStorage()) return null;
  try {
    const scoped = window.localStorage.getItem(storageKey(pubkey));
    if (scoped) return parsePass(scoped);
    // Move a badge saved before it was scoped to an account.
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const pass = parsePass(legacy);
    if (pass) window.localStorage.setItem(storageKey(pubkey), JSON.stringify(pass));
    return pass;
  } catch {
    return null;
  }
}

/** Point the store at the signed-in creator's badge. */
export function setCreatorPassOwner(pubkey: string | null) {
  if (owner === pubkey) return;
  owner = pubkey;
  cache = pubkey ? load(pubkey) : null;
  listeners.forEach((listener) => listener());
}

function persist(pass: CreatorPass | null) {
  cache = pass;
  if (owner && canUseStorage()) {
    try {
      if (pass) window.localStorage.setItem(storageKey(owner), JSON.stringify(pass));
      else window.localStorage.removeItem(storageKey(owner));
    } catch {
      // ignore quota errors
    }
  }
  listeners.forEach((listener) => listener());
}

export function getCreatorPass(): CreatorPass | null {
  if (cache === undefined) cache = owner ? load(owner) : null;
  return cache;
}

export function isCreatorPassActive(pass: CreatorPass | null = getCreatorPass()): boolean {
  return Boolean(pass && pass.active && pass.expiresAt > Date.now());
}

/**
 * Start (or extend) the monthly subscription. Renewing keeps whatever days are
 * left instead of throwing them away.
 */
export function activateCreatorPass(sats?: number): CreatorPass {
  const now = Date.now();
  const current = getCreatorPass();
  const start = isCreatorPassActive(current) && current ? current.expiresAt : now;
  const pass: CreatorPass = {
    active: true,
    activatedAt: now,
    expiresAt: start + CREATOR_PASS_DAYS * DAY_MS,
    plan: "monthly",
    sats,
  };
  persist(pass);
  return pass;
}

export function deactivateCreatorPass() {
  persist(null);
}

export function creatorPassDaysLeft(pass: CreatorPass): number {
  return Math.max(0, Math.ceil((pass.expiresAt - Date.now()) / DAY_MS));
}

const getServerSnapshot = (): CreatorPass | null => null;

export function useCreatorPass(): CreatorPass | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getCreatorPass,
    getServerSnapshot,
  );
}
