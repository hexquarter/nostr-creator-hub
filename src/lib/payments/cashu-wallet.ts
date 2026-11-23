import { selectProofsRGLI, Wallet, type ProofLike } from "@cashu/cashu-ts";
import { fetchNpubcashQuotes, fetchNpubcashUser, type NpubcashQuote } from "@/lib/nostr/npubcash";
import type { AppSigner } from "@/lib/nostr/signer";

/**
 * A Cashu wallet for the account's npub.cash address.
 *
 * npub.cash records the mint quote behind every payment received at
 * `<npub>@npub.cash`; the sats are only truly yours once a Cashu wallet mints
 * the proofs from that quote's mint. This module:
 *
 *   1. collects paid quotes and mints them into local proofs (per account),
 *   2. keeps the unspent proofs in localStorage, grouped by mint,
 *   3. pays Lightning invoices by melting proofs at their mint (NUT-05).
 *
 * Storage is keyed by the account pubkey, like the rest of the app's
 * per-account local state, so a different session never inherits proofs.
 * Proofs are stored as plain JSON (numeric amounts); they are converted to
 * `ProofLike` inputs when talking to the mint.
 */

const PROOFS_KEY = "crays.cashu.v1";
const QUOTES_KEY = "crays.cashu.quotes.v1";
// Proofs only carry their keyset id, not the mint they came from, so a
// parallel map links each proof secret to its mint.
const MINT_MAP_KEY = "crays.cashu.mints.v1";

type StoredProof = {
  id: string;
  amount: number;
  secret: string;
  C: string;
};

type ProofStore = { v: 1; proofs: StoredProof[] };
type QuoteStore = { v: 1; processed: string[] };

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Losing the cache just means quotes are re-checked; never crash a payment.
  }
}

function loadProofs(pubkey: string): StoredProof[] {
  return readJson<ProofStore>(`${PROOFS_KEY}.${pubkey}`, { v: 1, proofs: [] }).proofs ?? [];
}

function saveProofs(pubkey: string, proofs: StoredProof[]) {
  writeJson(`${PROOFS_KEY}.${pubkey}`, { v: 1, proofs } satisfies ProofStore);
}

function mintMap(pubkey: string): Record<string, string> {
  return readJson<Record<string, string>>(`${MINT_MAP_KEY}.${pubkey}`, {});
}

function proofMint(pubkey: string, secret: string): string | null {
  return mintMap(pubkey)[secret] ?? null;
}

function rememberProofMint(pubkey: string, secret: string, mintUrl: string) {
  writeJson(`${MINT_MAP_KEY}.${pubkey}`, {
    ...mintMap(pubkey),
    [secret]: mintUrl,
  });
}

/** Quotes this device has already minted (or that were issued elsewhere). */
function processedQuotes(pubkey: string): string[] {
  return readJson<QuoteStore>(`${QUOTES_KEY}.${pubkey}`, { v: 1, processed: [] }).processed ?? [];
}

function markQuoteProcessed(pubkey: string, quote: NpubcashQuote) {
  const key = `${quote.mintUrl}|${quote.quoteId}`;
  const processed = processedQuotes(pubkey);
  if (!processed.includes(key)) {
    writeJson(`${QUOTES_KEY}.${pubkey}`, { v: 1, processed: [...processed, key] });
  }
}

/** Unspent proof balance in sats, without touching the network. */
export function cashuBalance(pubkey: string): number {
  return loadProofs(pubkey).reduce((sum, proof) => sum + (proof.amount ?? 0), 0);
}

// Wallet instances are cached per mint; loadMint is a couple of requests.
const walletCache = new Map<string, Promise<Wallet>>();

async function cashuWallet(mintUrl: string): Promise<Wallet> {
  let pending = walletCache.get(mintUrl);
  if (!pending) {
    pending = (async () => {
      const wallet = new Wallet(mintUrl, { unit: "sat" });
      await wallet.loadMint();
      return wallet;
    })();
    walletCache.set(mintUrl, pending);
    pending.catch(() => walletCache.delete(mintUrl));
  }
  return pending;
}

/**
 * Collect every newly paid mint quote and mint its proofs locally.
 * Returns the balance after collection.
 */
