import { nip98 } from "nostr-tools";
import type { AppSigner } from "./signer";

/**
 * npub.cash (npubcash) gives every Nostr key a Lightning address backed by a
 * Cashu mint. It does not hold a balance: it records the mint quote behind
 * every payment made to your address, and a Cashu wallet mints the proofs
 * directly from that mint. This client authenticates as the user with NIP-98
 * and reads those quotes.
 *
 * @see https://docs.npub.cash
 */

const BASE = "https://npub.cash";
const AUTH_URL = `${BASE}/api/v2/auth/nip98`;
/** The JWT is valid for 30 minutes; refresh with headroom. */
const JWT_TTL_MS = 20 * 60 * 1000;

export type NpubcashQuoteState = "PAID" | "ISSUED" | "INFLIGHT" | "UNPAID";

export type NpubcashQuote = {
  createdAt: number;
  paidAt?: number;
  expiresAt?: number;
  mintUrl: string;
  quoteId: string;
  request: string;
  /** Invoice amount in sats. */
  amount: number;
  state: NpubcashQuoteState;
  locked: boolean;
};

export type NpubcashUser = {
  pubkey: string;
  mintUrl: string;
  lockQuote: boolean;
};

type NpcResponse<T> = { error: boolean; data?: T; message?: string };

/** Short-lived JWT per signer identity, so page navigations don't re-sign. */
const jwtCache = new Map<string, { token: string; fetchedAt: number }>();

async function authHeaders(signer: AppSigner): Promise<Record<string, string>> {
  const pubkey = await signer.getPublicKey();
  const cached = jwtCache.get(pubkey);
  if (cached && Date.now() - cached.fetchedAt < JWT_TTL_MS) {
    return { Authorization: `Bearer ${cached.token}` };
  }
  // The auth endpoint itself is NIP-98 protected; it returns the JWT.
  const nip98Token = await nip98.getToken(
    AUTH_URL,
    "GET",
    (template) => signer.signEvent(template),
    true,
  );
  const res = await fetch(AUTH_URL, { headers: { Authorization: nip98Token } });
  if (!res.ok) {
    throw new Error(`npub.cash rejected the sign-in (${res.status}).`);
  }
  const payload = (await res.json()) as NpcResponse<{ token: string }>;
  const token = payload.data?.token;
  if (!token) throw new Error("npub.cash didn't return a session token.");
  jwtCache.set(pubkey, { token, fetchedAt: Date.now() });
  return { Authorization: `Bearer ${token}` };
}

async function apiGet<T>(path: string, signer: AppSigner): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: await authHeaders(signer),
  });
  if (!res.ok) {
    throw new Error(`npub.cash request failed (${res.status}).`);
  }
  const payload = (await res.json()) as NpcResponse<T>;
  if (payload.error || payload.data === undefined) {
    throw new Error(payload.message || "npub.cash returned an error.");
  }
  return payload.data;
}

/** The signed-in user's npub.cash settings, including their chosen mint. */
export async function fetchNpubcashUser(signer: AppSigner): Promise<NpubcashUser> {
  const { user } = await apiGet<{ user: NpubcashUser }>("/api/v2/user/info", signer);
  return user;
}

/**
 * Every mint quote recorded for this Nostr key, paginated. Quotes remain in
 * the history after they are minted, so callers must track processed ones.
 */
export async function fetchNpubcashQuotes(signer: AppSigner, limit = 50): Promise<NpubcashQuote[]> {
  const all: NpubcashQuote[] = [];
  let offset = 0;
  for (;;) {
    const { quotes, total } = await apiGet<{
      quotes: NpubcashQuote[];
      total: number;
    }>(`/api/v2/wallet/quotes?limit=${limit}&offset=${offset}`, signer);
    all.push(...quotes);
    offset += quotes.length;
    if (quotes.length === 0 || offset >= total) break;
  }
  return all;
}
