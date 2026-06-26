import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import {
  Search,
  TrendingUp,
  Flame,
  Mic,
  Newspaper,
  Bitcoin,
  Code2,
  Camera,
  Music2,
  ArrowUpRight,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Crays" },
      {
        name: "description",
        content: "Discover top creators, trending zaps, and rising voices across Bitcoin and Nostr.",
      },
    ],
  }),
  component: Discover,
});

const categories = [
  { label: "Bitcoin", icon: Bitcoin, gradient: "from-amber-400 to-orange-500", count: "12.4k" },
  { label: "Dev & Code", icon: Code2, gradient: "from-violet-500 to-fuchsia-500", count: "8.1k" },
  { label: "Photography", icon: Camera, gradient: "from-emerald-400 to-cyan-500", count: "5.6k" },
  { label: "Music", icon: Music2, gradient: "from-rose-400 to-pink-500", count: "3.2k" },
  { label: "Spaces", icon: Mic, gradient: "from-sky-400 to-indigo-500", count: "92 live" },
  { label: "Writing", icon: Newspaper, gradient: "from-zinc-700 to-zinc-900", count: "1.8k" },
];

const trending = [
  { tag: "#NIP17", topic: "Nostr Protocols", zaps: "1,402", change: "+22%" },
  { tag: "#Halving2024", topic: "Bitcoin", zaps: "8,214", change: "+8%" },
  { tag: "#Cashu", topic: "Lightning", zaps: "612", change: "+41%" },
  { tag: "#Zaps", topic: "Payments", zaps: "5,902", change: "+12%" },
  { tag: "#Privacy", topic: "Security", zaps: "892", change: "+18%" },
];

const risingCreators = [
  { name: "Pierre Rochard", handle: "@pierre", topic: "Bitcoin economics", followers: "62k", growth: "+1,204" },
  { name: "Elena Vega", handle: "@elena", topic: "Lightning UX", followers: "28k", growth: "+812" },
  { name: "Marty Bent", handle: "@marty", topic: "Mining & macro", followers: "84k", growth: "+602" },
  { name: "Aura Labs", handle: "@aura", topic: "Nostr tooling", followers: "18k", growth: "+540" },
];

function Discover() {
  return (
    <PageShell
      title="Discover"
      subtitle="Find new creators, trending zaps, and rising voices."
      actions={
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            placeholder="Search the protocol…"
            className="w-72 rounded-xl bg-white py-2 pl-9 pr-3 text-[13px] ring-1 ring-black/5 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand/40"
          />
        </div>
      }
    >
      {/* Categories */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((c) => (
          <button
            key={c.label}
            className="group flex flex-col items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-card ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-elevated"
          >
            <div
              className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm ${c.gradient}`}
            >
              <c.icon className="size-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">{c.label}</p>
              <p className="text-[11px] text-zinc-500">{c.count}</p>
            </div>
          </button>
        ))}
      </section>

      {/* Trending + Rising */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
          <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Flame className="size-3.5 text-orange-500" /> Trending now
            </h3>
            <button className="text-[11px] font-semibold text-brand hover:underline">See all</button>
          </header>
          <ol className="divide-y divide-zinc-100">
            {trending.map((t, i) => (
              <li key={t.tag} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-zinc-50/80">
                <span className="w-5 text-right text-[13px] font-semibold tabular-nums text-zinc-300">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-[10.5px] font-medium uppercase tracking-wide text-zinc-400">
                    {t.topic}
                  </p>
                  <p className="text-[13.5px] font-semibold text-zinc-900">{t.tag}</p>
                  <p className="text-[11px] text-zinc-400">{t.zaps} zaps · last 24h</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                  {t.change}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <TrendingUp className="size-3.5 text-brand" /> Rising creators
            </h3>
            <button className="text-[11px] font-semibold text-brand hover:underline">See all</button>
          </header>
          <ul className="space-y-4">
            {risingCreators.map((c) => (
              <li key={c.handle} className="flex items-center gap-3">
                <AvatarTile seed={c.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-zinc-900">{c.name}</p>
                  <p className="truncate text-[11px] text-zinc-400">
                    {c.handle} · {c.topic}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11.5px] font-semibold text-emerald-600">{c.growth}</p>
                  <p className="text-[10.5px] text-zinc-400">followers</p>
                </div>
                <button className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-zinc-700">
                  Follow
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Editor's pick */}
      <section className="relative overflow-hidden rounded-2xl bg-zinc-900 p-6 text-white shadow-elevated sm:p-8">
        <div className="absolute inset-0 opacity-60" style={{
          background:
            "radial-gradient(at 20% 20%, oklch(0.55 0.22 260 / 0.5) 0, transparent 50%), radial-gradient(at 80% 80%, oklch(0.7 0.18 320 / 0.4) 0, transparent 50%)",
        }} />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
              <Zap className="size-3 text-amber-300" /> Editor&apos;s pick
            </span>
            <h2 className="mt-4 text-balance text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">
              The state of Lightning, 2026 edition
            </h2>
            <p className="mt-2 text-[13.5px] text-zinc-300">
              A long-form essay tracing how zaps reshaped the open social web — from sat-tipping to a full creator economy.
            </p>
          </div>
          <button className="inline-flex items-center gap-1.5 self-start rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-zinc-900 hover:bg-zinc-100 sm:self-end">
            Read essay <ArrowUpRight className="size-3.5" />
          </button>
        </div>
      </section>
    </PageShell>
  );
}
