import { decryptJson, encryptJson, getDeviceKey } from "@/lib/crypto";

const SESSION_KEY = "crays.session.v1";
const WALLET_KEY = "crays.wallet.v1";

export type StoredSession = {
  v: 1;
  method: "passkey" | "nsec" | "bunker" | "nostr-connect" | "nip07";
  pubkey: string;
  /** Local secret key as hex. Never leaves this device. */
  nsec?: string;
  bunkerUri?: string;
  clientSecret?: string;
  prfBacked?: boolean;
};

export async function saveSession(session: StoredSession) {
  if (typeof window === "undefined") return;
  try {
    const key = await getDeviceKey();
    const value = await encryptJson(key, session);
    window.localStorage.setItem(SESSION_KEY, value);
  } catch {
    // convenience only; never block sign-in on storage
  }
}

export async function loadSession(): Promise<StoredSession | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const key = await getDeviceKey();
    return await decryptJson<StoredSession>(key, raw);
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export type StoredWallet = { v: 1; nwcUri: string };

export async function saveWalletConnection(nwcUri: string) {
  if (typeof window === "undefined") return;
  try {
    const key = await getDeviceKey();
    const value = await encryptJson(key, { v: 1, nwcUri } satisfies StoredWallet);
    window.localStorage.setItem(WALLET_KEY, value);
  } catch {
    // ignore
  }
}

export async function loadWalletConnection(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WALLET_KEY);
    if (!raw) return null;
    const key = await getDeviceKey();
    const parsed = await decryptJson<StoredWallet>(key, raw);
    return parsed?.nwcUri ?? null;
  } catch {
    return null;
  }
}

export function clearWalletConnection() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WALLET_KEY);
  } catch {
    // ignore
  }
}
