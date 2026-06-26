import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { PostCard, type Post } from "@/components/post-card";
import { UserPlus, Filter } from "lucide-react";

export const Route = createFileRoute("/following")({
  head: () => ({
    meta: [
      { title: "Following — Crays" },
      { name: "description", content: "A focused feed of the creators you follow on Crays." },
    ],
  }),
  component: Following,
});

const recent = [
  { name: "Lyn Alden", handle: "@lyn", live: false },
  { name: "Jack D.", handle: "@jack", live: true },
  { name: "Pierre R.", handle: "@pierre", live: false },
  { name: "Marty Bent", handle: "@marty", live: false },
  { name: "Elena V.", handle: "@elena", live: true },
  { name: "Aura Labs", handle: "@aura", live: false },
  { name: "Saifedean", handle: "@saif", live: false },
  { name: "Erik Wall", handle: "@erik", live: false },
];

const posts: Post[] = [
  {
    id: "f1",
    author: "Pierre Rochard",
    handle: "@pierre",
    verified: true,
    time: "12m",
    content:
      "Treasury Bitcoin policy is no longer fringe — three new corporates added BTC to their balance sheet this week alone. Quietly, the standard is shifting.",
    replies: 22,
    zaps: "94k",
    reposts: 18,
  },
  {
    id: "f2",
    author: "Elena Vega",
    handle: "@elena",
    verified: true,
    time: "1h",
    content:
      "Spent the weekend rebuilding our onboarding so new users can receive their first zap before they even know what a private key is. UX is the killer feature.",
    image: {
      gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 30%, #6366f1 75%, #f472b6 100%)",
      aspect: "aspect-[16/9]",
    },
    replies: 41,
    zaps: "238k",
    reposts: 54,
  },
  {
    id: "f3",
    author: "Marty Bent",
    handle: "@marty",
    time: "3h",
    content:
      "Hash rate up, difficulty up, fees stable, miners selling less than they produce. Quiet bull setup if you actually look at the numbers instead of the noise.",
    replies: 16,
    zaps: "61k",
    reposts: 12,
  },
];

function Following() {
  return (
    <PageShell
      title="Following"
      subtitle="Only posts from the creators you follow — no algorithm in the way."
      actions={
        <button className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-zinc-700 shadow-card ring-1 ring-black/5 hover:bg-zinc-50">
          <Filter className="size-3.5" /> All updates
        </button>
      }
    >
      {/* Recent activity strip */}
      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Recent activity
          </h3>
          <button className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
            <UserPlus className="size-3" /> Find people
          </button>
        </div>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 no-scrollbar">
          {recent.map((c) => (
            <button key={c.handle} className="group shrink-0 text-center">
              <div
                className={`relative mb-2 rounded-full p-0.5 ${
                  c.live ? "bg-gradient-to-br from-rose-500 to-amber-400" : "bg-zinc-200"
                }`}
              >
                <div className="rounded-full bg-white p-0.5">
                  <AvatarTile seed={c.name} size={52} />
                </div>
                {c.live && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm">
                    Live
                  </span>
                )}
              </div>
              <p className="max-w-[60px] truncate text-[10.5px] font-medium text-zinc-600 group-hover:text-zinc-900">
                {c.handle}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-full bg-white p-1 text-[12px] font-medium shadow-card ring-1 ring-black/5 w-fit">
        <button className="rounded-full bg-zinc-900 px-3.5 py-1.5 text-white">Latest</button>
        <button className="rounded-full px-3.5 py-1.5 text-zinc-500 hover:text-zinc-900">Top zaps</button>
        <button className="rounded-full px-3.5 py-1.5 text-zinc-500 hover:text-zinc-900">Media</button>
        <button className="rounded-full px-3.5 py-1.5 text-zinc-500 hover:text-zinc-900">Articles</button>
      </div>

      <div className="space-y-5">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
    </PageShell>
  );
}
