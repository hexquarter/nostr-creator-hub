import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { PostCard, postFromNote } from "@/components/post-card";
import { useNostr } from "@/components/nostr-provider";
import { useUI } from "@/components/modals/ui-provider";
import { fetchFeed, type FeedNote } from "@/lib/nostr/social";
import { Bookmark, FolderPlus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/bookmarks")({
  head: () => ({
    meta: [
      { title: "Bookmarks — Crays" },
      {
        name: "description",
        content: "Posts and articles you've saved privately with Nostr bookmarks.",
      },
    ],
  }),
  component: Bookmarks,
});

function Bookmarks() {
  const nostr = useNostr();
  const ui = useUI();
  const [notes, setNotes] = useState<FeedNote[]>([]);
  const [loading, setLoading] = useState(false);

  const idsKey = nostr.bookmarks.join(",");

  useEffect(() => {
    if (nostr.bookmarks.length === 0) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchFeed({ ids: nostr.bookmarks, includeReplies: true, limit: 100, timeout: 6000 })
      .then((result) => {
        if (!cancelled) setNotes(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return (
    <PageShell
      title="Bookmarks"
      subtitle="Saved privately to your Nostr bookmarks list."
      actions={
        <button
          onClick={() => ui.openAuth({ intent: "bookmark posts" })}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-black"
        >
          <FolderPlus className="size-3.5" /> How bookmarks work
        </button>
      }
    >
      <section className="flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5">
        <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-violet-500 text-white">
          <Bookmark className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-zinc-900">All bookmarks</p>
          <p className="text-[11px] text-zinc-500">
            {nostr.bookmarks.length} saved · stored as an encrypted kind-10003 list
          </p>
        </div>
      </section>

      {!nostr.account ? (
        <Empty
          title="Sign in to see your bookmarks"
          body="Crays stores bookmarks in your own Nostr bookmark list, so they follow your key."
          action="Sign in"
          onAction={() => ui.openAuth({ intent: "bookmark posts" })}
        />
      ) : loading ? (
        <p className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-zinc-400">
          <Loader2 className="size-4 animate-spin" /> Loading bookmarks…
        </p>
      ) : notes.length === 0 ? (
        <Empty
          title="No bookmarks yet"
          body="Tap the bookmark icon on any note and it lands here for later."
          action="Browse the feed"
          onAction={() => ui.openCompose({ mode: "post" })}
        />
      ) : (
        <div className="space-y-5">
          {notes.map((note) => (
            <PostCard key={note.id} post={postFromNote(note)} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function Empty({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-black/5">
      <p className="text-[14px] font-semibold text-zinc-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">{body}</p>
      <button
        onClick={onAction}
        className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
      >
        {action}
      </button>
    </div>
  );
}
