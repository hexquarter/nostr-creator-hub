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
  id: "moonpay" | "usdc" | "usdt";
  label: string;
  description: string;
  /** External checkout URL for fiat providers. */
  href?: string;
  /** Stablecoin deposit address. */
  address?: string;
  /** Network the stablecoin must be sent on. */
  network?: string;
  /**
   * Canonical payment request for the QR, following the Spark SDK cross-chain
   * formats (EIP-681, Solana Pay, Tron TRC-20).
   */
  uri?: string;
};

/** Token identifiers from the Spark cross-chain guide's supported routes. */
const USDC_SOLANA_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_SOLANA_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const USDT_TRON_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const isEvmAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);
const isTronAddress = (address: string) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);

/**
 * Build a wallet-scannable request using the canonical URI formats from the
 * Spark cross-chain guide:
 * https://sdk-doc-spark.breez.technology/guide/cross_chain.html
 *
 * - EVM: EIP-681 ERC-20 transfer, with the token contract and chain id.
 * - Solana: Solana Pay, with `spl-token` and the UI amount.
 * - Tron: TRC-20 form, with `token` and 6-decimal base units.
 *
 * Stablecoins use 6 decimals, so $50 is 50_000_000 base units.
 */
function stablecoinUri(options: {
  asset: "USDC" | "USDT";
  address: string;
  network?: string;
  token?: string;
  chainId?: string;
  usd: number;
}): string {
  const { asset, address, network = "", token, chainId, usd } = options;
  const baseUnits = Math.round(usd * 1_000_000).toString();
  const label = network.toLowerCase();

  // Trust the configured network label first; a Solana address can start with
  // "T" and look like a Tron address, so sniffing alone is ambiguous.
  const isTron = label.includes("tron") || (!label && isTronAddress(address));
  const isEvm =
    isEvmAddress(address) || /(evm|ethereum|base|arbitrum|optimism|polygon|avalanche)/.test(label);

  if (isTron) {
    const contract = token || (asset === "USDT" ? USDT_TRON_CONTRACT : "");
    const params = new URLSearchParams({ amount: baseUnits });
    if (contract) params.set("token", contract);
    return `tron:${address}?${params.toString()}`;
  }
  if (isEvm) {
    if (!token || !chainId) return address;
    return `ethereum:${token}@${chainId}/transfer?address=${address}&uint256=${baseUnits}`;
  }
  const mint = token || (asset === "USDC" ? USDC_SOLANA_MINT : USDT_SOLANA_MINT);
  const params = new URLSearchParams({ amount: String(usd) });
  if (mint) params.set("spl-token", mint);
  return `solana:${address}?${params.toString()}`;
}

/**
 * Non-Lightning ways to pay for Crays premium.
 *
 * MoonPay follows the Breez Spark SDK "buy bitcoin" flow: the provider returns
 * a URL to open in the browser, and the buyer pays the Lightning invoice
 * afterwards. The full SDK widget needs a Breez API key and a native/server
 * runtime, so the static web build deep-links the hosted checkout instead.
 *
 * USDC and USDT use the cross-chain receive formats from the Spark SDK guide.
 * A static site can't call the SDK's `receive_payment` (which returns a
 * per-quote deposit address and reconciles status in the background), so the
 * Crays addresses are configured at build time and the QR carries the network,
 * token and amount. Transfers can't be verified from the browser, so this path
 * asks the buyer to confirm only after sending.
 */
export function cardOnramps(usd = CREATOR_PASS_USD): CardOnramp[] {
  const env = import.meta.env;
  const moonpay = (env.VITE_CRAYS_MOONPAY_URL as string | undefined)?.trim();
  const usdc = (env.VITE_CRAYS_USDC_ADDRESS as string | undefined)?.trim();
  const usdcNetwork = (env.VITE_CRAYS_USDC_NETWORK as string | undefined)?.trim() || "Solana";
  const usdcToken = (env.VITE_CRAYS_USDC_TOKEN as string | undefined)?.trim();
  const usdcChainId = (env.VITE_CRAYS_USDC_CHAIN_ID as string | undefined)?.trim();
  const usdt = (env.VITE_CRAYS_USDT_ADDRESS as string | undefined)?.trim();
  const usdtNetwork = (env.VITE_CRAYS_USDT_NETWORK as string | undefined)?.trim() || "Tron";
  const usdtToken = (env.VITE_CRAYS_USDT_TOKEN as string | undefined)?.trim();
  const usdtChainId = (env.VITE_CRAYS_USDT_CHAIN_ID as string | undefined)?.trim();
  const moonpayPrefill = `https://www.moonpay.com/buy/btc?baseCurrencyAmount=${Math.round(
    usd,
  )}&baseCurrencyCode=usd&defaultCurrencyCode=btc`;

  const onramps: CardOnramp[] = [
    {
      id: "moonpay",
      label: "MoonPay",
      description: "Buy Bitcoin with Apple Pay, Google Pay or a card.",
      href: moonpay || moonpayPrefill,
    },
  ];
  if (usdc) {
    onramps.push({
      id: "usdc",
      label: "USDC",
      description: `Send USDC on ${usdcNetwork}.`,
      address: usdc,
      network: usdcNetwork,
      uri: stablecoinUri({
        asset: "USDC",
        address: usdc,
        network: usdcNetwork,
        token: usdcToken,
        chainId: usdcChainId,
        usd,
      }),
    });
  }
  if (usdt) {
    onramps.push({
      id: "usdt",
      label: "USDT",
      description: `Send USDT on ${usdtNetwork}.`,
      address: usdt,
      network: usdtNetwork,
      uri: stablecoinUri({
        asset: "USDT",
        address: usdt,
        network: usdtNetwork,
        token: usdtToken,
        chainId: usdtChainId,
        usd,
      }),
    });
  }
  if (!usdc && !usdt) {
    onramps.push({
      id: "usdc",
      label: "USDC / USDT",
      description: "Stablecoin checkout isn't set up yet.",
    });
  }
  return onramps;
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
