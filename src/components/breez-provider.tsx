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
import {
  bolt11AmountSats,
  getBreezBalance,
  hasBreezWallet,
  payLightningInvoice,
} from "@/lib/payments/breez-wallet";

export type BreezState = {
  /** A seed exists locally and the Breez SDK is configured. */
  available: boolean;
  loading: boolean;
  balanceSats: number | null;
  error?: string;
  /** Connect (or reuse) the browser wallet and read its balance. */
  refresh: () => Promise<number | null>;
  /** Pay a BOLT-11 invoice from the browser wallet; refreshes the balance. */
  pay: (input: { invoice: string; amountSats?: number }) => Promise<void>;
};

const BreezContext = createContext<BreezState | null>(null);

export function useBreez() {
  const ctx = useContext(BreezContext);
  if (!ctx) throw new Error("useBreez must be used within BreezProvider");
  return ctx;
}

export function BreezProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const inFlight = useRef<Promise<number | null> | null>(null);

  // The seed only lives in localStorage, so this check is cheap and never
  // touches the 12 MB Breez SDK — it is imported by refresh()/pay() only.
  useEffect(() => {
    setAvailable(hasBreezWallet());
  }, []);

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

  const value = useMemo<BreezState>(
    () => ({ available, loading, balanceSats, error, refresh, pay }),
    [available, loading, balanceSats, error, refresh, pay],
  );

  return <BreezContext.Provider value={value}>{children}</BreezContext.Provider>;
}
