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
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { nip19, type NostrEvent } from "nostr-tools";
import { AvatarTile } from "./avatar-tile";
import { useUI } from "./modals/ui-provider";
import { useNostr } from "./nostr-provider";
import { compactNumber, timeAgo } from "@/lib/format";
import { contentWithoutImages, type FeedNote } from "@/lib/nostr/social";
import { shortNpub } from "@/lib/nostr/profiles";
import {
  isBadgeActive,
  useCreatorBadges,
  usePostUnlocks,
  DEFAULT_BADGE_SATS,
} from "@/lib/nostr/badges";
import { usePreferences } from "@/lib/preferences";
import { formatUsd, satsToUsd, useBtcPrice } from "@/lib/nostr/price";
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
  time: string;
  content: string;
  avatar?: string;
  image?: { gradient?: string; aspect?: string; url?: string };
  images?: string[];
  sensitive?: { reason: string; note?: string };
  replies: number;
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
    content: contentWithoutImages(note.content, images),
    avatar: profile.picture,
    images,
    image: images[0] ? { url: images[0] } : undefined,
    premium: note.premium,
    premiumSats: note.premiumSats,
    premiumUnlockSats: note.premiumUnlockSats,
    sensitive: note.contentWarning
      ? { reason: note.contentWarning, note: note.contentWarning }
      : undefined,
    replies: note.counts.replies,
    reposts: note.counts.reposts,
    zaps:
      note.counts.zapSats > 0
        ? compactNumber(note.counts.zapSats)
        : compactNumber(note.counts.zaps),
    event: note.event,
    authorPubkey: profile.pubkey,
  };
}

export function PostCard({ post }: { post: Post }) {
  const ui = useUI();
  const nostr = useNostr();
  const preferences = usePreferences();
  const btc = useBtcPrice();
  const [bookmarked, setBookmarked] = useState(() => nostr.bookmarks.includes(post.id));
  const [reposted, setReposted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());

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
  const locked = Boolean(post.premium && !isAuthor && !badge && !unlockedPost);
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

  const images = (
    post.images?.length ? post.images : post.image?.url ? [post.image.url] : []
  ).filter((url) => !failedImages.has(url));

  return (
    <article className="min-w-0 space-y-4 overflow-hidden rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated sm:p-6">
      <header className="flex items-start justify-between gap-2">
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
            {!locked && (
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
      ) : (
        <PostContent content={post.content} />
      )}

      {locked && images.length > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-zinc-100">
          <Lock className="size-3.5 shrink-0 text-zinc-400" />
          <p className="text-[11.5px] text-zinc-500">
            {images.length} members-only image{images.length === 1 ? "" : "s"} hidden
          </p>
        </div>
      )}

      {!locked && images.length > 0 && (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-zinc-100 ring-1 ring-black/5">
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
          ) : (
            <MediaGrid
              images={images}
              onFailed={(url) => setFailedImages((prev) => new Set(prev).add(url))}
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

      {images.length === 0 && post.image?.gradient && (
        <div
          className={`w-full overflow-hidden rounded-xl ring-1 ring-black/5 ${post.image.aspect ?? "aspect-[16/10]"}`}
          style={{ background: post.image.gradient }}
        />
      )}

      <footer className="flex items-center gap-1 pt-1 text-zinc-500">
        <Action
          icon={MessageCircle}
          label={String(post.replies)}
          hover="hover:text-brand"
          onClick={() =>
            ui.openCompose({
              mode: "reply",
              replyTo: post.handle,
              replyToEvent: post.event,
            })
          }
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
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label?: string;
  hover: string;
  accent?: boolean;
  onClick?: () => void;
  active?: boolean;
  activeClass?: string;
}) {
  return (
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
