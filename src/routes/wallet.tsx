import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { ArrowDownLeft, ArrowUpRight, Zap, Plus, QrCode, CreditCard } from "lucide-react";
import { useUI } from "@/components/modals/ui-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Crays" },
      { name: "description", content: "Your Lightning wallet — send, receive and zap creators with one tap." },
    ],
  }),
  component: WalletPage,
});

const txs = [
  { id: "1", kind: "in", who: "Jack Dorsey", handle: "@jack", note: "Zap · macro essay", amount: "+21,000", usd: "$13.42", time: "2m ago" },
  { id: "2", kind: "out", who: "Lyn Alden", handle: "@lyn", note: "Subscription · Macro insider", amount: "-21,000", usd: "$13.42", time: "1h ago" },
  { id: "3", kind: "in", who: "Aura Labs", handle: "@aura", note: "Zap · article unlock", amount: "+5,000", usd: "$3.20", time: "3h ago" },
  { id: "4", kind: "in", who: "Pierre R.", handle: "@pierre", note: "Zap", amount: "+1,000", usd: "$0.64", time: "Yesterday" },
  { id: "5", kind: "out", who: "Coffee shop", handle: "lightning@bitrefill", note: "Topup", amount: "-12,400", usd: "$7.93", time: "Yesterday" },
  { id: "6", kind: "in", who: "Marty Bent", handle: "@marty", note: "Zap · podcast", amount: "+2,100", usd: "$1.34", time: "2d ago" },
];

function WalletPage() {
  const ui = useUI();
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
        <div className="relative grid gap-8 sm:grid-cols-[1.2fr_1fr] sm:items-center">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Balance
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <h2 className="text-[40px] font-semibold tracking-tight sm:text-[52px]">42,069</h2>
              <span className="text-[14px] font-medium text-zinc-400">sats</span>
            </div>
            <p className="mt-1 text-[13px] text-zinc-400">
              ≈ <span className="text-zinc-200">$26.94 USD</span> · <span className="text-emerald-400">+4.2%</span> 24h
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Action label="Receive" icon={ArrowDownLeft} primary onClick={ui.openReceive} />
              <Action label="Send" icon={ArrowUpRight} onClick={ui.openSend} />
              <Action label="Zap" icon={Zap} onClick={() => ui.openZap()} />
              <Action label="Top up" icon={CreditCard} onClick={ui.openTopUp} />
            </div>
          </div>
          <div className="relative ml-auto grid place-items-center rounded-2xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur-sm">
            <div className="grid size-40 place-items-center rounded-xl bg-white p-3">
              <FauxQR />
            </div>
            <p className="mt-3 max-w-[180px] truncate text-center font-mono text-[10.5px] text-zinc-400">
              you@crays.net
            </p>
            <button
              onClick={() => { navigator.clipboard?.writeText("you@crays.net"); toast.success("Lightning address copied"); }}
              className="mt-1 text-[10.5px] font-semibold text-amber-300 hover:underline"
            >
              Copy lightning address
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Received (30d)" value="184k" suffix="sats" trend="+22%" />
        <StatCard label="Sent (30d)" value="92k" suffix="sats" trend="+8%" />
        <StatCard label="Zaps sent" value="412" trend="+14%" />
        <StatCard label="Subscriptions" value="3" sub="36k sats / mo" />
      </section>

      {/* Transactions */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Recent activity
          </h3>
          <div className="flex items-center gap-1 rounded-full bg-zinc-100/80 p-0.5 text-[11px] font-medium">
            <button className="rounded-full bg-white px-2.5 py-0.5 text-zinc-900 shadow-sm">All</button>
            <button className="rounded-full px-2.5 py-0.5 text-zinc-500">Zaps</button>
            <button className="rounded-full px-2.5 py-0.5 text-zinc-500">Subs</button>
          </div>
        </header>
        <ul className="divide-y divide-zinc-100">
          {txs.map((t) => {
            const incoming = t.kind === "in";
            return (
              <li
                key={t.id}
                onClick={() => ui.openTxDetail({ ...t, kind: t.kind as "in" | "out" })}
                className="flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50/80"
              >
                <div className="relative">
                  <AvatarTile seed={t.who} size={38} />
                  <span
                    className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-white ${
                      incoming ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {incoming ? (
                      <ArrowDownLeft className="size-3" strokeWidth={2.6} />
                    ) : (
                      <ArrowUpRight className="size-3" strokeWidth={2.6} />
                    )}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-zinc-900">{t.who}</p>
                  <p className="truncate text-[11.5px] text-zinc-500">{t.note}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-[13px] font-semibold tabular-nums ${
                      incoming ? "text-emerald-600" : "text-zinc-900"
                    }`}
                  >
                    {t.amount} <span className="text-[10.5px] font-medium text-zinc-400">sats</span>
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {t.usd} · {t.time}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
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
  suffix,
  trend,
  sub,
}: {
  label: string;
  value: string;
  suffix?: string;
  trend?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-2 text-[20px] font-semibold tracking-tight text-zinc-900">
        {value}
        {suffix && <span className="ml-1 text-[11px] font-medium text-zinc-400">{suffix}</span>}
      </p>
      {trend && <p className="mt-1 text-[11px] font-semibold text-emerald-600">{trend}</p>}
      {sub && <p className="mt-1 text-[11px] text-zinc-400">{sub}</p>}
    </div>
  );
}

function FauxQR() {
  // Decorative pseudo-QR
  const cells = Array.from({ length: 11 * 11 }, (_, i) => {
    const x = i % 11;
    const y = Math.floor(i / 11);
    // corner finders
    const corner =
      (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    const on = corner || ((x * 73 + y * 131 + (x ^ y) * 17) % 7 < 3);
    return on;
  });
  return (
    <div className="grid h-full w-full grid-cols-11 gap-[1.5px]">
      {cells.map((on, i) => (
        <div key={i} className={`rounded-[2px] ${on ? "bg-zinc-900" : "bg-white"}`} />
      ))}
    </div>
  );
}

// Silence unused-import warnings for icons referenced via props above.
void Plus;
void QrCode;
