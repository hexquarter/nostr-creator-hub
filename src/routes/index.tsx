import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { Composer } from "@/components/composer";
import { FeaturedCreators } from "@/components/featured-creators";
import { PostCard, postFromNote } from "@/components/post-card";
import { MobileNav } from "@/components/mobile-nav";
import { MobileTopBar } from "@/components/mobile-topbar";
import { useNostr } from "@/components/nostr-provider";
import { useUI } from "@/components/modals/ui-provider";
import { fetchFeed, type FeedNote } from "@/lib/nostr/social";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Crays — A premium Nostr social client for Bitcoin creators" },
      {
        name: "description",
        content:
          "Follow creators, unlock premium content with Lightning, and grow a paid audience on the open Nostr protocol.",
      },
      { property: "og:title", content: "Crays — Nostr for Bitcoin creators" },
      {
        property: "og:description",
        content:
          "Follow creators, unlock premium content with Lightning, and grow a paid audience on the open Nostr protocol.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

type Tab = "for-you" | "following";
const TABS: { id: Tab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "following", label: "Following" },
];

function Home() {
  const nostr = useNostr();
  const ui = useUI();
  const [tab, setTab] = useState<Tab>("for-you");
  const [notes, setNotes] = useState<FeedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const followingKey = nostr.following.join(",");

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoading(true);
      setError("");
      try {
        const authors =
          tab === "following" && nostr.following.length > 0 ? nostr.following : undefined;
        const result = await fetchFeed({ limit: 40, authors, timeout: 6000 });
        if (signal?.cancelled) return;
        if (authors && result.length === 0) {
          const fallback = await fetchFeed({ limit: 30, timeout: 6000 });
          if (signal?.cancelled) return;
          setNotes(fallback);
        } else {
          setNotes(result);
        }
      } catch (err) {
        if (!signal?.cancelled) {
          setError(err instanceof Error ? err.message : "Relays are taking a moment.");
        }
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    // followingKey captures follow-list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab, followingKey],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const creators = useMemo(() => {
    const seen = new Set<string>();
    return notes
      .map((note) => note.author)
      .filter((profile) => {
        if (seen.has(profile.pubkey)) return false;
        seen.add(profile.pubkey);
        return true;
      })
      .slice(0, 10);
  }, [notes]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 sm:px-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[224px_minmax(0,1fr)_320px]">
        <LeftSidebar />

        <main className="min-w-0 space-y-6 pb-28 lg:py-6 lg:pb-6">
          <MobileTopBar />

          <header className="hidden items-end justify-between lg:flex">
            <div>
              <h1 className="text-[26px] font-semibold leading-none tracking-tight text-zinc-900">
                Home
              </h1>
              <p className="mt-1.5 text-[13px] text-zinc-500">
                {tab === "following"
                  ? "Only posts from the creators you follow — no algorithm in the way."
                  : "Live from the Nostr relays, as it happens."}
              </p>
            </div>
            <div className="hidden items-center gap-1 rounded-full bg-white p-1 text-[12px] font-medium shadow-card ring-1 ring-black/5 sm:flex">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    if (t.id === "following" && !nostr.account) {
                      ui.openAuth({ intent: "see the creators you follow" });
                      return;
                    }
                    setTab(t.id);
                  }}
                  className={`rounded-full px-3 py-1 transition-colors ${
                    tab === t.id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </header>

          <FeaturedCreators profiles={creators} />

          <div className="hidden lg:block">
            <Composer />
          </div>

          {loading ? (
            <LoadingFeed />
          ) : error ? (
            <EmptyState
              title="Relays are being slow"
              body={error}
              actionLabel="Try again"
              onAction={() => void load()}
            />
          ) : notes.length === 0 ? (
            <EmptyState
              title={tab === "following" ? "Your following feed is quiet" : "No notes yet"}
              body={
                tab === "following"
                  ? "Follow a few creators and their posts will show up here. We're showing the global feed in the meantime."
                  : "Be the first to post something on this relay set."
              }
              actionLabel={tab === "following" ? "Discover creators" : "Write a post"}
              onAction={() => {
                if (tab === "following") setTab("for-you");
                else ui.openCompose({ mode: "post" });
              }}
            />
          ) : (
            <div className="space-y-5">
              {notes.map((note) => (
                <PostCard key={note.id} post={postFromNote(note)} />
              ))}
            </div>
          )}
        </main>

        <RightSidebar />
      </div>
      <MobileNav />
    </div>
  );
}

function LoadingFeed() {
  return (
    <div className="space-y-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 sm:p-6"
        >
          <div className="flex gap-3">
            <div className="size-10 rounded-full bg-zinc-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-zinc-200" />
              <div className="h-2.5 w-20 rounded bg-zinc-100" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-zinc-100" />
            <div className="h-3 w-4/5 rounded bg-zinc-100" />
          </div>
        </div>
      ))}
      <p className="flex items-center justify-center gap-2 text-[12px] text-zinc-400">
        <Loader2 className="size-3.5 animate-spin" /> Reading relays…
      </p>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-black/5">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
        <Sparkles className="size-6" />
      </div>
      <p className="mt-3 text-[15px] font-semibold text-zinc-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">{body}</p>
      <button
        onClick={onAction}
        className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
      >
        {actionLabel}
      </button>
    </div>
  );
}
