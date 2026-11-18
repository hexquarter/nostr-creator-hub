import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { fetchFeed, fetchProfileStats } from "@/lib/nostr/social";
import { BADGE_DAYS, badgePriceFromNotes, fetchCreatorMembers } from "@/lib/nostr/badges";
import {
  CREATOR_PASS_DAYS,
  activateCreatorPass,
  creatorPassDaysLeft,
  isCreatorPassActive,
  useCreatorPass,
} from "@/lib/nostr/creator-pass";
import { compactNumber } from "@/lib/format";
import {
  Zap,
  Users,
  Link as LinkIcon,
  FileText,
  Camera,
  KeyRound,
  MessageCircle,
  Crown,
  Wallet,
  Loader2,
  Check,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Creator tools — Crays" },
      {
        name: "description",
        content:
          "Crays Premium: sell memberships, publish members-only posts and get paid in sats over Lightning. Free while in beta.",
      },
    ],
  }),
  component: Premium,
});

const features = [
  {
    icon: KeyRound,
    title: "Passkey identity",
    desc: "A Nostr key protected by your device's passkey — no seed phrase to lose.",
  },
  {
    icon: FileText,
    title: "Notes & long-form",
    desc: "Publish kind-1 notes and kind-30023 articles to your relays in one step.",
  },
  {
    icon: Zap,
    title: "Lightning zaps",
    desc: "Send and receive sats with any NIP-47 wallet. 100% goes to the creator.",
  },
  {
    icon: Camera,
    title: "Instagram import",
    desc: "Bring your posts and photos across, re-hosted on Blossom.",
  },
  {
    icon: Users,
    title: "Follow graph",
    desc: "Your follow list lives on Nostr, so it travels with your key to any client.",
  },
  {
    icon: MessageCircle,
    title: "Encrypted DMs",
    desc: "Private NIP-04 messages, decrypted only on your device.",
  },
];

const premiumBenefits = [
  "Sell memberships — one badge price for all your members-only posts",
  "Publish members-only notes and long-form articles",
  "Readers pay you directly over Lightning — 0% platform fee",
  "Members, members-only posts and zaps in one dashboard",
  "Passkey sign-in, encrypted DMs and Instagram import included",
];

function Premium() {
  const nostr = useNostr();

  return (
    <PageShell
      wide
      title="Creator tools"
      subtitle="Everything Crays adds on top of the open Nostr protocol — free."
    >
      <PremiumBadgeCard />

      <CreatorDashboard />

      <section>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Everything else, included
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-card ring-1 ring-black/5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <f.icon className="size-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h4 className="text-[12.5px] font-semibold text-zinc-900">{f.title}</h4>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-zinc-400">
        <LinkIcon className="size-3" />
        {nostr.account
          ? `Signed in as ${nostr.account.npub.slice(0, 12)}…`
          : "Powered by Nostr + Lightning"}
      </p>
    </PageShell>
  );
}

/**
 * The Crays premium badge is the platform entitlement that makes a creator
 * able to sell memberships. Until it is active this card is the main thing on
 * the page: what the badge unlocks, the price (free in beta) and one button.
 */
