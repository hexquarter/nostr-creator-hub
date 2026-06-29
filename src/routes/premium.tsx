import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { useUI } from "@/components/modals/ui-provider";
import { toast } from "sonner";
import {
  Crown,
  Zap,
  Check,
  Sparkles,
  TrendingUp,
  Users,
  Link as LinkIcon,
  FileText,
  Mic,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Premium — Crays" },
      {
        name: "description",
        content:
          "Become a Crays Creator — paid subscribers, long-form publishing, your own link-in-bio page and free trials, all on Nostr.",
      },
    ],
  }),
  component: Premium,
});

const features = [
  { icon: Users, title: "Paid subscribers", desc: "Recurring monthly subscribers with one-tap Lightning checkout." },
  { icon: FileText, title: "Long-form publishing", desc: "Premium articles, paywalled posts and full-length essays." },
  { icon: LinkIcon, title: "Link-in-bio page", desc: "A beautiful, Linktree-style page hosted at stellar.app/you." },
  { icon: Sparkles, title: "Free trial offers", desc: "Let new fans preview your premium content before paying." },
  { icon: Mic, title: "Spaces hosting", desc: "Run live audio rooms for subscribers — or open to everyone." },
  { icon: BarChart3, title: "Analytics dashboard", desc: "Track MRR, churn, top posts and where your zaps come from." },
];

const subs = [
  { name: "Lyn Alden", handle: "@lyn", tier: "Macro insider", price: "21k sats / mo", renew: "Renews Dec 14" },
  { name: "Aura Labs", handle: "@aura", tier: "Builder circle", price: "5k sats / mo", renew: "Renews Dec 22" },
  { name: "Marty Bent", handle: "@marty", tier: "Mining notes", price: "10k sats / mo", renew: "Renews Jan 3" },
];

function Premium() {
  const ui = useUI();
  return (
    <PageShell title="Premium" subtitle="One plan. Everything you need to run a paid audience on Nostr.">
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
              <Crown className="size-3 text-amber-300" /> Crays Creator
            </span>
            <h2 className="mt-4 text-balance text-[28px] font-semibold leading-[1.1] tracking-tight sm:text-[36px]">
              Turn your audience into a sustainable business.
            </h2>
            <p className="mt-3 max-w-lg text-[14px] text-zinc-300">
              Subscriptions, paywalls, a link-in-bio page and free trials — built on Lightning, powered by Nostr. 100% of every sat goes to you.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={ui.openUpgrade}
                className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Start 14-day free trial
              </button>
              <button
                onClick={() => toast("Sample creator page coming soon")}
                className="rounded-full bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
              >
                See a creator page
              </button>
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3 mt-5">
          <Metric icon={Users} label="Subscribers" value="142k" />
          <Metric icon={Zap} label="Paid out" value="2.4B" suffix="sats" />
          <Metric icon={TrendingUp} label="Avg. growth" value="+18%" />
        </dl>
      </section>

      {/* Single plan */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-zinc-900 p-7 text-white shadow-elevated ring-1 ring-zinc-800">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(at 0% 0%, oklch(0.7 0.2 50 / 0.4) 0, transparent 55%), radial-gradient(at 100% 100%, oklch(0.55 0.22 260 / 0.35) 0, transparent 55%)",
            }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
              <Sparkles className="size-2.5" /> Creator plan
            </span>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[48px] font-semibold leading-none tracking-tight">$49</span>
              <span className="text-[13px] text-zinc-400">/ month</span>
            </div>
            <p className="mt-2 text-[13px] text-zinc-300">Cancel anytime. 14-day free trial included.</p>

            <button
              onClick={ui.openUpgrade}
              className="mt-6 w-full rounded-xl bg-white py-3 text-[13.5px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              Start free trial
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-400">
              No card required · pay with Lightning, card, or sats
            </p>

            <ul className="mt-6 space-y-3 border-t border-white/10 pt-5">
              {[
                "Paid subscriber tiers (sats or USD)",
                "Long-form premium publishing",
                "Hosted link-in-bio page",
                "Free trial offers for subscribers",
                "Spaces hosting & live audio",
                "Analytics dashboard & exports",
                "Priority creator support",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-amber-300" strokeWidth={3} />
                  <span className="text-zinc-200">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated"
            >
              <div className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                <f.icon className="size-[18px]" strokeWidth={2.2} />
              </div>
              <h4 className="mt-3 text-[13.5px] font-semibold text-zinc-900">{f.title}</h4>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active subscriptions */}
      {/* <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Creators you support
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
      </section> */}
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
