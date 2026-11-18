import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { CreatorToolsHero } from "@/components/creator-tools-hero";
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
} from "lucide-react";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Creator tools — Crays" },
      {
        name: "description",
        content:
          "The Crays creator toolkit: passkey identity, long-form publishing, Lightning zaps, Instagram import and encrypted messages on Nostr.",
      },
    ],
  }),
  component: Premium,
});

const features = [
  {
    icon: KeyRound,
    title: "Passkey identity",
    desc: "Create a Nostr key protected by your device's passkey — no seed phrase to lose.",
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

function Premium() {
  const nostr = useNostr();

  return (
    <PageShell
      title="Creator tools"
      subtitle="Everything Crays adds on top of the open Nostr protocol — free."
    >
      <CreatorToolsHero />

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <CreatorDashboard />

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

      <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-zinc-400">
        <LinkIcon className="size-3" />
        {nostr.account
          ? `Signed in as ${nostr.account.npub.slice(0, 12)}…`
          : "Powered by Nostr + Lightning"}
      </p>
    </PageShell>
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
      <section className="flex flex-col rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5 sm:p-7">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Creator dashboard
        </h3>
        <p className="mt-2 text-[15px] font-semibold text-zinc-900">
          Activity, plan and earnings — one place.
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
          Sign in to see your posts, followers, zaps earned and the Lightning address tied to your
          Nostr key.
        </p>
        <button
          onClick={() => ui.openAuth({ intent: "open your creator dashboard" })}
          className="mt-5 w-full rounded-xl bg-zinc-900 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-black"
        >
          Create your account
        </button>
        <p className="mt-2 text-center text-[11px] text-zinc-400">Free while in beta · no card</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col rounded-2xl bg-white p-6 shadow-card ring-1 ring-black/5 sm:p-7">
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

      <div className="mt-5 space-y-3 border-t border-zinc-100 pt-4">
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

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => ui.openCompose({ mode: "post" })}
          className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-black"
        >
          Write a post
        </button>
        <Link
          to="/wallet"
          className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-center text-[12.5px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200"
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
    <div className="flex items-start gap-3">
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