function PremiumBadgeCard() {
  const ui = useUI();
  const nostr = useNostr();
  const pass = useCreatorPass();
  const active = isCreatorPassActive(pass);
  const daysLeft = pass ? creatorPassDaysLeft(pass) : CREATOR_PASS_DAYS;

  const activate = () => {
    activateCreatorPass();
    toast.success("Crays premium badge active — members-only posts unlocked");
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950 text-white shadow-card ring-1 ring-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-amber-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-brand/20 blur-3xl"
      />

      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-10 lg:p-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-white/15">
              <Crown className="size-3" /> Crays premium
            </span>
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
                <Check className="size-3" /> Active
              </span>
            ) : (
              <span className="text-[10.5px] font-semibold text-white/50">Beta</span>
            )}
          </div>

          <h3 className="mt-4 text-balance text-[23px] font-semibold leading-tight tracking-tight sm:text-[26px]">
            {active
              ? "Your badge is live — go sell a membership."
              : "Get paid by your audience, not a platform."}
          </h3>
          <p className="mt-2 max-w-md text-[12.5px] leading-relaxed text-zinc-300">
            {active
              ? "Anyone who buys your badge unlocks every members-only post you publish. Free while Crays is in beta."
              : "One badge unlocks every members-only post you publish. Readers pay you directly in sats — Crays never takes a cut."}
          </p>

          <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
            <span className="text-[28px] font-bold leading-none tracking-tight">
              {active ? `${daysLeft} days` : "Free"}
            </span>
            <span className="pb-0.5 text-[11px] text-zinc-400">
              {active ? "left on your badge" : `while Crays is in beta · ${CREATOR_PASS_DAYS} days`}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            {active ? (
              <>
                <button
                  onClick={() => ui.openCompose({ mode: "post" })}
                  className="rounded-xl bg-white px-5 py-3 text-[13px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
                >
                  Write a members-only post
                </button>
                <Link
                  to="/profile"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white/70 transition-colors hover:text-white"
                >
                  See your members <ArrowRight className="size-3.5" />
                </Link>
              </>
            ) : nostr.account ? (
              <button
                onClick={activate}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-amber-600"
              >
                <Crown className="size-4" /> Activate premium badge — free
              </button>
            ) : (
              <button
                onClick={() => ui.openAuth({ intent: "activate your Crays premium badge" })}
                className="rounded-xl bg-amber-500 px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-amber-600"
              >
                Create your account
              </button>
            )}
          </div>
          <p className="mt-3 text-[10.5px] text-white/40">
            No card · no auto-renew · your keys stay on your device
          </p>
        </div>

        <ul className="grid gap-2.5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 lg:p-5">
          <li className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            {active ? "Included in your badge" : "What the badge unlocks"}
          </li>
          {premiumBenefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-[12.5px] text-zinc-200">
              <Check
                className={`mt-0.5 size-3.5 shrink-0 ${active ? "text-emerald-300" : "text-amber-300"}`}
              />
              <span className="leading-relaxed">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

type DashboardStats = { posts: number; followers: number; following: number };

/**
 * Activity, subscription status and earnings in one place. The Lightning
 * address is read from the Nostr profile, so there is no separate wallet to
 * create before you can get paid.
 */
function CreatorDashboard() {
  const ui = useUI();
  const nostr = useNostr();
  const creatorPass = useCreatorPass();
  const passActive = isCreatorPassActive(creatorPass);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [zapsEarned, setZapsEarned] = useState<number | null>(null);
  const [premiumPosts, setPremiumPosts] = useState(0);
  const [badgePrice, setBadgePrice] = useState<number | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const pubkey = nostr.account?.pubkey;
  const lud16 = nostr.wallet.address;
  const hostedAddress = nostr.wallet.addressSource === "hosted";

  useEffect(() => {
    if (!pubkey) {
      setStats(null);
      setZapsEarned(null);
      setPremiumPosts(0);
      setBadgePrice(null);
      setMembers(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchProfileStats(pubkey),
      fetchFeed({ authors: [pubkey], includeReplies: false, limit: 100, timeout: 6500 }),
      fetchCreatorMembers(pubkey, 6500).catch(() => 0),
    ])
      .then(([result, feed, memberCount]) => {
        if (cancelled) return;
        setStats(result);
        setZapsEarned(feed.reduce((sum, note) => sum + note.counts.zapSats, 0));
        setPremiumPosts(feed.filter((note) => note.premium).length);
        setBadgePrice(badgePriceFromNotes(feed));
        setMembers(memberCount);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  if (!nostr.account) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="min-w-0">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Creator dashboard
            </h3>
            <p className="mt-2 text-[15px] font-semibold text-zinc-900">
              Activity, plan and earnings — one place.
            </p>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-zinc-500">
              Sign in to see your posts, followers, zaps earned and the Lightning address tied to
              your Nostr key.
            </p>
          </div>
          <div className="shrink-0 sm:w-44">
            <button
              onClick={() => ui.openAuth({ intent: "open your creator dashboard" })}
              className="w-full rounded-xl bg-zinc-100 py-3 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
            >
              Sign in
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-400">
              Free while in beta · no card
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Creator dashboard
        </h3>
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-zinc-400" />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-emerald-600">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Live
          </span>
        )}
      </div>

      {/* Activity */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <DashboardStat label="Posts" value={stats ? compactNumber(stats.posts) : "—"} />
        <DashboardStat label="Followers" value={stats ? compactNumber(stats.followers) : "—"} />
        <DashboardStat label="Members" value={members == null ? "—" : compactNumber(members)} />
        <DashboardStat label="Members-only" value={compactNumber(premiumPosts)} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2 sm:gap-x-8">
        <DashboardRow
          icon={Zap}
          label="Zaps earned"
          value={zapsEarned == null ? "—" : `${compactNumber(zapsEarned)} sats`}
          hint="From your notes on the relays"
        />
        <DashboardRow
          icon={Crown}
          label="Creator badge"
          value={
            badgePrice == null
              ? "Not set"
              : `${compactNumber(badgePrice)} sats / ${BADGE_DAYS} days`
          }
          hint={
            badgePrice == null
              ? "Post something members-only to start your badge program"
              : `${premiumPosts} members-only post${premiumPosts === 1 ? "" : "s"} · ${members ?? 0} member${members === 1 ? "" : "s"}`
          }
        />
        <DashboardRow
          icon={Crown}
          label="Crays badge"
          value={
            passActive && creatorPass
              ? `Active · ${creatorPassDaysLeft(creatorPass)} days left`
              : "Not active"
          }
          hint={
            passActive
              ? `Free while in beta · renews in ${CREATOR_PASS_DAYS} days`
              : "Required to sell memberships and post members-only content"
          }
          action={
            passActive ? undefined : (
              <button
                onClick={() => {
                  activateCreatorPass();
                  toast.success("Crays creator badge active — members-only posts unlocked");
                }}
                className="shrink-0 rounded-full bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-amber-600"
              >
                Activate
              </button>
            )
          }
        />
        <DashboardRow
          icon={Wallet}
          label="Lightning address"
          value={lud16 ?? "Not set"}
          hint={
            !lud16
              ? "Sign in to derive one from your Nostr key"
              : hostedAddress
                ? "npub.cash · derived from your Nostr key"
                : "Ready to receive zaps"
          }
          mono={!!lud16}
        />
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => ui.openCompose({ mode: "post" })}
          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
        >
          Write a post
        </button>
        <Link
          to="/wallet"
          className="rounded-xl bg-zinc-100 px-5 py-2.5 text-center text-[12.5px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
        >
          Open wallet
        </Link>
      </div>
    </section>
  );
}

function DashboardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tracking-tight text-zinc-900">{value}</p>
    </div>
  );
}

function DashboardRow({
  icon: Icon,
  label,
  value,
  hint,
  mono,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
        <p
          className={`truncate text-[13px] font-semibold text-zinc-900 ${mono ? "font-mono text-[12px]" : ""}`}
        >
          {value}
        </p>
        {hint && <p className="truncate text-[11px] text-zinc-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
