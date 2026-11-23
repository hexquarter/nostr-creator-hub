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
import { useNostr } from "@/components/nostr-provider";
import { cashuBalance, collectNpubcash, payFromNpubcash } from "@/lib/payments/cashu-wallet";
import type { AppSigner } from "@/lib/nostr/signer";

export type NpubcashState = {
  /** The signed-in account has an npub.cash wallet (always true when signed in). */
  available: boolean;
  loading: boolean;
  balanceSats: number | null;
  error?: string;
  /** Check for newly paid quotes, mint them, and return the balance. */
  refresh: () => Promise<number | null>;
  /** Pay a BOLT-11 invoice by melting npub.cash proofs; refreshes the balance. */
  pay: (input: { invoice: string; amountSats?: number }) => Promise<void>;
};

const NpubcashContext = createContext<NpubcashState | null>(null);

export function useNpubcash() {
  const ctx = useContext(NpubcashContext);
  if (!ctx) throw new Error("useNpubcash must be used within NpubcashProvider");
  return ctx;
}

export function NpubcashProvider({ children }: { children: ReactNode }) {
  const nostr = useNostr();
  const [loading, setLoading] = useState(false);
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const pubkey = nostr.account?.pubkey ?? null;
  const { signTemplate } = nostr;
  const inFlight = useRef<Promise<number | null> | null>(null);

  // The local proof store is per-account, so the balance resets with sign-in.
  useEffect(() => {
    setBalanceSats(pubkey ? cashuBalance(pubkey) : null);
    setError(undefined);
  }, [pubkey]);

  // npub.cash authenticates with NIP-98, signed by the account's own key.
  const signer = useMemo<AppSigner | null>(() => {
    if (!pubkey) return null;
    return {
      getPublicKey: async () => pubkey,
      signEvent: (template) => signTemplate(template),
    };
  }, [pubkey, signTemplate]);

  const refresh = useCallback(async (): Promise<number | null> => {
    if (!pubkey || !signer) return null;
    if (inFlight.current) return inFlight.current;
    setLoading(true);
    const run = (async () => {
      try {
        const balance = await collectNpubcash(pubkey, signer);
        setBalanceSats(balance);
        setError(undefined);
        return balance;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load your npub.cash wallet.");
        return null;
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [pubkey, signer]);

  const pay = useCallback(
    async (input: { invoice: string; amountSats?: number }) => {
      if (!pubkey || !signer) throw new Error("Sign in first.");
      await payFromNpubcash(pubkey, input.invoice, signer);
      void refresh();
    },
    [pubkey, signer, refresh],
  );

  const value = useMemo<NpubcashState>(
    () => ({ available: Boolean(pubkey), loading, balanceSats, error, refresh, pay }),
    [pubkey, loading, balanceSats, error, refresh, pay],
  );

  return <NpubcashContext.Provider value={value}>{children}</NpubcashContext.Provider>;
}
