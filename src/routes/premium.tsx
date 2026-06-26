import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { Crown, Zap, Check, Sparkles, TrendingUp, Users } from "lucide-react";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Premium — Stellar" },
      { name: "description", content: "Subscribe to creators with Lightning. Unlock long-form articles, private circles, and live spaces." },
    ],
  }),
  component: Premium,
});

const tiers = [
  {
    name: "Reader",
    price: "Free",
    period: "",
    blurb: "Follow creators, send zaps, and read public posts.",
    features: ["Unlimited follows", "Send & receive zaps", "Public articles", "Encrypted DMs"],
    cta: "Current plan",
    accent: false,
  },
  {
    name: "Supporter",
    price: "$5",
    period: "/mo",
    blurb: "Unlock premium posts across every creator you follow.",
    features: ["Everything in Reader", "Premium-post bundle access", "Ad-free reading", "Bookmark collections"],
    cta: "Upgrade",
    accent: true,
  },
  {
    name: "Creator",
    price: "$19",
    period: "/mo",
    blurb: "Run a paid newsletter, host spaces, and grow a subscriber base.",
    features: ["Paid subscriber tiers", "Long-form publishing", "Spaces hosting", "Analytics dashboard"],
    cta: "Become a creator",
    accent: false,
  },
];

const subs = [
  { name: "Lyn Alden", handle: "@lyn", tier: "Macro insider", price: "21k sats / mo", renew: "Renews Dec 14" },
  { name: "Aura Labs", handle: "@aura", tier: "Builder circle", price: "5k sats / mo", renew: "Renews Dec 22" },
  { name: "Marty Bent", handle: "@marty", tier: "Mining notes", price: "10k sats / mo", renew: "Renews Jan 3" },
];

function Premium() {
  return (
    <PageShell title="Premium" subtitle="Pay creators directly. No middlemen. No platform cut.">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-zinc-900 p-6 text-white shadow-elevated sm:p-10">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(at 20% 10%, oklch(0.7 0.2 50 / 0.45) 0, transparent 50%), radial-gradient(at 90% 100%, oklch(0.55 0.22 260 / 0.4) 0, transparent 50%)",
          }}
        />
        <div className="relative grid gap-8 sm:grid-cols-[1.4fr_1fr] sm:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
              <Crown className="size-3 text-amber-300" /> Stellar Premium
            </span>
            <h2 className="mt-4 text-balance text-[28px] font-semibold leading-[1.1] tracking-tight sm:text-[36px]">
              Support the creators building the open web.
            </h2>
            <p className="mt-3 max-w-lg text-[14px] text-zinc-300">
              Subscribe with Lightning. 100% of every sat goes to the creator — no platform takes a cut, ever.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100">
                Browse creators
              </button>
              <button className="rounded-full bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/20">
                Become a creator
              </button>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <Metric icon={Users} label="Subscribers" value="142k" />
            <Metric icon={Zap} label="Paid out" value="2.4B" suffix="sats" />
            <Metric icon={TrendingUp} label="Avg. growth" value="+18%" />
          </dl>
        </div>
      </section>

      {/* Tiers */}
      <section className="grid gap-4 lg:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative flex flex-col rounded-2xl p-6 transition-shadow ${
              t.accent
                ? "bg-zinc-900 text-white shadow-elevated ring-1 ring-zinc-800"
                : "bg-white shadow-card ring-1 ring-black/5"
            }`}
          >
            {t.accent && (
              <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
                <Sparkles className="size-2.5" /> Popular
              </span>
            )}
            <h3 className={`text-[14px] font-semibold ${t.accent ? "text-white" : "text-zinc-900"}`}>{t.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className={`text-[32px] font-semibold tracking-tight ${t.accent ? "text-white" : "text-zinc-900"}`}>
                {t.price}
              </span>
              <span className={`text-[12px] ${t.accent ? "text-zinc-400" : "text-zinc-500"}`}>{t.period}</span>
            </div>
            <p className={`mt-2 text-[12.5px] ${t.accent ? "text-zinc-300" : "text-zinc-500"}`}>{t.blurb}</p>
            <ul className="my-6 space-y-2.5">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[12.5px]">
                  <Check className={`mt-0.5 size-3.5 shrink-0 ${t.accent ? "text-amber-300" : "text-emerald-500"}`} strokeWidth={3} />
                  <span className={t.accent ? "text-zinc-200" : "text-zinc-700"}>{f}</span>
                </li>
              ))}
            </ul>
            <button
              className={`mt-auto rounded-xl py-2.5 text-[13px] font-semibold transition-colors ${
                t.accent
                  ? "bg-white text-zinc-900 hover:bg-zinc-100"
                  : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              }`}
            >
              {t.cta}
            </button>
          </div>
        ))}
      </section>

      {/* Active subscriptions */}
      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Your subscriptions
          </h3>
          <span className="text-[11px] text-zinc-400">3 active · 36k sats / mo</span>
        </div>
        <ul className="divide-y divide-zinc-100">
          {subs.map((s) => (
            <li key={s.handle} className="flex items-center gap-4 py-3.5">
              <AvatarTile seed={s.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-zinc-900">{s.name}</p>
                <p className="truncate text-[11.5px] text-zinc-500">
                  {s.handle} · {s.tier}
                </p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[12.5px] font-semibold text-zinc-900">{s.price}</p>
                <p className="text-[11px] text-zinc-400">{s.renew}</p>
              </div>
              <button className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11.5px] font-semibold text-zinc-700 hover:bg-zinc-200">
                Manage
              </button>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur-sm">
      <Icon className="size-3.5 text-zinc-400" />
      <p className="mt-2 text-[18px] font-semibold tracking-tight">
        {value}
        {suffix && <span className="ml-1 text-[10px] font-medium text-zinc-400">{suffix}</span>}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
    </div>
  );
}
