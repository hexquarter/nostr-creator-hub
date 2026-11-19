import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { PostCard, postFromNote } from "@/components/post-card";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { fetchFeed, fetchProfileStats, type FeedNote } from "@/lib/nostr/social";
import {
  emptyProfile,
  fetchProfile,
  parseProfilePointer,
  type Profile,
} from "@/lib/nostr/profiles";
import { compactNumber } from "@/lib/format";
import {
  BADGE_DAYS,
  DEFAULT_BADGE_SATS,
  badgePriceFromNotes,
  daysLeft,
  fetchCreatorMembers,
  isBadgeActive,
  useCreatorBadges,
} from "@/lib/nostr/badges";
import { CREATOR_PASS_USD, isCreatorPassActive, useCreatorPass } from "@/lib/nostr/creator-pass";
import { formatUsd, satsToUsd, useBtcPrice } from "@/lib/nostr/price";
import {
  BadgeCheck,
  Calendar,
  Camera,
  Check,
  Crown,
  Link as LinkIcon,
  MapPin,
  Settings as SettingsIcon,
  Zap,
  Globe,
  Loader2,
  LogIn,
  Copy,
  Lock,
  Users,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  validateSearch: (search: Record<string, unknown>): { pubkey?: string; relays?: string } => {
    const pointer = typeof search.pubkey === "string" ? parseProfilePointer(search.pubkey) : null;
    if (!pointer) return {};
    const hints = pointer.relays.join(",");
    return {
      pubkey: pointer.pubkey,
      // Keep relay hints when the router validates an already-normalized search.
      relays:
        hints || (typeof search.relays === "string" && search.relays ? search.relays : undefined),
    };
  },
  head: () => ({
    meta: [
      { title: "Profile — Crays" },
      { name: "description", content: "A Crays profile — posts, articles, media and zaps." },
    ],
  }),
  // Deep links carry the target in the query string, which the pre-rendered
  // HTML can't know. Render client-side only so hydration doesn't mismatch.
  ssr: false,
  component: Profile,
});

type Tab = "posts" | "articles" | "media" | "zaps";
const TABS: { id: Tab; label: string }[] = [
  { id: "posts", label: "Posts" },
  { id: "articles", label: "Articles" },
  { id: "media", label: "Media" },
  { id: "zaps", label: "Top zaps" },
];

