import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AvatarTile } from "./avatar-tile";
import { PostCard, postFromNote } from "./post-card";
import { noteFromEvent, noteIsReply, type FeedNote } from "@/lib/nostr/social";
import { queryEvents } from "@/lib/nostr/relays";
import type { Profile } from "@/lib/nostr/profiles";

/** How many featured creators the section surfaces. */
const FEATURED_LIMIT = 10;
/** Vertical stories kept per creator. */
const STORIES_PER_CREATOR = 6;
/** How deep the per-creator media fetch goes. */
const MEDIA_FETCH_LIMIT = 150;

type CreatorMedia = {
  note: FeedNote;
  image?: string;
  video?: string;
  poster?: string;
  /** Width / height from the NIP-68 `dim` tag, when declared. */
  ratio?: number;
  /** True when the asset is known to be vertical (declared or probed). */
  vertical?: boolean;
};

function toCreatorMedia(note: FeedNote): CreatorMedia | null {
  if (note.images.length === 0 && note.videos.length === 0) return null;
  const video = note.videos[0];
  const poster = note.media.find((item) => item.poster)?.poster ?? note.images[0];
  // NIP-68 declares dimensions; treat a portrait ratio as story-like.
  const dim = note.media[0]?.dim;
  const match = dim ? /(\d+)x(\d+)/.exec(dim) : null;
  const ratio = match ? Number(match[1]) / Number(match[2]) : undefined;
  const vertical = video
    ? ratio !== undefined
      ? ratio < 1.05
      : true
    : ratio !== undefined
      ? ratio < 1.05
      : undefined;
  return { note, image: note.images[0], video, poster, ratio, vertical };
}

/** Probe an image's natural aspect ratio (width / height). */
function probeAspectRatio(url: string, onResult: (ratio: number) => void) {
  const img = new Image();
  img.onload = () => onResult(img.naturalWidth / img.naturalHeight);
  img.onerror = () => onResult(1);
  img.src = url;
}

/**
 * The featured-creators tray: small avatars of everyone who published
 * recently (gradient ring = has vertical stories), tap to open their latest
 * post — plus the story carousel of vertical media beneath it.
 */
