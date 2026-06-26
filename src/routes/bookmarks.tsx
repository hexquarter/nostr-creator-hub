import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { PostCard, type Post } from "@/components/post-card";
import { Bookmark, FolderPlus } from "lucide-react";

export const Route = createFileRoute("/bookmarks")({
  head: () => ({
    meta: [
      { title: "Bookmarks — Crays" },
      { name: "description", content: "Posts and articles you've saved for later, organized into private collections." },
    ],
  }),
  component: Bookmarks,
});

const collections = [
  { name: "All", count: 84, active: true, gradient: "from-zinc-700 to-zinc-900" },
  { name: "Reading list", count: 32, gradient: "from-brand to-violet-500" },
  { name: "Macro essays", count: 18, gradient: "from-amber-500 to-rose-500" },
  { name: "Dev notes", count: 22, gradient: "from-emerald-500 to-cyan-500" },
  { name: "Quotes", count: 12, gradient: "from-fuchsia-500 to-pink-500" },
];

const posts: Post[] = [
  {
    id: "b1",
    author: "Lyn Alden",
    handle: "@lyn",
    verified: true,
    premium: true,
    time: "Saved 2d ago",
    content:
      "Reserve currency dynamics rarely shift in straight lines. The shift this cycle is happening in plumbing, not in headlines — and plumbing is exactly where Bitcoin is quietly winning.",
    replies: 84,
    zaps: "612k",
    reposts: 142,
  },
  {
    id: "b2",
    author: "Aura Labs",
    handle: "@aura",
    verified: true,
    time: "Saved 5d ago",
    content:
      "Three principles for designing zap-native apps: 1) Make sending feel cheaper than tapping like. 2) Receive should be one tap. 3) Never block the UI on a settlement confirmation.",
    image: {
      gradient: "linear-gradient(135deg, #18181b 0%, #1f2937 30%, #2563eb 75%, #22d3ee 100%)",
      aspect: "aspect-[16/9]",
    },
    replies: 28,
    zaps: "184k",
    reposts: 41,
  },
  {
    id: "b3",
    author: "Pierre Rochard",
    handle: "@pierre",
    time: "Saved 1w ago",
    content:
      "The interesting thing about hyperbitcoinization isn't that it happens overnight — it's that it happens in slow motion, in plain sight, and nobody calls it that until it's done.",
    replies: 18,
    zaps: "92k",
    reposts: 22,
  },
];

function Bookmarks() {
  return (
    <PageShell
      title="Bookmarks"
      subtitle="Saved privately to your client — organized however you like."
      actions={
        <button className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-black">
          <FolderPlus className="size-3.5" /> New collection
        </button>
      }
    >
      {/* Collections strip */}
      <section className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 no-scrollbar">
        {collections.map((c) => (
          <button
            key={c.name}
            className={`group shrink-0 overflow-hidden rounded-2xl text-left ring-1 ring-black/5 transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
              c.active ? "shadow-elevated" : "shadow-card"
            }`}
          >
            <div className={`flex h-20 w-44 items-end bg-gradient-to-br p-3 ${c.gradient}`}>
              <Bookmark className="size-4 text-white/80" />
            </div>
            <div className="bg-white px-3 py-2.5">
              <p className="text-[12.5px] font-semibold text-zinc-900">{c.name}</p>
              <p className="text-[11px] text-zinc-500">{c.count} saved</p>
            </div>
          </button>
        ))}
      </section>

      <div className="space-y-5">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
    </PageShell>
  );
}
