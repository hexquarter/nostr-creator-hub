import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { PostCard, postFromNote } from "@/components/post-card";
import { useNostr } from "@/components/nostr-provider";
import { useUI } from "@/components/modals/ui-provider";
import { fetchProfiles, type Profile } from "@/lib/nostr/profiles";
import { fetchFeed, type FeedNote } from "@/lib/nostr/social";
import { UserPlus, Filter, Loader2 } from "lucide-react";

export const Route = createFileRoute("/following")({
  head: () => ({
    meta: [
      { title: "Following — Crays" },
      { name: "description", content: "A focused feed of the creators you follow on Crays." },
    ],
  }),
  component: Following,
});

type Tab = "latest" | "zaps" | "media" | "articles";
const TABS: { id: Tab; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "zaps", label: "Top zaps" },
  { id: "media", label: "Media" },
  { id: "articles", label: "Articles" },
];

function Following() {
  const nostr = useNostr();
  const ui = useUI();
  const [tab, setTab] = useState<Tab>("latest");
  const [notes, setNotes] = useState<FeedNote[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const followingKey = nostr.following.join(",");

  const load = useCallback(async () => {
    if (nostr.following.length === 0) {
      setNotes([]);
      setProfiles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [feed, profs] = await Promise.all([
        fetchFeed({ authors: nostr.following, limit: 60, includeReplies: false, timeout: 6500 }),
        fetchProfiles(nostr.following.slice(0, 20)),
      ]);
      setNotes(feed);
      setProfiles(Array.from(profs.values()));
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followingKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (tab === "media") return notes.filter((note) => note.images.length > 0);
    if (tab === "articles") return notes.filter((note) => note.event.kind === 30023);
    if (tab === "zaps") return [...notes].sort((a, b) => b.counts.zapSats - a.counts.zapSats);
    return notes;
  }, [notes, tab]);

  return (
    <PageShell
      title="Following"
      subtitle="Only posts from the creators you follow — no algorithm in the way."
      actions={
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-zinc-700 shadow-card ring-1 ring-black/5 hover:bg-zinc-50"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Filter className="size-3.5" />
          )}
          Refresh
        </button>
      }
    >
      {/* Recent activity strip */}
      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            People you follow
          </h3>
          <button
            onClick={() => ui.openAuth({ intent: "find people to follow" })}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
          >
            <UserPlus className="size-3" /> Find people
          </button>
        </div>
        {profiles.length === 0 ? (
          <p className="text-[12.5px] text-zinc-400">
            {nostr.account
              ? "You aren't following anyone yet. Discover creators to fill this feed."
              : "Sign in to see the creators you follow."}
          </p>
        ) : (
          <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 no-scrollbar">
            {profiles.map((profile) => {
              const name = profile.displayName || profile.name || profile.handle;
              return (
                <button
                  key={profile.pubkey}
                  onClick={() => void navigator.clipboard.writeText(profile.npub)}
                  title={`Copy ${profile.npub}`}
                  className="group shrink-0 text-center"
                >
                  <div className="relative mb-2 rounded-full bg-gradient-to-br from-brand to-violet-500 p-0.5">
                    <div className="rounded-full bg-white p-0.5">
                      {profile.picture ? (
                        <img
                          src={profile.picture}
                          alt=""
                          className="size-[52px] rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid size-[52px] place-items-center rounded-full bg-zinc-100 text-[14px] font-semibold text-zinc-500">
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="max-w-[64px] truncate text-[10.5px] font-medium text-zinc-600 group-hover:text-zinc-900">
                    {profile.handle || name}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-full bg-white p-1 text-[12px] font-medium shadow-card ring-1 ring-black/5 w-fit">
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
          <Loader2 className="size-4 animate-spin" /> Reading relays…
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-black/5">
          <p className="text-[14px] font-semibold text-zinc-900">Nothing here yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">
            Follow more creators and their notes will land in this feed.
          </p>
          <button
            onClick={() => ui.openAuth({ intent: "find creators to follow" })}
            className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
          >
            Discover creators
          </button>
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
