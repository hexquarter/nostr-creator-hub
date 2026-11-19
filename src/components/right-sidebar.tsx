import { ArrowRight, Crown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { AvatarTile } from "./avatar-tile";
import { useUI } from "./modals/ui-provider";
import { useNostr } from "./nostr-provider";
import { isCreatorPassActive, useCreatorPass } from "@/lib/nostr/creator-pass";
import { extractHashtags, fetchFeed, type FeedNote } from "@/lib/nostr/social";
import type { Profile } from "@/lib/nostr/profiles";

export function RightSidebar() {
  const ui = useUI();
  const nostr = useNostr();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<FeedNote[]>([]);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    fetchFeed({ limit: 40, timeout: 4500 })
      .then((result) => {
        if (!cancelled) setNotes(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const trending = useMemo(() => {
    const tags = extractHashtags(notes).slice(0, 3);
    return tags.length
      ? tags.map((t) => ({
          topic: "Trending on Nostr",
          tag: `#${t.tag}`,
          meta: `${t.count} ${t.count === 1 ? "post" : "posts"} recently`,
        }))
      : [
          { topic: "Nostr Protocols", tag: "#NIP17", meta: "Follow the hashtag to see posts" },
          { topic: "Bitcoin", tag: "#Bitcoin", meta: "Follow the hashtag to see posts" },
          { topic: "Lightning", tag: "#Lightning", meta: "Follow the hashtag to see posts" },
        ];
  }, [notes]);

  const recommended = useMemo(() => {
    const seen = new Set<string>();
    const list: Profile[] = [];
    for (const note of notes) {
      if (note.author.pubkey === nostr.account?.pubkey) continue;
      if (nostr.following.includes(note.author.pubkey)) continue;
      if (seen.has(note.author.pubkey)) continue;
      seen.add(note.author.pubkey);
      list.push(note.author);
      if (list.length >= 3) break;
    }
    return list;
  }, [notes, nostr.account?.pubkey, nostr.following]);

  const pass = useCreatorPass();
  const premiumActive = nostr.account ? isCreatorPassActive(pass) : false;

  return (
    <aside className="sticky top-0 hidden h-screen space-y-5 overflow-y-auto py-6 no-scrollbar xl:block">
      {!premiumActive && <CraysPremiumSidebarCard />}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Trending
          </h3>
          <TrendingUp className="size-3.5 text-zinc-400" />
        </header>
        <ul className="divide-y divide-zinc-100">
          {trending.map((t) => (
            <li key={t.tag}>
              <button
                onClick={() => void navigate({ to: "/discover" })}
                className="block w-full text-left px-5 py-3.5 transition-colors hover:bg-zinc-50/80"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  {t.topic}
                </p>
                <p className="mt-0.5 text-[13.5px] font-semibold text-zinc-900">{t.tag}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">{t.meta}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
        <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Recommended creators
        </h3>
        {recommended.length === 0 ? (
          <p className="text-[12px] text-zinc-400">Loading creators from your relays…</p>
        ) : (
          <ul className="space-y-4">
            {recommended.map((profile) => {
              const name = profile.displayName || profile.name || profile.handle;
              const isFollowed = followed[profile.pubkey] ?? nostr.isFollowing(profile.pubkey);
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
                        className="size-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <AvatarTile seed={name} size={36} />
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
                        setFollowed((f) => ({ ...f, [profile.pubkey]: next }));
                        toast.success(next ? `Following ${name}` : `Unfollowed ${name}`);
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Couldn't update follow list.",
                        );
                      }
                    }}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
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
    </aside>
  );
}

function CraysPremiumSidebarCard() {
  const nostr = useNostr();
  const ui = useUI();

  return (
    <section className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950 p-5 text-white shadow-card ring-1 ring-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-16 size-40 rounded-full bg-amber-500/25 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-14 -left-10 size-36 rounded-full bg-brand/20 blur-2xl"
      />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200 ring-1 ring-white/15">
          <Crown className="size-3" /> Crays premium
        </span>
        <h3 className="mt-3 text-balance text-[18px] font-semibold leading-tight tracking-tight">
          Keep 100% of your fan earnings
        </h3>
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-300">
          Your link-in-bio, memberships, content gating & analytics — with instant payouts and 0%
          platform fees.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="text-[26px] font-bold leading-none tracking-tight text-amber-100">
            €49
          </span>
          <span className="pb-0.5 text-[11px] font-semibold text-zinc-400">
            /month · Verified Creator Badge
          </span>
        </div>
        <p className="mt-1 text-[10.5px] text-zinc-400">0% platform cut · instant payouts</p>
        {nostr.account ? (
          <Link
            to="/premium"
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-amber-400"
          >
            Get Creator Badge <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button
            onClick={() => ui.openAuth({ intent: "become a Crays creator" })}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-amber-400"
          >
            Get Creator Badge <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </section>
  );
}
