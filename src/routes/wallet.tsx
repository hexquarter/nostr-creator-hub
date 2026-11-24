import { createFileRoute } from "@tanstack/react-router";
import { JSX, useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { PageShell } from "@/components/page-shell";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
  CreditCard,
  Loader2,
  RefreshCw,
  Wallet,
  Copy,
} from "lucide-react";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { useBreez } from "@/components/breez-provider";
import { useBtcPrice, formatUsd, formatSats } from "@/lib/nostr/price";
import type { NwcTransaction } from "@/lib/nostr/nwc";
import { timeAgo } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Crays" },
      {
        name: "description",
        content: "Your Lightning wallet — send, receive and zap creators with one tap.",
      },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const ui = useUI();
  const nostr = useNostr();
  const breez = useBreez();
  const price = useBtcPrice();
  const [transactions, setTransactions] = useState<NwcTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [ownAddress, setOwnAddress] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);

  const wallet = nostr.wallet;
  const balance = wallet.balanceSats;
  // The user's own Lightning address, read from their Nostr profile.
  const address = wallet.address;
  // Leftovers from the old hosted setup: an npub.cash address is custodial,
  // so it should be replaced with the user's own wallet address.
  const legacyNpubAddress = Boolean(address?.endsWith("@npub.cash"));
  // The browser's Breez wallet is the primary, fully self-custodial wallet:
  // its balance, sends, zaps and receive invoices all come from it. It also
  // creates itself on first visit — no manual setup step.
  const breezActive = breez.available || breez.creating;
  // A NIP-47 wallet the user connected stays visible when no Crays wallet
  // exists.
  const nwcActive = !breezActive && wallet.connected;

  const saveAddress = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSavingAddress(true);
    try {
      await nostr.updateProfile({ lud16: trimmed });
      setOwnAddress("");
      setEditingAddress(false);
      toast.success("Lightning address saved to your profile");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const loadTransactions = useCallback(async () => {
    if (!wallet.connected) return;
    setLoadingTx(true);
    try {
      setTransactions(await nostr.listTransactions());
    } finally {
      setLoadingTx(false);
    }
  }, [wallet.connected, nostr]);

  useEffect(() => {
    void loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected]);

  // A connected wallet whose balance failed during restore (relay timeouts do
  // happen) should retry once this page opens, instead of showing "—".
  useEffect(() => {
    if (!wallet.connected || balance != null) return;
    void nostr.refreshBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected]);

  // Open the browser's Breez wallet so its balance shows up here, creating it
  // on first visit (the seed is generated locally; no manual step). Cheap
  // no-op when card checkout isn't configured.
  useEffect(() => {
    if (breez.available) {
      void breez.refresh();
      return;
    }
    if (breez.canCreate) void breez.create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breez.available]);

  return (
    <PageShell title="Wallet" subtitle="Self-custodial Lightning — your keys, your sats.">
      {/* Balance card */}
      <section className="relative overflow-hidden rounded-2xl bg-zinc-900 p-6 text-white shadow-elevated sm:p-8">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(at 80% 0%, oklch(0.7 0.2 50 / 0.5) 0, transparent 55%), radial-gradient(at 0% 100%, oklch(0.55 0.22 260 / 0.4) 0, transparent 55%)",
          }}
        />
        <div className="relative sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                Balance
              </p>
              {breezActive ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  Crays wallet
                </span>
              ) : wallet.connected ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                  {wallet.alias ?? "Connected"}
                </span>
              ) : address ? (
                <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                  External
                </span>
              ) : null}
            </div>
            {breezActive ? (
              <div className="mt-2 flex items-baseline gap-2">
                <h2 className="text-[40px] font-semibold tracking-tight sm:text-[52px]">
                  {breez.balanceSats == null
                    ? breez.loading || breez.creating
                      ? "…"
                      : "—"
                    : breez.balanceSats.toLocaleString()}
                </h2>
                <span className="text-[14px] font-medium text-zinc-400">sats</span>
              </div>
            ) : wallet.connected ? (
              <div className="mt-2 flex items-baseline gap-2">
                <h2 className="text-[40px] font-semibold tracking-tight sm:text-[52px]">
                  {balance == null ? (wallet.loading ? "…" : "—") : balance.toLocaleString()}
                </h2>
                <span className="text-[14px] font-medium text-zinc-400">sats</span>
              </div>
            ) : address ? (
              // Without a self-custodial or NIP-47 wallet, the sats live in
              // an external wallet — show where instead of a balance-shaped
              // dash.
              <h2 className="mt-2 text-[24px] font-semibold tracking-tight sm:text-[30px]">
                Held in your {address.split("@")[1] ?? "external"} wallet
              </h2>
            ) : (
              <div className="mt-2 flex items-baseline gap-2">
                <h2 className="text-[40px] font-semibold tracking-tight sm:text-[52px]">—</h2>
                <span className="text-[14px] font-medium text-zinc-400">sats</span>
              </div>
            )}
            <p className="mt-1 text-[13px] text-zinc-400">
              {breezActive ? (
                <>
                  ≈{" "}
                  <span className="text-zinc-200">
                    {formatUsd(
                      breez.balanceSats != null && price
                        ? (breez.balanceSats / 100_000_000) * price.usd
                        : null,
                    )}
                  </span>{" "}
                  USD
                </>
              ) : wallet.connected ? (
                <>
                  ≈{" "}
                  <span className="text-zinc-200">
                    {formatUsd(
                      balance != null && price ? (balance / 100_000_000) * price.usd : null,
                    )}
                  </span>{" "}
                  {price ? "USD · live pricestr feed" : "· waiting for the BTC price"}
                </>
              ) : address ? (
                legacyNpubAddress ? (
                  "Your profile still points at a custodial npub.cash address — replace it with your own wallet's address."
                ) : (
                  `Held at ${address.split("@")[1] ?? "your own"} address — connect it with Nostr Wallet Connect to spend here.`
                )
              ) : nostr.account ? (
                "Your self-custodial wallet is being prepared, or add your own Lightning address."
              ) : (
                "Sign in to set up your wallet."
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Action label="Receive" icon={ArrowDownLeft} primary onClick={ui.openReceive} />
              <Action label="Send" icon={ArrowUpRight} onClick={ui.openSend} />
              <Action label="Zap" icon={Zap} onClick={() => ui.openZap()} />
              <Action label="Top up" icon={CreditCard} onClick={ui.openTopUp} />
            </div>
            {breez.creating && (
              <p className="mt-3 text-[12px] font-medium text-zinc-300">
                <Loader2 className="mr-1 inline size-3 animate-spin" /> Preparing your wallet…
              </p>
            )}
            {wallet.error && <p className="mt-3 text-[11.5px] text-rose-300">{wallet.error}</p>}
            {breezActive && breez.error && (
              <p className="mt-3 text-[11.5px] text-rose-300">{breez.error}</p>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Wallet"
          value={
            breezActive
              ? "Crays wallet"
              : wallet.connected
                ? (wallet.alias ?? "Connected")
                : address
                  ? `External (${address.split("@")[1] ?? "own"})`
                  : "Not connected"
          }
        />
        <StatCard
          label="BTC / USD"
          value={price ? formatUsd(price.usd, 0) : "—"}
          sub={
            price ? (
              <span className="text-xs text-zinc-500">
                Price by{" "}
                <a href="https://pricestr.xyz" target="_blank" className="underline">
                  pricestr.xyz
                </a>
              </span>
            ) : undefined
          }
        />
      </section>

      <WalletConnectCard />

      {/* Transactions */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Recent activity
          </h3>
          <button
            onClick={() => void loadTransactions()}
            disabled={!wallet.connected || loadingTx}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100/80 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 disabled:opacity-50"
          >
            {loadingTx ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}{" "}
            Refresh
          </button>
        </header>
        {!wallet.connected ? (
          <p className="px-5 py-8 text-center text-[12.5px] text-zinc-500">
            {address
              ? "You can receive sats at your Lightning address. Connect a NIP-47 wallet to see payment history and send sats."
              : "Create your self-custodial wallet or connect a NIP-47 wallet to see payment history."}
          </p>
        ) : transactions.length === 0 ? (
          <p className="px-5 py-8 text-center text-[12.5px] text-zinc-500">
            {loadingTx
              ? "Loading payments…"
              : "No payments found. Zaps and invoices will appear here."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {transactions.map((tx) => {
              const incoming = tx.type === "incoming";
              const sats = Math.round(tx.amount / 1000);
              const when = tx.settled_at ?? tx.created_at;
              const description =
                tx.description || (incoming ? "Received payment" : "Sent payment");
              return (
                <li
                  key={`${tx.payment_hash ?? tx.created_at}-${tx.type}`}
                  className="flex items-center gap-4 px-5 py-3.5"
                >
                  <div
                    className={`grid size-9 place-items-center rounded-full ${incoming ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-600"}`}
                  >
                    {incoming ? (
                      <ArrowDownLeft className="size-4" strokeWidth={2.4} />
                    ) : (
                      <ArrowUpRight className="size-4" strokeWidth={2.4} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-zinc-900">
                      {description}
                    </p>
                    <p className="truncate text-[11.5px] text-zinc-500">
                      {when ? timeAgo(when) : "Just now"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-[13px] font-semibold tabular-nums ${incoming ? "text-emerald-600" : "text-zinc-900"}`}
                    >
                      {incoming ? "+" : "-"}
                      {formatSats(sats)}{" "}
                      <span className="text-[10.5px] font-medium text-zinc-400">sats</span>
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      {formatUsd(price ? (sats / 100_000_000) * price.usd : null)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageShell>
  );
}

function WalletConnectCard() {
  const nostr = useNostr();
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
      <h3 className="text-[13px] font-semibold text-zinc-900">
        Advanced · Connect an external wallet
      </h3>
      <p className="mt-1 text-[12px] text-zinc-500">
        For advanced users: connect a Nostr Wallet Connect (NIP-47) string from Alby, Zeus, Primal
        or your own node to send sats, pay invoices and zap from another wallet. The self-custodial
        Crays wallet keeps working either way.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="nostr+walletconnect://…"
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 font-mono text-[11px] text-zinc-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        <button
          disabled={!uri.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await nostr.connectWallet(uri);
              toast.success("Lightning wallet connected");
              setUri("");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Couldn't connect that wallet.");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Connect"}
        </button>
      </div>
    </section>
  );
}

function Action({
  label,
  icon: Icon,
  primary,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors ${
        primary
          ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
          : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"
      }`}
    >
      <Icon className="size-3.5" strokeWidth={2.4} /> {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | JSX.Element;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-2 truncate text-[18px] font-semibold tracking-tight text-zinc-900">
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-zinc-400">{sub}</p>}
    </div>
  );
}