function Profile() {
  const ui = useUI();
  const nostr = useNostr();
  const account = nostr.account;
  const search = Route.useSearch();
  const [viewed, setViewed] = useState<{ pubkey: string; profile: Profile } | null>(null);
  const [notes, setNotes] = useState<FeedNote[]>([]);
  const [stats, setStats] = useState<{
    posts: number;
    following: number;
    followers: number;
  } | null>(null);
  const [tab, setTab] = useState<Tab>("posts");
  const [loading, setLoading] = useState(false);

  const pubkey = search.pubkey ?? account?.pubkey;
  const relays = useMemo(
    () => search.relays?.split(",").filter(Boolean) ?? undefined,
    [search.relays],
  );
  const isOwn = Boolean(account && pubkey === account.pubkey);
  const profile = pubkey
    ? viewed?.pubkey === pubkey
      ? viewed.profile
      : isOwn
        ? (account?.profile ?? emptyProfile(pubkey))
        : emptyProfile(pubkey)
    : undefined;

  useEffect(() => {
    if (!pubkey) {
      setViewed(null);
      return;
    }
    if (isOwn) {
      setViewed(account?.profile ? { pubkey, profile: account.profile } : null);
      return;
    }
    let active = true;
    fetchProfile(pubkey, relays)
      .then((next) => {
        if (active) setViewed({ pubkey, profile: next });
      })
      .catch(() => {
        // Keep the fallback identity from the pubkey.
      });
    return () => {
      active = false;
    };
  }, [pubkey, relays, isOwn, account?.profile]);

  const load = useCallback(async () => {
    if (!pubkey) {
      setNotes([]);
      setStats(null);
      return;
    }
    setLoading(true);
    setNotes([]);
    setStats(null);
    try {
      const [feed, result] = await Promise.all([
        fetchFeed({ authors: [pubkey], includeReplies: false, limit: 100, timeout: 6500 }),
        fetchProfileStats(pubkey),
      ]);
      setNotes(feed);
      setStats(result);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [pubkey]);

  useEffect(() => {
    void load();
  }, [load]);

  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    if (!pubkey) {
      setMemberCount(null);
      return;
    }
    let active = true;
    setMemberCount(null);
    fetchCreatorMembers(pubkey, 6000)
      .then((count) => {
        if (active) setMemberCount(count);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [pubkey]);

  const visible = useMemo(() => {
    if (tab === "media") return notes.filter((note) => note.images.length > 0);
    if (tab === "articles") return notes.filter((note) => note.event.kind === 30023);
    if (tab === "zaps") return [...notes].sort((a, b) => b.counts.zapSats - a.counts.zapSats);
    return notes;
  }, [notes, tab]);

  const badges = useCreatorBadges();
  const creatorPass = useCreatorPass();
  const btc = useBtcPrice();
  if (!pubkey) {
    return (
      <PageShell title="Profile" subtitle="Public face of your sovereign identity.">
        <div className="rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-black/5">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <LogIn className="size-6" />
          </div>
          <p className="mt-3 text-[15px] font-semibold text-zinc-900">
            Sign in to see your profile
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">
            Your Nostr identity is your profile — no account creation, no password to remember.
          </p>
          <button
            onClick={() => ui.openAuth({ intent: "view your profile" })}
            className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
          >
            Sign in / Create
          </button>
        </div>
      </PageShell>
    );
  }

  const name = profile?.displayName || profile?.name || profile?.npub || "";
  const npub = profile?.npub ?? "";
  const banner = profile?.banner;
  const zapsEarned = notes.reduce((sum, note) => sum + note.counts.zapSats, 0);
  const following = nostr.isFollowing(pubkey);
  const badgePrice = badgePriceFromNotes(notes);
  const latestPremium = notes
    .filter((note) => note.premium)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  // Posts published without an explicit per-post price fall back to a tenth of
  // the monthly price, matching what the locked card shows.
  const unlockPrice = latestPremium
    ? (latestPremium.premiumUnlockSats ??
      Math.max(21, Math.round((badgePrice ?? DEFAULT_BADGE_SATS) / 10)))
    : null;
  const ownedBadge = badges.find((badge) => badge.creator === pubkey && isBadgeActive(badge));
  const premiumCount = notes.filter((note) => note.premium).length;
  const hasCreatorPass = isCreatorPassActive(creatorPass);
  const hasBadgeProgram = badgePrice != null;
  const showMembership = hasBadgeProgram || isOwn;
  const priceLabel = (amount: number) => {
    const usd = satsToUsd(amount, btc);
    return usd == null ? `${compactNumber(amount)} sats` : formatUsd(usd);
  };

  const toggleFollow = async () => {
    if (!ui.requireAuth("follow creators")) return;
    try {
      const next = await nostr.toggleFollow(pubkey);
      toast.success(next ? `Following ${name}` : `Unfollowed ${name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update your follow list.");
    }
  };

  const statCards = [
    { label: "Posts", value: stats ? compactNumber(stats.posts) : "—" },
    { label: "Followers", value: stats ? compactNumber(stats.followers) : "—" },
    { label: "Following", value: stats ? compactNumber(stats.following) : "—" },
    { label: "Zaps earned", value: zapsEarned > 0 ? compactNumber(zapsEarned) : "—" },
  ];

  return (
    <PageShell title="Profile" subtitle="Public face of your sovereign identity.">
      {/* Banner + header */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <div
          className="relative h-44 w-full bg-zinc-900 bg-cover bg-center sm:h-56"
          style={
            banner
              ? { backgroundImage: `url(${banner})` }
              : {
                  background:
                    "radial-gradient(at 20% 30%, #818cf8 0, transparent 50%), radial-gradient(at 80% 70%, #f472b6 0, transparent 50%), linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
                }
          }
        >
          {isOwn && (
            <button
              onClick={ui.openEditProfile}
              className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm backdrop-blur transition-colors hover:bg-black/70"
            >
              <Camera className="size-3.5" /> Change banner
            </button>
          )}
        </div>
        <div className="-mt-14 px-5 pb-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="relative w-fit rounded-2xl bg-white p-1.5 shadow-card">
              {profile?.picture ? (
                <img src={profile.picture} alt="" className="size-24 rounded-xl object-cover" />
              ) : (
                <AvatarTile seed={name} size={96} rounded="2xl" className="!rounded-xl" />
              )}
              {isOwn && (
                <button
                  onClick={ui.openEditProfile}
                  aria-label="Change profile picture"
                  className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-zinc-900 text-white shadow ring-2 ring-white transition-colors hover:bg-black"
                >
                  <Camera className="size-4" />
                </button>
              )}
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
              {badgePrice != null && !isOwn && (
                <button
                  onClick={() => ui.openBadge({ creator: pubkey, name, sats: badgePrice })}
                  className={`col-span-2 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-semibold transition-colors sm:col-auto ${
                    ownedBadge
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
                      : "bg-amber-500 text-white shadow-card hover:bg-amber-600"
                  }`}
                >
                  <Crown className="size-3.5" />
                  {ownedBadge
                    ? `Member · ${daysLeft(ownedBadge)}d left`
                    : `Join · ${priceLabel(badgePrice)}`}
                </button>
              )}
              {isOwn && badgePrice != null && (
                <span className="col-span-2 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-3.5 py-2 text-[12px] font-semibold text-amber-700 ring-1 ring-amber-100 sm:col-auto">
                  <Crown className="size-3.5" /> Membership · {compactNumber(badgePrice)} sats
                </span>
              )}
              <button
                onClick={() => ui.openZap({ recipient: name, pubkey })}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-2 text-[12px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                <Zap className="size-3.5" /> Zap
              </button>
              {isOwn ? (
                <button
                  onClick={ui.openEditProfile}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-zinc-700 shadow-card ring-1 ring-black/5 hover:bg-zinc-50"
                >
                  <SettingsIcon className="size-3.5" /> Edit profile
                </button>
              ) : (
                <button
                  onClick={() => void toggleFollow()}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-semibold shadow-card ring-1 transition-colors ${
                    following
                      ? "bg-zinc-100 text-zinc-700 ring-black/5 hover:bg-zinc-200"
                      : "bg-zinc-900 text-white ring-zinc-900 hover:bg-zinc-700"
                  }`}
                >
                  {following ? (
                    <UserCheck className="size-3.5" />
                  ) : (
                    <UserPlus className="size-3.5" />
                  )}
                  {following ? "Following" : "Follow"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 break-words text-[22px] font-semibold tracking-tight text-zinc-900">
              {name}
              {profile?.nip05 && <BadgeCheck className="size-5 shrink-0 fill-brand text-white" />}
            </h2>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(npub);
                toast.success("npub copied");
              }}
              className="inline-flex max-w-full items-center gap-1 text-[12px] text-zinc-500 hover:text-zinc-800"
            >
              <span className="truncate">
                {npub.slice(0, 18)}…{npub.slice(-6)}
              </span>
              <Copy className="size-3 shrink-0" />
            </button>
            {profile?.about && (
              <p className="mt-3 max-w-xl whitespace-pre-wrap text-pretty text-[14px] leading-relaxed text-zinc-700">
                {profile.about}
              </p>
            )}
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-zinc-500">
              {profile?.lud16 && (
                <li className="inline-flex items-center gap-1.5">
                  <Zap className="size-3.5" /> {profile.lud16}
                </li>
              )}
              {profile?.website && (
                <li className="inline-flex items-center gap-1.5">
                  <LinkIcon className="size-3.5" />
                  <a
                    href={
                      profile.website.startsWith("http")
                        ? profile.website
                        : `https://${profile.website}`
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-brand hover:underline"
                  >
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              )}
              {profile?.nip05 && (
                <li className="inline-flex items-center gap-1.5">
                  <Globe className="size-3.5" /> {profile.nip05}
                </li>
              )}
              <li className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> Nostr
                {isOwn && account ? ` · ${account.method}` : ""}
              </li>
            </ul>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-black/5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  {s.label}
                </p>
                <p className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-900">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {showMembership && (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950 p-5 text-white shadow-card ring-1 ring-white/10 sm:p-6">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-amber-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-brand/20 blur-3xl"
          />

          <div className="relative">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-white/15">
                    <Crown className="size-3" /> Creator membership
                  </span>
                  {!isOwn && ownedBadge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
                      <Check className="size-3" /> Member
                    </span>
                  )}
                  {isOwn && hasBadgeProgram && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/30">
                      <Check className="size-3" /> Live
                    </span>
                  )}
                </div>

                <h3 className="mt-4 text-balance text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]">
                  {hasBadgeProgram
                    ? isOwn
                      ? "Your membership is ready for fans."
                      : `Unlock members-only posts from ${name}.`
                    : "Turn your audience into members"}
                </h3>
                <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-zinc-300">
                  {hasBadgeProgram
                    ? `A membership unlocks every members-only post from ${name} for ${BADGE_DAYS} days, or fans can unlock a single post. They pay with Apple Pay or card — no wallet needed. Lightning and zaps are available in advanced mode.`
                    : "Publish a members-only post to start your membership. Fans can subscribe with Apple Pay or card, or unlock a single post — no crypto or wallet needed."}
                </p>

                <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                      Monthly membership
                    </p>
                    <p className="mt-0.5 text-[24px] font-bold leading-none tracking-tight text-amber-100">
                      {hasBadgeProgram ? priceLabel(badgePrice) : "Not set"}
                    </p>
                  </div>
                  {unlockPrice != null && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        Single post
                      </p>
                      <p className="mt-0.5 text-[18px] font-semibold leading-none tracking-tight text-zinc-100">
                        {priceLabel(unlockPrice)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                  {!isOwn && hasBadgeProgram && !ownedBadge && (
                    <button
                      onClick={() => ui.openBadge({ creator: pubkey, name, sats: badgePrice })}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-amber-400"
                    >
                      <Crown className="size-4" /> Join with card · {priceLabel(badgePrice)}
                    </button>
                  )}
                  {!isOwn && ownedBadge && (
                    <span className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-400/15 px-4 py-3 text-[13px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                      <Check className="size-4" /> Member · {daysLeft(ownedBadge)} days left
                    </span>
                  )}
                  {isOwn && hasBadgeProgram && (
                    <button
                      onClick={() => ui.openCompose({ mode: "post" })}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-amber-400"
                    >
                      <Crown className="size-4" /> Write members-only post
                    </button>
                  )}
                  {isOwn && !hasBadgeProgram && (
                    <button
                      onClick={() => {
                        if (!hasCreatorPass) {
                          ui.openUpgrade();
                          return;
                        }
                        ui.openCompose({ mode: "post" });
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-amber-400"
                    >
                      {hasCreatorPass ? <Crown className="size-4" /> : <Lock className="size-4" />}
                      {hasCreatorPass ? "Start your membership" : "Get Crays premium"}
                    </button>
                  )}
                </div>

                {!isOwn && hasBadgeProgram && (
                  <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-zinc-400">
                    <Users className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
                    {ownedBadge
                      ? `Your membership covers all ${premiumCount} members-only post${premiumCount === 1 ? "" : "s"} from ${name}.`
                      : `A membership unlocks all ${premiumCount} members-only post${premiumCount === 1 ? "" : "s"} from ${name} for ${BADGE_DAYS} days. Or pay once for a single post.`}
                  </p>
                )}
                {isOwn && !hasCreatorPass && (
                  <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-zinc-400">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-zinc-500" /> Crays premium (
                    {formatUsd(CREATOR_PASS_USD)} / month) is required to sell memberships and
                    single-post unlocks.
                  </p>
                )}
              </div>

              <div className="grid w-full shrink-0 grid-cols-2 gap-2 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 sm:grid-cols-4 lg:w-[340px] lg:grid-cols-2 lg:self-stretch">
                <MembershipStat
                  label="Monthly price"
                  value={hasBadgeProgram ? priceLabel(badgePrice) : "Not set"}
                />
                <MembershipStat
                  label="Per-post unlock"
                  value={unlockPrice == null ? "Not set" : priceLabel(unlockPrice)}
                />
                <MembershipStat
                  label="Members"
                  value={memberCount == null ? "—" : compactNumber(memberCount)}
                />
                <MembershipStat
                  label="Members-only posts"
                  value={hasBadgeProgram ? compactNumber(premiumCount) : "—"}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex w-fit items-center gap-1 rounded-full bg-white p-1 text-[12px] font-medium shadow-card ring-1 ring-black/5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              tab === t.id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-zinc-400">
          <Loader2 className="size-4 animate-spin" /> Reading {isOwn ? "your" : "their"} notes from
          relays…
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-black/5">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <Calendar className="size-6" />
          </div>
          <p className="mt-3 text-[14px] font-semibold text-zinc-900">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">
            {tab === "posts"
              ? isOwn
                ? "Your notes will appear here once you publish something."
                : "This creator hasn't published any notes yet."
              : "Nothing in this tab yet."}
          </p>
          {isOwn && (
            <button
              onClick={() => ui.openCompose({ mode: "post" })}
              className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
            >
              Write a post
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map((note) => (
            <PostCard key={note.id} post={postFromNote(note)} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function MembershipStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3.5 py-2.5 ring-1 ring-white/10">
      <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-0.5 truncate text-[14px] font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}
