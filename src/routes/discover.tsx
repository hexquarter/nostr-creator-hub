import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { PostCard, postFromNote } from "@/components/post-card";
import { useNostr } from "@/components/nostr-provider";
import { useUI } from "@/components/modals/ui-provider";
import { extractHashtags, fetchFeed, type FeedNote } from "@/lib/nostr/social";
import { compactNumber } from "@/lib/format";
import { toast } from "sonner";
import {
  Search,
  TrendingUp,
  Flame,
  Mic,
  Newspaper,
  Bitcoin,
  Code2,
  Camera,
  Music2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Crays" },
      {
        name: "description",
        content:
          "Discover top creators, trending hashtags, and rising voices across Bitcoin and Nostr.",
      },
    ],
  }),
  component: Discover,
});

const categories = [
  { label: "Bitcoin", tag: "bitcoin", icon: Bitcoin, gradient: "from-amber-400 to-orange-500" },
  { label: "Dev & Code", tag: "nostr", icon: Code2, gradient: "from-violet-500 to-fuchsia-500" },
  {
    label: "Photography",
    tag: "photography",
    icon: Camera,
    gradient: "from-emerald-400 to-cyan-500",
  },
  { label: "Music", tag: "music", icon: Music2, gradient: "from-rose-400 to-pink-500" },
  { label: "Spaces", tag: "spaces", icon: Mic, gradient: "from-sky-400 to-indigo-500" },
  { label: "Writing", tag: "writing", icon: Newspaper, gradient: "from-zinc-700 to-zinc-900" },
];

function Discover() {
  const nostr = useNostr();
  const ui = useUI();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [notes, setNotes] = useState<FeedNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchFeed({
        limit: 60,
        tag: tag ?? undefined,
        search: query.trim() || undefined,
        timeout: 6000,
      });
      setNotes(result);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [tag, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const hashtags = useMemo(() => extractHashtags(notes).slice(0, 5), [notes]);

  const creators = useMemo(() => {
    const seen = new Set<string>();
    const list = [];
    for (const note of notes) {
      if (note.author.pubkey === nostr.account?.pubkey) continue;
      if (seen.has(note.author.pubkey)) continue;
      seen.add(note.author.pubkey);
      list.push(note.author);
      if (list.length >= 4) break;
    }
    return list;
  }, [notes, nostr.account?.pubkey]);

  return (
    <PageShell
      title="Discover"
      subtitle="Find new creators, trending hashtags, and rising voices."
      actions={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
          className="relative hidden sm:block"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the protocol…"
            className="w-72 rounded-xl bg-white py-2 pl-9 pr-3 text-[13px] ring-1 ring-black/5 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand/40"
          />
        </form>
      }
    >
      {/* Categories */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {categories.map((c) => {
          const active = tag === c.tag;
          return (
            <button
              key={c.label}
              onClick={() => setTag(active ? null : c.tag)}
              className={`group flex flex-col items-start gap-3 rounded-2xl p-4 text-left shadow-card ring-1 transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
                active ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white ring-black/5"
              }`}
            >
              <div
                className={`grid size-10 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm ${c.gradient}`}
              >
                <c.icon className="size-5" strokeWidth={2.2} />
              </div>
              <div>
                <p
                  className={`text-[13px] font-semibold ${active ? "text-white" : "text-zinc-900"}`}
                >
                  {c.label}
                </p>
                <p className={`text-[11px] ${active ? "text-zinc-300" : "text-zinc-500"}`}>
                  {active ? "Filtering" : `#${c.tag}`}
                </p>
              </div>
            </button>
          );
        })}
      </section>

      {tag && (
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          Showing posts tagged <span className="font-semibold text-zinc-900">#{tag}</span>
          <button onClick={() => setTag(null)} className="font-semibold text-brand hover:underline">
            Clear
          </button>
        </div>
      )}

      {/* Trending + Rising */}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
          <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Flame className="size-3.5 text-orange-500" /> Trending now
            </h3>
            <span className="text-[11px] text-zinc-400">from recent notes</span>
          </header>
          <ol className="divide-y divide-zinc-100">
            {hashtags.length === 0 ? (
              <li className="px-5 py-6 text-[12.5px] text-zinc-400">
                No hashtags in the latest notes yet.
              </li>
            ) : (
              hashtags.map((t, i) => (
                <li key={t.tag}>
                  <button
                    onClick={() => setTag(t.tag)}
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50/80"
                  >
                    <span className="w-5 text-right text-[13px] font-semibold tabular-nums text-zinc-300">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-[10.5px] font-medium uppercase tracking-wide text-zinc-400">
                        Hashtag
                      </p>
                      <p className="text-[13.5px] font-semibold text-zinc-900">#{t.tag}</p>
                      <p className="text-[11px] text-zinc-400">
                        {t.count} recent {t.count === 1 ? "post" : "posts"}
                      </p>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ol>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
          <header className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <TrendingUp className="size-3.5 text-brand" /> Rising creators
            </h3>
          </header>
          {creators.length === 0 ? (
            <p className="text-[12.5px] text-zinc-400">Fetching creators from relays…</p>
          ) : (
            <ul className="space-y-4">
              {creators.map((profile) => {
                const name = profile.displayName || profile.name || profile.handle;
                const isFollowed = nostr.isFollowing(profile.pubkey);
                return (
                  <li key={profile.pubkey} className="flex items-center gap-3">
                    <Link
                      to="/profile"
                      search={{ pubkey: profile.pubkey }}
                      className="group flex min-w-0 flex-1 items-center gap-3"
                    >
                      {profile.picture ? (
                        <img
                          src={profile.picture}
                          alt=""
                          className="size-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <AvatarTile seed={name} size={40} />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-zinc-900 group-hover:underline">
                          {name}
                        </p>
                        <p className="truncate text-[11px] text-zinc-400">{profile.handle}</p>
                      </div>
                    </Link>
                    <button
                      onClick={async () => {
                        if (!ui.requireAuth("follow creators")) return;
                        try {
                          const next = await nostr.toggleFollow(profile.pubkey);
                          toast.success(next ? `Following ${name}` : `Unfollowed ${name}`);
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Couldn't update follow list.",
                          );
                        }
                      }}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        isFollowed
                          ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                          : "bg-zinc-900 text-white hover:bg-zinc-700"
                      }`}
                    >
                      {isFollowed ? "Following" : "Follow"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Results */}
      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {query ? `Results for “${query}”` : tag ? `#${tag}` : "Latest notes"}
          </h3>
          {loading && <Loader2 className="size-4 animate-spin text-zinc-400" />}
        </header>
        {notes.length === 0 && !loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-[12.5px] text-zinc-500 shadow-card ring-1 ring-black/5">
            Nothing matched. Try a different search or hashtag.
          </div>
        ) : (
          <div className="space-y-5">
            {notes.slice(0, 20).map((note) => (
              <PostCard key={note.id} post={postFromNote(note)} />
            ))}
          </div>
        )}
      </section>

      <span className="hidden">{compactNumber(notes.length)}</span>
    </PageShell>
  );
}
