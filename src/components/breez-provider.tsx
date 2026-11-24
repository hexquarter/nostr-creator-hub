import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { randomHex } from "@/lib/nostr/signer";
import { useNostr } from "@/components/nostr-provider";
import {
  BREEZ_MOONPAY_CONFIGURED,
  bolt11AmountSats,
  ensureLightningAddress,
  getBreezBalance,
  getBreezSdk,
  hasBreezWallet,
  payLightningInvoice,
  receiveLightningInvoice,
} from "@/lib/payments/breez-wallet";

export type BreezState = {
  /** A seed exists locally and the Breez SDK is configured. */
  available: boolean;
  /** Card checkout is configured, so a wallet can be created on demand. */
  canCreate: boolean;
  /** True while the seed is being created and the SDK is connecting. */
  creating: boolean;
  loading: boolean;
  balanceSats: number | null;
  /**
   * The wallet's own self-custodial Lightning address (the account's npub
   * registered on Breez's LNURL server), or null until it is set up.
   */
  address: string | null;
  error?: string;
  /** Create the seed and connect the wallet (idempotent, reuses a seed). */
  create: () => Promise<void>;
  /** Connect (or reuse) the browser wallet and read its balance. */
  refresh: () => Promise<number | null>;
  /** Pay a BOLT-11 invoice from the browser wallet; refreshes the balance. */
  pay: (input: { invoice: string; amountSats?: number }) => Promise<void>;
  /** A BOLT-11 invoice that pays into the self-custodial browser wallet. */
  receive: (amountSats: number, memo?: string) => Promise<{ invoice: string }>;
};

const BreezContext = createContext<BreezState | null>(null);

export function useBreez() {
  const ctx = useContext(BreezContext);
  if (!ctx) throw new Error("useBreez must be used within BreezProvider");
  return ctx;
}

export function BreezProvider({ children }: { children: ReactNode }) {
  const nostr = useNostr();
  const canCreate = BREEZ_MOONPAY_CONFIGURED;
  const [available, setAvailable] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const inFlight = useRef<Promise<number | null> | null>(null);
  // The username comes from the account's npub; the wallet itself is
  // device-local, so the address survives account switches.
  const npub = nostr.account?.npub ?? null;

  // The seed only lives in localStorage, so this check is cheap and never
  // touches the 12 MB Breez SDK — it is imported by refresh()/pay() only.
  useEffect(() => {
    setAvailable(hasBreezWallet());
  }, []);

  // Register (or look up) the wallet's npub-based Lightning address once the
  // wallet is open and an account is signed in.
  useEffect(() => {
    if (!available || !npub) return;
    let cancelled = false;
    void ensureLightningAddress(npub)
      .then((info) => {
        if (!cancelled) setAddress(info.lightningAddress);
      })
      .catch(() => {
        // Non-fatal: the wallet works without the address; the next visit
        // retries registration.
      });
    return () => {
      cancelled = true;
    };
  }, [available, npub]);

  const refresh = useCallback(async (): Promise<number | null> => {
    if (!hasBreezWallet()) {
      setAvailable(false);
      return null;
    }
    setAvailable(true);
    // Concurrent callers (wallet page + a modal opening) share one connect.
    if (inFlight.current) return inFlight.current;
    setLoading(true);
    const run = (async () => {
      try {
        const balance = await getBreezBalance();
        setBalanceSats(balance);
        setError(undefined);
        return balance;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load the Crays wallet.");
        return null;
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  const pay = useCallback(
    async (input: { invoice: string; amountSats?: number }) => {
      const amount = input.amountSats ?? bolt11AmountSats(input.invoice);
      if (!amount || amount <= 0) {
        throw new Error("Enter an amount in sats.");
      }
      await payLightningInvoice({
        invoice: input.invoice,
        amountSats: amount,
        idempotencyKey: `crays-send:${randomHex(16)}`,
      });
      void refresh();
    },
    [refresh],
  );

  /** Create the seed and connect the wallet. Idempotent: a later connect
   *  reuses the stored seed, so this never resets an existing wallet. */
  const create = useCallback(async (): Promise<void> => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      await getBreezSdk();
      setAvailable(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the wallet.");
    } finally {
      setCreating(false);
    }
  }, [canCreate, creating, refresh]);

  const receive = useCallback(
    async (amountSats: number, memo = "Crays deposit") => receiveLightningInvoice(amountSats, memo),
    [],
  );

  const value = useMemo<BreezState>(
    () => ({
      available,
      canCreate,
      creating,
      loading,
      balanceSats,
      address,
      error,
      create,
      refresh,
      pay,
      receive,
    }),
    [
      available,
      canCreate,
      creating,
      loading,
      balanceSats,
      address,
      error,
      create,
      refresh,
      pay,
      receive,
    ],
  );

  return <BreezContext.Provider value={value}>{children}</BreezContext.Provider>;
}
