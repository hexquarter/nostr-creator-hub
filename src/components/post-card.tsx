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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { nip19, type NostrEvent } from "nostr-tools";
import { AvatarTile } from "./avatar-tile";
import { useUI } from "./modals/ui-provider";
import { useNostr } from "./nostr-provider";
import { compactNumber, timeAgo } from "@/lib/format";
import type { FeedNote } from "@/lib/nostr/social";
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
    content: note.content,
    avatar: profile.picture,
    images,
    image: images[0] ? { url: images[0] } : undefined,
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
  const [bookmarked, setBookmarked] = useState(() => nostr.bookmarks.includes(post.id));
  const [reposted, setReposted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [following, setFollowing] = useState(() =>
    post.authorPubkey ? nostr.isFollowing(post.authorPubkey) : false,
  );
  const isReal = Boolean(post.event && post.authorPubkey);

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

  const images = post.images?.length ? post.images : post.image?.url ? [post.image.url] : [];

  return (
    <article className="space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated sm:p-6">
      <header className="flex items-start justify-between">
        <div className="flex min-w-0 gap-3">
          {post.avatar ? (
            <img
              src={post.avatar}
              alt=""
              className="size-10 rounded-full object-cover ring-1 ring-black/5"
            />
          ) : (
            <AvatarTile seed={post.author} size={40} />
          )}
          <div className="min-w-0">
            <h4 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-zinc-900">
              <span className="truncate">{post.author}</span>
              {post.verified && <BadgeCheck className="size-3.5 shrink-0 fill-brand text-white" />}
              {post.premium && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                  <Crown className="size-2.5" /> Premium
                </span>
              )}
            </h4>
            <p className="text-[11.5px] text-zinc-400">
              {post.handle} · {post.time}
            </p>
          </div>
        </div>
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
            <DropdownMenuItem onClick={() => void toggleFollow()}>
              <UserPlus className="size-4" /> {following ? "Unfollow" : "Follow"} {post.handle}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => ui.openShare({ title: post.content.slice(0, 60), url: shareUrl })}
            >
              <LinkIcon className="size-4" /> Copy link
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(post.content);
                toast.success("Post copied");
              }}
            >
              <Copy className="size-4" /> Copy text
            </DropdownMenuItem>
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

      <p className="max-w-[58ch] whitespace-pre-wrap text-pretty text-[15px] leading-relaxed text-zinc-800">
        {post.content}
      </p>

      {images.length > 0 && (
        <div
          className={`relative w-full overflow-hidden rounded-xl ring-1 ring-black/5 ${
            post.image?.aspect ?? "aspect-[16/10]"
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
          ) : (
            <div className={images.length > 1 ? "grid grid-cols-2 gap-0.5" : ""}>
              {images.slice(0, 4).map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ))}
            </div>
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