export function FeaturedCreators({ profiles, notes }: { profiles: Profile[]; notes: FeedNote[] }) {
  const [fetchedMedia, setFetchedMedia] = useState<Map<string, CreatorMedia[]>>(new Map());
  // Probed aspect ratios per media url (for assets without declared dims).
  const [probed, setProbed] = useState<Map<string, number>>(new Map());
  const [openPost, setOpenPost] = useState<FeedNote | null>(null);
  const creatorKey = profiles
    .slice(0, FEATURED_LIMIT)
    .map((p) => p.pubkey)
    .join(",");

  // The story row reports its width so the card count can follow the space.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const attachRow = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    rowRef.current = node;
    if (!node) return;
    observerRef.current = new ResizeObserver((entries) => {
      setRowWidth(entries[0].contentRect.width);
    });
    observerRef.current.observe(node);
  }, []);

  // Media already present in the current feed slice.
  const feedMedia = new Map<string, CreatorMedia[]>();
  for (const note of notes) {
    const media = toCreatorMedia(note);
    if (!media) continue;
    const list = feedMedia.get(note.author.pubkey) ?? [];
    if (list.length >= STORIES_PER_CREATOR) continue;
    list.push(media);
    feedMedia.set(note.author.pubkey, list);
  }

  // Dedicated fetch: recent picture/video posts (kinds 1, 20, 21, 22) from
  // the featured creators, so cards show stories even when the feed slice
  // didn't include their media.
  useEffect(() => {
    if (!creatorKey) return;
    const pubkeys = creatorKey.split(",");
    let cancelled = false;
    void queryEvents(
      { kinds: [1, 20, 21, 22], authors: pubkeys, limit: MEDIA_FETCH_LIMIT },
      { timeout: 6000 },
    )
      .then((events) => {
        if (cancelled) return;
        const map = new Map<string, CreatorMedia[]>();
        for (const event of [...events].sort((a, b) => b.created_at - a.created_at)) {
          if (noteIsReply(event)) continue;
          const media = toCreatorMedia(noteFromEvent(event));
          if (!media) continue;
          const list = map.get(event.pubkey) ?? [];
          if (list.length >= STORIES_PER_CREATOR) continue;
          list.push(media);
          map.set(event.pubkey, list);
        }
        setFetchedMedia(map);
      })
      .catch(() => {
        // The feed-slice media remains as fallback.
      });
    return () => {
      cancelled = true;
    };
  }, [creatorKey]);

  // Merge: feed-slice media first, then the dedicated fetch, deduped by id.
  const mediaOf = (pubkey: string): CreatorMedia[] => {
    const merged: CreatorMedia[] = [];
    const seen = new Set<string>();
    for (const source of [feedMedia.get(pubkey) ?? [], fetchedMedia.get(pubkey) ?? []]) {
      for (const item of source) {
        if (seen.has(item.note.id)) continue;
        seen.add(item.note.id);
        merged.push(item);
        if (merged.length >= STORIES_PER_CREATOR) return merged;
      }
    }
    return merged;
  };

  const isVertical = (item: CreatorMedia) =>
    item.vertical ??
    (() => {
      const ratio = probed.get(item.image ?? item.poster ?? "");
      return ratio === undefined ? false : ratio < 1.05;
    })();

  // Probe undeclared image aspect ratios so tiles can adapt to the media.
  useEffect(() => {
    for (const profile of profiles) {
      for (const item of mediaOf(profile.pubkey)) {
        const url = item.image ?? item.poster;
        if (item.ratio !== undefined || !url || probed.has(url)) continue;
        probeAspectRatio(url, (ratio) => setProbed((prev) => new Map(prev).set(url, ratio)));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorKey, fetchedMedia, probed]);

  if (profiles.length === 0) return null;

  // Vertical-first, not vertical-only: portrait stories lead each creator's
  // media, and their other image/video posts still become stories (cropped
  // to the tile) so the carousel stays populated.
  const storyCreators = profiles
    .map((profile) => {
      const media = mediaOf(profile.pubkey);
      return {
        profile,
        media: [
          ...media.filter((item) => isVertical(item)),
          ...media.filter((item) => !isVertical(item)),
        ],
      };
    })
    .filter((entry) => entry.media.length > 0);
  const allStories = storyCreators.flatMap(({ profile, media }) =>
    media.map((item) => ({ profile, item })),
  );

  // Round-robin the stories so the visible cards are always from different
  // creators first: everyone's latest story, then second stories, and so on —
  // variety first, with deeper posts only filling leftover slots.
  const diversified: typeof allStories = [];
  for (let round = 0; ; round++) {
    let added = false;
    for (const { profile, media } of storyCreators) {
      const story = media[round];
      if (story) {
        diversified.push({ profile, item: story });
        added = true;
      }
    }
    if (!added) break;
  }

  // Render exactly as many story cards as divide evenly into the row: no
  // overflow, no ragged leftovers. The row reports its width and the count
  // follows (nominal card pitch ~240px, floor 176px).
  const fittedCount =
    rowWidth > 0
      ? Math.max(1, Math.min(allStories.length, Math.floor((rowWidth + 12) / 252)))
      : Math.min(allStories.length, 3);
  const visibleStories = diversified.slice(0, fittedCount);

  // The tray: every featured creator with their latest post one tap away —
  // gradient ring marks creators with stories, neutral ring = text posters.
  const trayItems = profiles
    .map((profile) => {
      const stories = mediaOf(profile.pubkey).filter((item) => isVertical(item));
      const latest =
        stories[0]?.note ?? notes.find((note) => note.author.pubkey === profile.pubkey);
      return { profile, hasStory: stories.length > 0, latest };
    })
    .filter((item) => item.latest);

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[14px] font-semibold tracking-tight text-zinc-900">
          Featured creators
        </h2>
        <span className="text-[11px] font-medium text-zinc-400">Recent posts</span>
      </div>

      {/* At-a-glance tray: who published recently, one tap to their post.
          Items flex to fill the row edge-to-edge; scrolls only on overflow. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {trayItems.map(({ profile, hasStory, latest }) => {
          const name = profile.displayName || profile.name || profile.handle;
          return (
            <button
              key={profile.pubkey}
              onClick={() => setOpenPost(latest)}
              className="flex min-w-16 flex-1 flex-col items-center gap-1.5"
              title={`Open ${name}'s latest post`}
            >
              <span
                className={`rounded-full p-[2.5px] transition-transform hover:scale-105 ${
                  hasStory
                    ? "bg-gradient-to-tr from-amber-400 via-brand to-violet-500"
                    : "bg-zinc-200"
                }`}
              >
                {profile.picture ? (
                  <img
                    src={profile.picture}
                    alt=""
                    className="size-12 rounded-full object-cover ring-2 ring-white"
                  />
                ) : (
                  <AvatarTile seed={name} size={48} />
                )}
              </span>
              <span className="w-full truncate text-center text-[10.5px] font-medium text-zinc-600">
                {name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Story cards: vertical media first, one post per card — exactly as
          many as divide evenly into the row width. */}
      {visibleStories.length > 0 && (
        <div ref={attachRow} className="-mx-4 flex gap-3 px-4 sm:mx-0 sm:px-0">
          {visibleStories.map(({ profile, item }) => (
            <div
              key={item.note.id}
              className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated"
            >
              <Link
                to="/profile"
                search={{ pubkey: profile.pubkey }}
                className="flex items-center gap-2.5 px-3 py-2.5"
              >
                {profile.picture ? (
                  <img
                    src={profile.picture}
                    alt=""
                    className="size-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <AvatarTile seed={profile.displayName || profile.handle} size={32} />
                )}
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-zinc-900">
                  {profile.displayName || profile.name || profile.handle}
                </span>
              </Link>

              <button
                onClick={() => setOpenPost(item.note)}
                className="relative block aspect-[4/5] w-full cursor-pointer bg-gradient-to-br from-zinc-800 via-zinc-900 to-black"
                aria-label="Open post"
              >
                {item.video ? (
                  <>
                    {item.poster ? (
                      <img
                        src={item.poster}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="absolute inset-0 size-full object-cover object-center"
                      />
                    ) : (
                      <video
                        src={item.video}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        ref={(el) => el?.setAttribute("referrerpolicy", "no-referrer")}
                        onError={(e) => {
                          // 403/expire on X-hosted clips: drop the dead
                          // element so the gradient stage shows instead.
                          e.currentTarget.style.display = "none";
                        }}
                        className="absolute inset-0 size-full object-cover object-center"
                      />
                    )}
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-zinc-900/60 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white backdrop-blur">
                      <Play className="size-2.5 fill-white" /> Video
                    </span>
                  </>
                ) : item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="absolute inset-0 size-full object-cover object-center"
                  />
                ) : null}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* The tapped post, opened as a full post. */}
      <Dialog open={!!openPost} onOpenChange={(o) => !o && setOpenPost(null)}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-[520px]">
          <button
            onClick={() => setOpenPost(null)}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-white/80 text-zinc-700 shadow-card ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white"
          >
            <X className="size-4" />
          </button>
          {openPost && <PostCard flat post={postFromNote(openPost)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
