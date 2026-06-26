import {
  MessageCircle,
  Zap,
  Repeat2,
  Bookmark,
  Share2,
  MoreHorizontal,
  BadgeCheck,
  Crown,
} from "lucide-react";
import { AvatarTile } from "./avatar-tile";

export type Post = {
  id: string;
  author: string;
  handle: string;
  verified?: boolean;
  premium?: boolean;
  time: string;
  content: string;
  image?: { gradient: string; aspect?: string };
  replies: number;
  zaps: string;
  reposts: number;
};

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="space-y-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated sm:p-6">
      <header className="flex items-start justify-between">
        <div className="flex min-w-0 gap-3">
          <AvatarTile seed={post.author} size={40} />
          <div className="min-w-0">
            <h4 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-zinc-900">
              <span className="truncate">{post.author}</span>
              {post.verified && (
                <BadgeCheck className="size-3.5 shrink-0 fill-brand text-white" />
              )}
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
        <button
          aria-label="More"
          className="grid size-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </header>

      <p className="max-w-[58ch] text-pretty text-[15px] leading-relaxed text-zinc-800">
        {post.content}
      </p>

      {post.image && (
        <div
          className={`w-full overflow-hidden rounded-xl ring-1 ring-black/5 ${
            post.image.aspect ?? "aspect-[16/10]"
          }`}
          style={{ background: post.image.gradient }}
        />
      )}

      <footer className="flex items-center gap-1 pt-1 text-zinc-500">
        <Action icon={MessageCircle} label={String(post.replies)} hover="hover:text-brand" />
        <Action icon={Repeat2} label={String(post.reposts)} hover="hover:text-emerald-600" />
        <Action icon={Zap} label={post.zaps} hover="hover:text-amber-500" accent />
        <div className="ml-auto flex">
          <Action icon={Bookmark} hover="hover:text-zinc-900" />
          <Action icon={Share2} hover="hover:text-zinc-900" />
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
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label?: string;
  hover: string;
  accent?: boolean;
}) {
  return (
    <button
      className={`group flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-zinc-500 transition-colors ${hover}`}
    >
      <Icon
        className={`size-[15px] ${accent ? "transition-transform group-hover:scale-110" : ""}`}
        strokeWidth={2}
      />
      {label && <span>{label}</span>}
    </button>
  );
}
