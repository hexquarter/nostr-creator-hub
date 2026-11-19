import { Link } from "@tanstack/react-router";
import { useNostr } from "@/components/nostr-provider";
import { useUI } from "@/components/modals/ui-provider";
import {
  BadgeCheck,
  BarChart3,
  CreditCard,
  Crown,
  Link as LinkIcon,
  Lock,
  Sparkles,
  Wallet,
  Zap,
} from "lucide-react";

/**
 * Shared marketing hero for Crays. Shown on the Creator tools page for everyone
 * and at the top of the home page when nobody is signed in.
 */
export function CreatorToolsHero({ compact = false }: { compact?: boolean }) {
  const ui = useUI();
  const nostr = useNostr();
  const signedIn = !!nostr.account;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-elevated">
      <div
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(at 15% 10%, oklch(0.72 0.18 55 / 0.45) 0, transparent 45%), radial-gradient(at 85% 90%, oklch(0.58 0.22 265 / 0.4) 0, transparent 50%), radial-gradient(at 70% 20%, oklch(0.7 0.15 150 / 0.18) 0, transparent 35%)",
        }}
      />
      <div
        className={`relative grid gap-8 p-6 sm:p-10 ${compact ? "" : "lg:grid-cols-[1.35fr_1fr] lg:items-start"}`}
      >
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm ring-1 ring-white/10">
            <Crown className="size-3 text-amber-300" /> Crays for creators
          </span>
          <h2 className="mt-4 text-balance text-[28px] font-semibold leading-[1.08] tracking-tight sm:text-[38px]">
            Keep 100% of what you earn from your fans.
          </h2>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-zinc-300">
            Crays replaces the “fan club” middlemen. Instead of losing ~20% to platform fees, you
            get a public <span className="font-medium text-white">link-in-bio page</span> and a{" "}
            <span className="font-medium text-white">private creator dashboard</span> in one app —
            with instant payouts, an audience you own, and a flat{" "}
            <span className="font-semibold text-amber-200">€49/mo</span> Crays Verified Creator
            Badge with analytics.
          </p>

          {!compact && (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Highlight
                icon={CreditCard}
                text="Fans pay with Apple Pay or card — no crypto or wallet needed. We handle Bitcoin behind the scenes."
              />
              <Highlight
                icon={LinkIcon}
                text="One place for fans to subscribe and pay, and for you to manage subscribers and earnings."
              />
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {signedIn ? (
              <>
                <button
                  onClick={() => ui.openCompose({ mode: "post" })}
                  className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
                >
                  Write a post
                </button>
                <Link
                  to="/premium"
                  className="rounded-full bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
                >
                  Open creator tools
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={() => ui.openAuth({ intent: "create your Crays creator page" })}
                  className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
                >
                  Create your page
                </button>
                <button
                  onClick={() => ui.openAuth({ intent: "sign in to Crays" })}
                  className="rounded-full bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
                >
                  Sign in
                </button>
              </>
            )}
          </div>

          {!compact && (
            <p className="mt-4 max-w-xl text-[12px] leading-relaxed text-zinc-400">
              Earn €500/mo? Save ~€100 in platform fees — pay €49, keep €451. The badge pays for
              itself after 3 fans. Instant payouts. No 30-day waits.
            </p>
          )}
        </div>

        {!compact && (
          <div className="grid gap-3">
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
                What you get for €49/mo
              </p>
              <ul className="mt-3 space-y-2.5">
                <HeroPoint
                  icon={BadgeCheck}
                  text="Verified Creator Badge with analytics, visibility & ranking"
                />
                <HeroPoint
                  icon={LinkIcon}
                  text="Public link-in-bio page for fans to subscribe and pay"
                />
                <HeroPoint
                  icon={Lock}
                  text="Basic content gating — show or hide posts by subscription"
                />
                <HeroPoint
                  icon={BarChart3}
                  text="Simple analytics: subscribers, total earnings, subs per day"
                />
                <HeroPoint icon={Sparkles} text="Free trial link generator to bring in new fans" />
              </ul>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <Metric icon={Wallet} label="Platform fee" value="0%" accent />
              <Metric icon={Zap} label="Payouts" value="Instant" />
              <Metric icon={Crown} label="Badge + analytics" value="€49/mo" />
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}

function Highlight({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <Icon className="mt-0.5 size-4 shrink-0 text-amber-200" />
      <p className="text-[12px] leading-relaxed text-zinc-200">{text}</p>
    </div>
  );
}

function HeroPoint({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <li className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-zinc-200">
      <Icon className="mt-0.5 size-4 shrink-0 text-amber-200" />
      <span>{text}</span>
    </li>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur-sm">
      <Icon className={`size-3.5 ${accent ? "text-emerald-300" : "text-zinc-400"}`} />
      <p
        className={`mt-2 truncate text-[15px] font-semibold tracking-tight ${accent ? "text-emerald-200" : ""}`}
      >
        {value}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
    </div>
  );
}
