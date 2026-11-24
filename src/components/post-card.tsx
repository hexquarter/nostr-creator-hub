import {
  MessageCircle,
  Zap,
  Repeat2,
  Bookmark,
  Share2,
  MoreHorizontal,
  BadgeCheck,
  Crown,
  Copy,
  Flag,
  EyeOff,
  Link as LinkIcon,
  UserPlus,
  Lock,
  CreditCard,
  Heart,
  Loader2,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { nip19, type NostrEvent } from "nostr-tools";
import { AvatarTile } from "./avatar-tile";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "./ui/hover-card";
import { useUI } from "./modals/ui-provider";
import { useNostr } from "./nostr-provider";
import { compactNumber, timeAgo } from "@/lib/format";
import { decryptContent } from "@/lib/nostr/exclusive";
import {
  contentWithoutImages,
  extractMedia,
  fetchNoteLikes,
  fetchReplies,
  type FeedNote,
  type NoteLike,
} from "@/lib/nostr/social";
import { shortNpub } from "@/lib/nostr/profiles";
import type { Nip68Media } from "@/lib/nostr/social";
import {
  isBadgeActive,
  useCreatorBadges,
  usePostUnlocks,
  DEFAULT_BADGE_SATS,
} from "@/lib/nostr/badges";
import { usePreferences } from "@/lib/preferences";
import { formatUsd, satsToUsd, useBtcPrice } from "@/lib/nostr/price";
import { DEV_PAYMENTS_ENABLED } from "@/lib/payments/dev-payments";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Post = {
  id: string;
  author: string;
  handle: string;
  verified?: boolean;
  premium?: boolean;
  premiumSats?: number;
  premiumUnlockSats?: number;
  /** The text is encrypted on relays; unlocks with the post key. */
  encrypted?: boolean;
  time: string;
  content: string;
  avatar?: string;
  image?: { gradient?: string; aspect?: string; url?: string };
  images?: string[];
  /** Video URLs (kind-1 text links or NIP-68 video events). */
  videos?: string[];
  /** NIP-68 media with mime/dim/poster metadata (kinds 20/21/22). */
  media?: Nip68Media[];
  /** True for NIP-68 picture/video events: the media leads the card. */
  visual?: boolean;
  sensitive?: { reason: string; note?: string };
  replies: number;
  reactions: number;
  zaps: string;
  reposts: number;
  /** The underlying Nostr event, when this post is real. */
  event?: NostrEvent;
  authorPubkey?: string;
};

export function postFromNote(note: FeedNote): Post {
  const profile = note.author;
  const images = note.images;
  return {
    id: note.id,
    author: profile.displayName || profile.name || profile.handle,
    handle: profile.handle,
    verified: Boolean(profile.nip05),
    time: timeAgo(note.createdAt),
    content: contentWithoutImages(note.content, images, note.videos),
    avatar: profile.picture,
    images,
    image: images[0] ? { url: images[0] } : undefined,
    videos: note.videos,
    media: note.media,
    visual: note.event.kind === 20 || note.event.kind === 21 || note.event.kind === 22,
    premium: note.premium,
    premiumSats: note.premiumSats,
    premiumUnlockSats: note.premiumUnlockSats,
    encrypted: note.encrypted,
    sensitive: note.contentWarning
      ? { reason: note.contentWarning, note: note.contentWarning }
      : undefined,
    replies: note.counts.replies,
    reactions: note.counts.reactions,
    reposts: note.counts.reposts,
    zaps:
      note.counts.zapSats > 0
        ? compactNumber(note.counts.zapSats)
        : compactNumber(note.counts.zaps),
    event: note.event,
    authorPubkey: profile.pubkey,
  };
}

export function PostCard({ post, flat = false }: { post: Post; flat?: boolean }) {
  const ui = useUI();
  const nostr = useNostr();
  const preferences = usePreferences();
  const btc = useBtcPrice();
  const [bookmarked, setBookmarked] = useState(() => nostr.bookmarks.includes(post.id));
  const [reposted, setReposted] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeDelta, setLikeDelta] = useState(0);
  const [likers, setLikers] = useState<NoteLike[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const [showThread, setShowThread] = useState(false);
  const [threadNotes, setThreadNotes] = useState<FeedNote[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadLoaded, setThreadLoaded] = useState(false);

  // Preferences live in localStorage, so apply them after hydration to keep
  // server and client markup identical.
  useEffect(() => {
    setRevealed(preferences.privacy.showSensitive);
  }, [preferences.privacy.showSensitive]);
  const [following, setFollowing] = useState(() =>
    post.authorPubkey ? nostr.isFollowing(post.authorPubkey) : false,
  );
  const isReal = Boolean(post.event && post.authorPubkey);
  const badges = useCreatorBadges();
  const unlocks = usePostUnlocks();
  const badge = post.authorPubkey
    ? badges.find((item) => item.creator === post.authorPubkey && isBadgeActive(item))
    : undefined;
  const isAuthor = Boolean(post.authorPubkey && nostr.account?.pubkey === post.authorPubkey);
  // Members-only posts are readable by the author, by members of that creator's
  // program, or by anyone who paid for this one post.
  const unlockedPost = unlocks.some((item) => item.postId === post.id);
  const hasBadge = Boolean(badge);
  const locked = Boolean(post.premium && !isAuthor && !hasBadge && !unlockedPost);
  // Encrypted posts decrypt for whoever is entitled; the key comes from the
  // local cache, relays, or the creator's key server.
  const encrypted = Boolean(post.encrypted && post.event && post.authorPubkey);
  const creator = post.authorPubkey;
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [keyState, setKeyState] = useState<"loading" | "waiting" | "idle">("idle");
  const [retryToken, setRetryToken] = useState(0);
  useEffect(() => {
    if (!encrypted || !creator || !post.event) {
      setPlaintext(null);
      setKeyState("idle");
      return;
    }
    let cancelled = false;
    setKeyState("loading");
    const run = async () => {
      try {
        const key = await nostr.resolvePostKey({
          creator,
          postId: post.id,
          isAuthor,
        });
        if (cancelled) return;
        if (!key) {
          setKeyState("waiting");
          return;
        }
        const plain = await decryptContent(post.event!.content, key);
        if (cancelled) return;
        setPlaintext(plain);
        setKeyState("idle");
      } catch {
        if (!cancelled) setKeyState("waiting");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // Re-run when an entitlement arrives while the card is on screen.
  }, [
    encrypted,
    post.id,
    post.event,
    isAuthor,
    hasBadge,
    unlockedPost,
    retryToken,
    creator,
    nostr,
  ]);
  const badgeSats = post.premiumSats ?? DEFAULT_BADGE_SATS;
  const unlockSats = post.premiumUnlockSats ?? Math.max(21, Math.round(badgeSats / 10));
  const priceLabel = (amount: number) => {
    const usd = satsToUsd(amount, btc);
    return usd == null ? `${compactNumber(amount)} sats` : formatUsd(usd);
  };

  const shareUrl = post.event
    ? `https://njump.me/${nip19.neventEncode({ id: post.event.id, author: post.event.pubkey })}`
    : undefined;

  const toggleFollow = async () => {
    if (!post.authorPubkey) {
      toast.success(`Following ${post.author}`);
      return;
    }
    if (!ui.requireAuth("follow creators")) return;
    try {
      const next = await nostr.toggleFollow(post.authorPubkey);
      setFollowing(next);
      toast.success(next ? `Following ${post.author}` : `Unfollowed ${post.author}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update your follow list.");
    }
  };

  const toggleBookmark = async () => {
    if (!post.event) {
      setBookmarked((v) => !v);
      toast.success(bookmarked ? "Removed from bookmarks" : "Added to bookmarks");
      return;
    }
    if (!ui.requireAuth("bookmark posts")) return;
    try {
      const next = await nostr.toggleBookmark(post.event);
      setBookmarked(next);
      toast.success(next ? "Added to bookmarks" : "Removed from bookmarks");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't update bookmarks.");
    }
  };

  const doRepost = async () => {
    if (!post.event) {
      setReposted((v) => !v);
      toast.success(reposted ? "Repost removed" : "Reposted");
      return;
    }
    if (!ui.requireAuth("repost")) return;
    try {
      await nostr.repost(post.event);
      setReposted(true);
      toast.success("Reposted to your followers");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't repost that.");
    }
  };

  const doLike = async () => {
    if (liked) return;
    if (!post.event) {
      setLiked(true);
      setLikeDelta(1);
      return;
    }
    if (!ui.requireAuth("react to posts")) return;
    try {
      await nostr.react(post.event);
      setLiked(true);
      setLikeDelta(1);
      toast.success("Liked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't react to that post.");
    }
  };

  const likeCount = post.reactions + likeDelta;

  const navigate = useNavigate();
  const openProfile = (pubkey: string) => {
    navigate({
      to: "/profile",
      search: { pubkey },
    });
  };

  useEffect(() => {
    if (!post.event) {
      setLikers([]);
      return;
    }
    let cancelled = false;
    setLikersLoading(true);
    fetchNoteLikes(post.event)
      .then((list) => {
        if (!cancelled) setLikers(list);
      })
      .catch(() => {
        if (!cancelled) setLikers([]);
      })
      .finally(() => {
        if (!cancelled) setLikersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [post.event]);

  const likeContent =
    post.event && likeCount > 0 ? (
      <div className="space-y-2">
        <p className="px-1 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
          Liked by
        </p>
        {likersLoading ? (
          <p className="flex items-center gap-2 px-1 py-2 text-[12px] text-zinc-400">
            <Loader2 className="size-3.5 animate-spin" /> Loading likes…
          </p>
        ) : likers.length === 0 ? (
          <p className="px-1 py-2 text-[12px] text-zinc-400">No likes yet.</p>
        ) : (
          <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto">
            {likers.map(({ profile, reactedAt }) => {
              const name = profile.displayName || profile.name || profile.handle;
              return (
                <li key={profile.pubkey}>
                  <button
                    type="button"
                    onClick={() => openProfile(profile.pubkey)}
                    className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-zinc-50"
                  >
                    {profile.picture ? (
                      <img
                        src={profile.picture}
                        alt=""
                        className="size-7 rounded-full object-cover ring-1 ring-black/5"
                      />
                    ) : (
                      <AvatarTile seed={name} size={28} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-zinc-900">{name}</p>
                      <p className="truncate text-[11px] text-zinc-400">{profile.handle}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-400">{timeAgo(reactedAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    ) : undefined;

  const toggleThread = async () => {
    const next = !showThread;
    setShowThread(next);
    if (next && !threadLoaded && post.event) {
      setThreadLoading(true);
      try {
        const replies = await fetchReplies(post.event.id);
        setThreadNotes(replies);
        setThreadLoaded(true);
      } catch {
        toast.error("Couldn't load replies right now.");
      } finally {
        setThreadLoading(false);
      }
    }
  };

  const baseImages = post.images?.length ? post.images : post.image?.url ? [post.image.url] : [];
  // Decrypted members-only posts carry their media inside the plaintext.
  const decryptedMedia = useMemo(
    () => (plaintext ? extractMedia(plaintext) : { images: [], videos: [] }),
    [plaintext],
  );
  // NIP-68 events carry canonical media metadata (mime, dimensions, poster).
  const nip68Media = post.visual ? (post.media ?? []) : [];
  const nip68Videos = nip68Media.filter(
    (item) => item.mime?.startsWith("video/") || post.event?.kind !== 20,
  );
  const videos = Array.from(
    new Set([
      ...(nip68Videos.length > 0 ? nip68Videos.map((item) => item.url) : (post.videos ?? [])),
      ...decryptedMedia.videos,
    ]),
  ).filter((url) => !failedImages.has(url));
  const images = Array.from(
    new Set([
      ...decryptedMedia.images,
      ...baseImages,
      ...(nip68Videos.length === 0
        ? nip68Media.map((item) => item.url)
        : nip68Media.filter((item) => item.mime?.startsWith("image/")).map((item) => item.url)),
    ]),
  ).filter((url) => !failedImages.has(url));
  // A video poster (NIP-68 `thumb`) when the kind-1 text has none.
  const videoPoster = nip68Videos.find((item) => item.poster)?.poster;
  // The lead image's natural aspect ratio (NIP-68 `dim` when declared).
  const nip68Ratio = (() => {
    const dim = nip68Media.find((item) => item.url === images[0])?.dim;
    const [, width, height] = dim ? (/(\d+)x(\d+)/.exec(dim) ?? []) : [];
    if (!width || !height || Number(width) <= 0 || Number(height) <= 0) return undefined;
    return `${width} / ${height}`;
  })();
  const mediaLed = (post.visual || images.length > 0 || videos.length > 0) && !locked;
  // Flat mode (modals): no negative margins — the card itself has no padding,
  // so media spans edge-to-edge and each section carries its own padding.
  const bleed = flat ? "rounded-none" : mediaLed ? "-mx-5 rounded-none sm:-mx-6" : "rounded-xl";
  const sectionPad = flat ? "px-5" : "";

  // Instagram-style layout: visual posts show the media first, caption below;
  // text-only posts keep the classic note-first layout.
  const bodyBlock = (
    <>
      {locked ? (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 via-white to-orange-50 ring-1 ring-amber-100">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-10 -top-10 size-40 rounded-full bg-amber-200/60 blur-3xl" />
            <div className="absolute -bottom-12 -right-8 size-44 rounded-full bg-orange-200/60 blur-3xl" />
          </div>
          <div className="relative flex flex-col items-center gap-2 px-5 py-8 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wider text-amber-800">
              <Lock className="size-3" /> Members only
            </span>
            <p className="text-[13.5px] font-semibold text-zinc-900">This post is hidden</p>
            <p className="max-w-xs text-[11.5px] leading-relaxed text-zinc-500">
              Pay for this post once, or join {post.author}’s membership to read everything they
              publish for members.
            </p>
            <div className="mt-1 flex flex-col items-center gap-2 sm:flex-row">
              <button
                onClick={() =>
                  ui.openBadge({
                    creator: post.authorPubkey,
                    name: post.author,
                    sats: badgeSats,
                    postId: post.id,
                    postSats: unlockSats,
                    mode: "post",
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-[12px] font-semibold text-white shadow-card transition-colors hover:bg-amber-600"
              >
                <CreditCard className="size-3.5" /> Unlock this post · {priceLabel(unlockSats)}
              </button>
              <button
                onClick={() =>
                  ui.openBadge({
                    creator: post.authorPubkey,
                    name: post.author,
                    sats: badgeSats,
                    postId: post.id,
                    postSats: unlockSats,
                    mode: "subscribe",
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-4 py-2 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200 transition-colors hover:bg-white"
              >
                <Crown className="size-3.5" /> or subscribe · {priceLabel(badgeSats)} / mo
              </button>
            </div>
            <p className="text-[10.5px] text-zinc-400">
              Apple Pay or card — no wallet needed · Lightning & zaps in advanced mode
            </p>
          </div>
        </div>
      ) : encrypted && !plaintext ? (
        <div className="rounded-xl bg-amber-50/60 px-5 py-8 text-center ring-1 ring-amber-100">
          <div className="flex flex-col items-center gap-2">
            {keyState === "loading" ? (
              <>
                <Loader2 className="size-4 animate-spin text-amber-600" />
                <p className="text-[12.5px] font-medium text-zinc-600">Decrypting…</p>
              </>
            ) : (
              <>
                <Lock className="size-4 text-amber-600" />
                <p className="text-[13px] font-semibold text-zinc-900">Waiting for the key</p>
                <p className="max-w-xs text-[11.5px] leading-relaxed text-zinc-500">
                  {badges.some((item) => item.creator === post.authorPubkey && item.invoice) ||
                  unlocks.some((item) => item.postId === post.id && item.invoice) ? (
                    <>
                      This post is sealed. Paid readers get the key instantly from the creator's key
                      vault, or from {isAuthor ? "your" : `${post.author}’s`} key server when
                      they're online.
                    </>
                  ) : (
                    <>
                      This post is sealed, and this device's unlock has no payment proof attached —
                      the key vault can't verify it, so {isAuthor ? "your" : `${post.author}’s`} key
                      server will answer when they're online.
                      {DEV_PAYMENTS_ENABLED && (
                        <span className="mt-1 block">
                          Simulated (dev) unlocks are served by the creator's key server — keep a
                          signed-in creator tab open while testing.
                        </span>
                      )}
                    </>
                  )}
                </p>
                <button
                  onClick={() => setRetryToken((token) => token + 1)}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200 transition-colors hover:bg-white/80"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <PostContent content={plaintext ?? post.content} />
      )}
    </>
  );

  const mediaBlock = (
    <>
      {locked && images.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-100">
          <Lock className="size-3.5 shrink-0 text-zinc-400" />
          <p className="text-[11.5px] text-zinc-500">
            {images.length} members-only image{images.length === 1 ? "" : "s"} hidden
          </p>
        </div>
      )}

      {!locked && images.length > 0 && (
        <div
          className={`relative w-full overflow-hidden bg-zinc-100 ${bleed} ${
            images.length > 1 ? "aspect-square" : ""
          }`}
        >
          {post.sensitive && !revealed ? (
            <>
              <div className="absolute inset-0 scale-110 bg-zinc-200 blur-2xl" />
              <div className="absolute inset-0 grid place-items-center bg-zinc-900/25 p-6 text-center">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-zinc-800">
                    <EyeOff className="size-3.5" /> Sensitive · {post.sensitive.reason}
                  </span>
                  <p className="text-[12.5px] font-medium text-white drop-shadow">
                    {post.sensitive.note ?? "This media may be sensitive."}
                  </p>
                  <button
                    onClick={() => setRevealed(true)}
                    className="rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-zinc-900 shadow-card transition-transform active:scale-95"
                  >
                    Tap to view
                  </button>
                </div>
              </div>
            </>
          ) : images.length > 1 ? (
            <MediaGrid
              images={images}
              onFailed={(url) => setFailedImages((prev) => new Set(prev).add(url))}
            />
          ) : (
            /* Single image: natural aspect ratio — NIP-68 `dim` when declared,
               otherwise the browser's natural size — capped at the viewport
               height, never squeezed into a forced crop box. */
            <img
              src={images[0]}
              alt=""
              draggable={false}
              onError={() => setFailedImages((prev) => new Set(prev).add(images[0]))}
              className="block w-full object-cover object-center max-h-[85vh]"
              style={nip68Ratio ? { aspectRatio: nip68Ratio, maxHeight: "85vh" } : undefined}
            />
          )}
          {post.sensitive && revealed && (
            <button
              onClick={() => setRevealed(false)}
              aria-label="Hide sensitive media"
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-zinc-900/60 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur"
            >
              <EyeOff className="size-3" /> Hide
            </button>
          )}
        </div>
      )}

      {!locked && videos.length > 0 && (!post.sensitive || revealed) && (
        <div className="space-y-0.5">
          {videos.map((url) => {
            const dim = nip68Media.find((item) => item.url === url)?.dim;
            const [, width, height] = dim ? (/(\d+)x(\d+)/.exec(dim) ?? []) : [];
            const known = Boolean(width && height);
            return (
              <div
                key={url}
                className={`relative flex items-center justify-center overflow-hidden bg-zinc-900 ${bleed}`}
                style={
                  known
                    ? { aspectRatio: `${width} / ${height}`, maxHeight: "85vh" }
                    : { aspectRatio: "16 / 9" }
                }
              >
                <video
                  src={url}
                  poster={videoPoster}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className={`size-full ${known ? "object-contain" : "object-cover"}`}
                />
              </div>
            );
          })}
        </div>
      )}
      {!locked && videos.length > 0 && post.sensitive && !revealed && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-100">
          <p className="inline-flex items-center gap-2 text-[11.5px] text-zinc-500">
            <EyeOff className="size-3.5 shrink-0 text-zinc-400" />
            {videos.length} sensitive video{videos.length === 1 ? "" : "s"} hidden
          </p>
          <button
            onClick={() => setRevealed(true)}
            className="rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-zinc-900 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-100"
          >
            Tap to view
          </button>
        </div>
      )}

      {images.length === 0 && videos.length === 0 && post.image?.gradient && (
        <div
          className={`w-full overflow-hidden ring-1 ring-black/5 ${bleed} ${post.image.aspect ?? "aspect-[16/10]"}`}
          style={{ background: post.image.gradient }}
        />
      )}
    </>
  );

  return (
    <article
      className={`min-w-0 space-y-4 overflow-hidden bg-white ${
        flat
          ? ""
          : "rounded-2xl p-5 shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated sm:p-6"
      }`}
    >
      <header
        className={`flex items-start justify-between gap-2 ${sectionPad} ${flat ? "pt-4" : ""}`}
      >
        <Link
          to="/profile"
          search={{ pubkey: post.authorPubkey }}
          className="group flex min-w-0 items-center gap-3"
        >
          {post.avatar ? (
            <img
              src={post.avatar}
              alt=""
              className="size-10 shrink-0 rounded-full object-cover ring-1 ring-black/5"
            />
          ) : (
            <AvatarTile seed={post.author} size={40} />
          )}
          <div className="min-w-0">
            <h4 className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-zinc-900">
              <span className="truncate group-hover:underline">{post.author}</span>
              {post.verified && <BadgeCheck className="size-3.5 shrink-0 fill-brand text-white" />}
              {post.premium && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                  {locked ? <Lock className="size-2.5" /> : <Crown className="size-2.5" />}
                  {locked ? "Members" : "Premium"}
                </span>
              )}
            </h4>
            <p className="truncate text-[11.5px] text-zinc-400">
              {post.handle} · {post.time}
            </p>
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="More"
              className="grid size-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {locked && (
              <DropdownMenuItem
                onClick={() =>
                  ui.openBadge({
                    creator: post.authorPubkey,
                    name: post.author,
                    sats: badgeSats,
                    postId: post.id,
                    postSats: unlockSats,
                    mode: "post",
                  })
                }
              >
                <Crown className="size-4 text-amber-600" /> Unlock this post
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => void toggleFollow()}>
              <UserPlus className="size-4" /> {following ? "Unfollow" : "Follow"} {post.handle}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => ui.openShare({ title: post.content.slice(0, 60), url: shareUrl })}
            >
              <LinkIcon className="size-4" /> Copy link
            </DropdownMenuItem>
            {!locked && !encrypted && (
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(post.content);
                  toast.success("Post copied");
                }}
              >
                <Copy className="size-4" /> Copy text
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => toast("Hidden from your feed")}>
              <EyeOff className="size-4" /> Not interested
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-rose-600"
              onClick={() => toast("Reported to your relays")}
            >
              <Flag className="size-4" /> Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {!mediaLed && <div className={sectionPad}>{bodyBlock}</div>}
      {mediaBlock}
      {mediaLed && <div className={`pt-3 ${sectionPad}`}>{bodyBlock}</div>}

      <footer
        className={`flex items-center gap-2 pt-2 text-zinc-500 ${sectionPad} ${flat ? "pb-2" : ""}`}
      >
        <Action
          icon={MessageCircle}
          label={String(post.replies)}
          hover="hover:text-brand"
          active={showThread}
          activeClass="text-brand"
          onClick={() => void toggleThread()}
        />
        <Action
          icon={Repeat2}
          label={String(post.reposts + (reposted ? 1 : 0))}
          hover="hover:text-emerald-600"
          active={reposted}
          activeClass="text-emerald-600"
          onClick={() => void doRepost()}
        />
        <Action
          icon={Heart}
          label={String(likeCount)}
          hover="hover:text-rose-500"
          active={liked}
          activeClass="text-rose-500"
          onClick={() => void doLike()}
          content={likeContent}
        />
        <Action
          icon={Zap}
          label={post.zaps}
          hover="hover:text-amber-500"
          accent
          onClick={() =>
            ui.openZap({
              recipient: post.author,
              pubkey: post.authorPubkey,
              note: post.event,
            })
          }
        />
        <div className="ml-auto flex">
          <Action
            icon={Bookmark}
            hover="hover:text-zinc-900"
            active={bookmarked}
            activeClass="text-brand"
            onClick={() => void toggleBookmark()}
          />
          <Action
            icon={Share2}
            hover="hover:text-zinc-900"
            onClick={() => ui.openShare({ title: post.content.slice(0, 60), url: shareUrl })}
          />
        </div>
      </footer>

      {showThread && (
        <section
          className={`space-y-3 border-t border-zinc-100 pt-4 ${sectionPad} ${flat ? "pb-2" : ""}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-zinc-800">
              Replies{post.replies ? ` · ${post.replies}` : ""}
            </p>
            <button
              onClick={() =>
                ui.openCompose({
                  mode: "reply",
                  replyTo: post.handle,
                  replyToEvent: post.event,
                })
              }
              className="rounded-full bg-zinc-900 px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-black"
            >
              Reply
            </button>
          </div>

          {threadLoading ? (
            <p className="flex items-center gap-2 py-2 text-[12px] text-zinc-400">
              <Loader2 className="size-3.5 animate-spin" /> Loading replies…
            </p>
          ) : !post.event ? (
            <p className="text-[12px] text-zinc-400">Replies are available for Nostr notes.</p>
          ) : threadNotes.length === 0 ? (
            <p className="text-[12px] text-zinc-400">No replies yet. Be the first to reply.</p>
          ) : (
            <ul className="space-y-2.5">
              {threadNotes.map((reply) => {
                const rName = reply.author.displayName || reply.author.name || reply.author.handle;
                const rImages = reply.images.filter((url) => !failedImages.has(url));
                const replyText = contentWithoutImages(reply.content, rImages);
                return (
                  <li key={reply.id} className="rounded-xl bg-zinc-50/80 p-3 ring-1 ring-zinc-100">
                    <div className="flex gap-2.5">
                      <Link
                        to="/profile"
                        search={{ pubkey: reply.author.pubkey }}
                        className="shrink-0"
                      >
                        {reply.author.picture ? (
                          <img
                            src={reply.author.picture}
                            alt=""
                            className="size-8 rounded-full object-cover ring-1 ring-black/5"
                          />
                        ) : (
                          <AvatarTile seed={rName} size={32} />
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                          <Link
                            to="/profile"
                            search={{ pubkey: reply.author.pubkey }}
                            className="truncate text-[12.5px] font-semibold text-zinc-900 hover:underline"
                          >
                            {rName}
                          </Link>
                          <span className="text-[11px] text-zinc-400">
                            {reply.author.handle} · {timeAgo(reply.createdAt)}
                          </span>
                        </div>
                        {replyText && <PostContent content={replyText} />}
                        {!replyText && !rImages.length && reply.content && (
                          <p className="whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-zinc-700 [overflow-wrap:anywhere]">
                            {reply.content}
                          </p>
                        )}
                        {rImages.length > 0 && (
                          <div className="mt-2 overflow-hidden rounded-lg ring-1 ring-black/5">
                            <img
                              src={rImages[0]}
                              alt=""
                              loading="lazy"
                              className="max-h-56 w-full object-cover"
                              onError={() =>
                                setFailedImages((prev) => new Set(prev).add(rImages[0]))
                              }
                            />
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <Heart className="size-3" /> {compactNumber(reply.counts.reactions)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="size-3" />{" "}
                            {compactNumber(reply.counts.replies)}
                          </span>
                          <button
                            onClick={() =>
                              ui.openCompose({
                                mode: "reply",
                                replyTo: reply.author.handle,
                                replyToEvent: reply.event,
                              })
                            }
                            className="font-medium hover:text-zinc-800"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}

function Action({
  icon: Icon,
  label,
  hover,
  accent,
  onClick,
  active,
  activeClass,
  content,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label?: string;
  hover: string;
  accent?: boolean;
  onClick?: () => void;
  active?: boolean;
  activeClass?: string;
  /** Optional hover card content — e.g. the list of profiles who liked. */
  content?: React.ReactNode;
}) {
  const action = (
    <button
      onClick={onClick}
      className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
        active ? activeClass : "text-zinc-500"
      } ${hover}`}
    >
      <Icon
        className={`size-[15px] ${accent ? "transition-transform group-hover:scale-110" : ""}`}
        strokeWidth={2}
      />
      {label && <span>{label}</span>}
    </button>
  );

  if (content === undefined) {
    return action;
  }

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>{action}</HoverCardTrigger>
      <HoverCardContent align="start" sideOffset={8} className="w-64 max-w-[18rem] rounded-xl p-2">
        {content}
      </HoverCardContent>
    </HoverCard>
  );
}

export function isRealPost(post: Post) {
  return Boolean(post.event);
}

const ENTITY_RE =
  /(https?:\/\/[^\s<>"']+|(?:nostr:)?(?:npub|nprofile|note|nevent|naddr)1[0-9a-z]+)/gi;

function trimEntity(token: string) {
  return token.replace(/[),.!?;:]+$/, "");
}

function PostContent({ content }: { content: string }) {
  if (!content.trim()) return null;
  const parts = content.split(ENTITY_RE);
  return (
    <p className="min-w-0 max-w-[58ch] whitespace-pre-wrap break-words text-pretty text-[15px] leading-relaxed text-zinc-800 [overflow-wrap:anywhere]">
      {parts.map((part, index) => {
        if (!part) return null;
        if (/^https?:\/\//i.test(part)) {
          return <ExternalLink key={index} url={part} />;
        }
        const token = trimEntity(part);
        if (!token) return part;
        const trailing = part.slice(token.length);
        const entity = renderEntity(token);
        if (!entity) return part;
        return (
          <span key={index}>
            {entity}
            {trailing}
          </span>
        );
      })}
    </p>
  );
}

function ExternalLink({ url }: { url: string }) {
  const clean = trimEntity(url);
  const trailing = url.slice(clean.length);
  return (
    <span>
      <a
        href={clean}
        target="_blank"
        rel="noreferrer noopener"
        className="text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
      >
        {clean.replace(/^https?:\/\//, "").replace(/\/$/, "")}
      </a>
      {trailing}
    </span>
  );
}

function ProfileMention({ pubkey }: { pubkey: string }) {
  return (
    <Link to="/profile" search={{ pubkey }} className="font-medium text-brand hover:underline">
      @{shortNpub(pubkey)}
    </Link>
  );
}

function renderEntity(token: string) {
  const raw = token.replace(/^nostr:/i, "").toLowerCase();
  try {
    const decoded = nip19.decode(raw);
    if (decoded.type === "npub") return <ProfileMention pubkey={decoded.data} />;
    if (decoded.type === "nprofile") return <ProfileMention pubkey={decoded.data.pubkey} />;
    if (decoded.type === "note" || decoded.type === "nevent" || decoded.type === "naddr") {
      return (
        <a
          href={`https://njump.me/${raw}`}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-brand hover:underline"
        >
          Open note ↗
        </a>
      );
    }
  } catch {
    // Not a valid bech32 entity — leave the text untouched.
  }
  return null;
}

function MediaGrid({ images, onFailed }: { images: string[]; onFailed: (url: string) => void }) {
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;

  if (shown.length === 1) {
    return (
      <img
        src={shown[0]}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
        onError={() => onFailed(shown[0])}
      />
    );
  }

  return (
    <div
      className={`absolute inset-0 grid gap-0.5 ${
        shown.length === 2 ? "grid-cols-2 grid-rows-1" : "grid-cols-2 grid-rows-2"
      }`}
    >
      {shown.map((url, index) => (
        <div
          key={url}
          className={`relative min-h-0 min-w-0 overflow-hidden ${
            shown.length === 3 && index === 0 ? "row-span-2" : ""
          }`}
        >
          <img
            src={url}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
            onError={() => onFailed(url)}
          />
          {index === shown.length - 1 && extra > 0 && (
            <span className="absolute inset-0 grid place-items-center bg-zinc-900/45 text-[18px] font-semibold text-white">
              +{extra}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