export async function collectNpubcash(pubkey: string, signer: AppSigner): Promise<number> {
  const quotes = await fetchNpubcashQuotes(signer);
  const processed = new Set(processedQuotes(pubkey));
  const collectable = quotes.filter(
    (quote) =>
      (quote.state === "PAID" || quote.state === "ISSUED") &&
      !processed.has(`${quote.mintUrl}|${quote.quoteId}`),
  );

  for (const quote of collectable) {
    try {
      if (quote.state === "ISSUED") {
        // Another wallet already minted this quote; nothing left to claim.
        markQuoteProcessed(pubkey, quote);
        continue;
      }
      const wallet = await cashuWallet(quote.mintUrl);
      // The mint is authoritative: only mint quotes it reports as paid.
      const status = await wallet.checkMintQuoteBolt11(quote.quoteId);
      if (status.state !== "PAID") {
        if (status.state === "ISSUED") markQuoteProcessed(pubkey, quote);
        continue; // UNPAID: the server's state can lag the mint; retry later.
      }
      const minted = await wallet.mintProofsBolt11(quote.amount, quote.quoteId);
      const stored: StoredProof[] = minted.map((proof) => ({
        id: proof.id,
        amount: proof.amount.toNumber(),
        secret: proof.secret,
        C: proof.C,
      }));
      for (const proof of stored) rememberProofMint(pubkey, proof.secret, quote.mintUrl);
      saveProofs(pubkey, [...loadProofs(pubkey), ...stored]);
      markQuoteProcessed(pubkey, quote);
    } catch {
      // One failing quote (expired, mint down) must not block the others.
    }
  }
  return cashuBalance(pubkey);
}

/** The user's preferred npub.cash mint, for display. */
export async function npubcashMintUrl(signer: AppSigner): Promise<string | null> {
  try {
    return (await fetchNpubcashUser(signer)).mintUrl || null;
  } catch {
    return null;
  }
}

// Re-exported so callers can show the user info endpoint; kept internal use.

/**
 * Pay a BOLT-11 invoice from the local npub.cash proofs.
 *
 * Proof selection prefers the mint with the largest balance, and skips mints
 * that can't cover the invoice plus fee reserve instead of failing the whole
 * payment. Spent proofs are only removed after the melt succeeds, so a
 * failed attempt never loses funds; the mint returns change as new proofs.
 */
export async function payFromNpubcash(
  pubkey: string,
  invoice: string,
  signer: AppSigner,
): Promise<{ preimage?: string }> {
  const byMint = new Map<string, StoredProof[]>();
  for (const proof of loadProofs(pubkey)) {
    const mint = proofMint(pubkey, proof.secret);
    if (!mint) continue;
    const list = byMint.get(mint) ?? [];
    list.push(proof);
    byMint.set(mint, list);
  }
  if (byMint.size === 0) {
    throw new Error("Your npub.cash wallet is empty — receive some sats first.");
  }

  const mints = [...byMint.entries()].sort(
    (a, b) =>
      b[1].reduce((sum, p) => sum + p.amount, 0) - a[1].reduce((sum, p) => sum + p.amount, 0),
  );

  let lastError: unknown = null;
  for (const [mintUrl, proofs] of mints) {
    try {
      const wallet = await cashuWallet(mintUrl);
      const meltQuote = await wallet.createMeltQuoteBolt11(invoice);
      const needed = meltQuote.amount.toNumber() + meltQuote.fee_reserve.toNumber();
      const balance = proofs.reduce((sum, proof) => sum + proof.amount, 0);
      if (balance < needed) {
        lastError = new Error("Not enough sats in your npub.cash wallet.");
        continue;
      }
      const proofInputs: ProofLike[] = proofs.map((proof) => ({
        id: proof.id,
        amount: proof.amount,
        secret: proof.secret,
        C: proof.C,
      }));
      const { send } = selectProofsRGLI(proofInputs, needed, wallet.keyChain, true);
      if (send.length === 0) {
        lastError = new Error("Not enough sats in your npub.cash wallet.");
        continue;
      }
      const result = await wallet.meltProofsBolt11(meltQuote, send);
      // Only after the mint accepted the proofs are they spent.
      const spent = new Set(send.map((proof) => String(proof.secret)));
      const kept = loadProofs(pubkey).filter((proof) => !spent.has(proof.secret));
      saveProofs(pubkey, kept);
      const map = mintMap(pubkey);
      const keptSecrets = new Set(kept.map((proof) => proof.secret));
      writeJson(
        `${MINT_MAP_KEY}.${pubkey}`,
        Object.fromEntries(Object.entries(map).filter(([secret]) => keptSecrets.has(secret))),
      );
      const change = result.change ?? [];
      if (change.length > 0) {
        for (const proof of change) {
          rememberProofMint(pubkey, String(proof.secret), mintUrl);
        }
        saveProofs(pubkey, [
          ...kept,
          ...change.map((proof) => ({
            id: String(proof.id),
            amount: proof.amount.toNumber(),
            secret: String(proof.secret),
            C: String(proof.C),
          })),
        ]);
      }
      return { preimage: result.quote?.payment_preimage ?? undefined };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The npub.cash payment didn't go through.");
}
