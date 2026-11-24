import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AvatarTile } from "./avatar-tile";
import { PostCard, postFromNote } from "./post-card";
import { noteFromEvent, noteIsReply, type FeedNote } from "@/lib/nostr/social";
import { queryEvents } from "@/lib/nostr/relays";
import type { Profile } from "@/lib/nostr/profiles";

type CreatorMedia = {
  note: FeedNote;
  image?: string;
  video?: string;
  poster?: string;
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
  const vertical = video
    ? match
      ? Number(match[2]) / Number(match[1]) > 1.05
      : true
    : match
      ? Number(match[2]) / Number(match[1]) > 1.05
      : undefined;
  return { note, image: note.images[0], video, poster, vertical };
}

/** Probe an image's natural size to learn whether it is portrait. */
function probeVertical(url: string, onResult: (vertical: boolean) => void) {
  const img = new Image();
  img.onload = () => onResult(img.naturalHeight / img.naturalWidth > 1.05);
  img.onerror = () => onResult(false);
  img.src = url;
}

/**
 * Instagram-story featured creators: a snap carousel where each card is
 * fronted by one of the creator's recent vertical (image/video) posts.
 * Tapping the media opens the full post; chevrons flip through the rest.
 * Only creators who actually have vertical media are shown; when none do,
 * the section falls back to the classic recent-creators avatar strip.
 */
export function FeaturedCreators({ profiles, notes }: { profiles: Profile[]; notes: FeedNote[] }) {
  const [fetchedMedia, setFetchedMedia] = useState<Map<string, CreatorMedia[]>>(new Map());
  // Probed aspect results per media url (for assets without declared dims).
  const [probed, setProbed] = useState<Map<string, boolean>>(new Map());
  const [openPost, setOpenPost] = useState<FeedNote | null>(null);
  const creatorKey = profiles.map((profile) => profile.pubkey).join(",");

  // Drag-to-slide with inertia: pointer dragging scrolls the row on
  // mouse/trackpad (touch already has native scrolling), releases glide with
  // momentum and settles onto the nearest card. A dragged pointer suppresses
  // the tile click so dragging never opens a post.
  const rowRef = useRef<HTMLDivElement>(null);
  const drag = useRef({
    down: false,
    startX: 0,
    scrollLeft: 0,
    velocity: 0,
    lastX: 0,
    lastT: 0,
  });
  const suppressClick = useRef(false);
  const rafRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  const snapToNearest = () => {
    const row = rowRef.current;
    const first = row?.firstElementChild as HTMLElement | null;
    if (!row || !first) return;
    const pitch = first.offsetWidth + 12;
    if (pitch <= 0) return;
    const target = Math.max(
      0,
      Math.min(Math.round(row.scrollLeft / pitch) * pitch, row.scrollWidth - row.clientWidth),
    );
    row.scrollTo({ left: target, behavior: "smooth" });
  };

  const stopMomentum = () => cancelAnimationFrame(rafRef.current);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || !rowRef.current) return;
    stopMomentum();
    drag.current = {
      down: true,
      startX: e.clientX,
      scrollLeft: rowRef.current.scrollLeft,
      velocity: 0,
      lastX: e.clientX,
      lastT: e.timeStamp,
    };
    setDragging(true);
    // Track the drag on the window instead of capturing the pointer:
    // setPointerCapture would retarget the tile's click event to the row.
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
  };

  const onWindowPointerMove = (e: PointerEvent) => {
    const state = drag.current;
    if (!state.down || !rowRef.current) return;
    const dx = e.clientX - state.startX;
    if (Math.abs(dx) > 6) suppressClick.current = true;
    const dt = Math.max(1, e.timeStamp - state.lastT);
    // Pointer velocity (px/ms) — the scroll runs opposite to the drag.
    state.velocity = (e.clientX - state.lastX) / dt;
    state.lastX = e.clientX;
    state.lastT = e.timeStamp;
    rowRef.current.scrollLeft = state.scrollLeft - dx;
  };

  const onWindowPointerUp = () => {
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerUp);
    endDrag();
  };

  const endDrag = () => {
    if (!drag.current.down) return;
    drag.current.down = false;
    setDragging(false);
    const row = rowRef.current;
    if (!row) return;
    // Glide with exponential decay, then settle on the nearest card.
    let velocity = Math.max(-2.5, Math.min(2.5, -drag.current.velocity));
    if (Math.abs(velocity) > 0.15) {
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(48, now - last);
        last = now;
        if (!rowRef.current) return;
        const before = rowRef.current.scrollLeft;
        rowRef.current.scrollLeft = before - velocity * dt;
        velocity = velocity * Math.exp(-dt / 220);
        const hitEdge = rowRef.current.scrollLeft === before;
        if (Math.abs(velocity) < 0.05 || hitEdge) {
          snapToNearest();
          return;
        }
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    } else {
      snapToNearest();
    }
    if (suppressClick.current) {
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 80);
    }
  };

  useEffect(() => {
    return () => {
      stopMomentum();
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Media already present in the current feed slice.
  const feedMedia = new Map<string, CreatorMedia[]>();
  for (const note of notes) {
    const media = toCreatorMedia(note);
    if (!media) continue;
    const list = feedMedia.get(note.author.pubkey) ?? [];
    if (list.length >= 6) continue;
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
    void queryEvents({ kinds: [1, 20, 21, 22], authors: pubkeys, limit: 150 }, { timeout: 6000 })
      .then((events) => {
        if (cancelled) return;
        const map = new Map<string, CreatorMedia[]>();
        for (const event of [...events].sort((a, b) => b.created_at - a.created_at)) {
          if (noteIsReply(event)) continue;
          const media = toCreatorMedia(noteFromEvent(event));
          if (!media) continue;
          const list = map.get(event.pubkey) ?? [];
          if (list.length >= 6) continue;
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

  // Probe undeclared image aspects so only truly vertical media is kept.
  useEffect(() => {
    for (const profile of profiles) {
      for (const item of mediaOf(profile.pubkey)) {
        const url = item.image ?? item.poster;
        if (item.vertical !== undefined || !url || probed.has(url)) continue;
        probeVertical(url, (result) => setProbed((prev) => new Map(prev).set(url, result)));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorKey, fetchedMedia, probed]);

  if (profiles.length === 0) return null;

  const isVertical = (item: CreatorMedia) =>
    item.vertical ?? probed.get(item.image ?? item.poster ?? "") ?? false;

  // Merge: feed-slice media first, then the dedicated fetch, deduped by id.
  const mediaOf = (pubkey: string): CreatorMedia[] => {
    const merged: CreatorMedia[] = [];
    const seen = new Set<string>();
    for (const source of [feedMedia.get(pubkey) ?? [], fetchedMedia.get(pubkey) ?? []]) {
      for (const item of source) {
        if (seen.has(item.note.id)) continue;
        seen.add(item.note.id);
        merged.push(item);
        if (merged.length >= 6) return merged;
      }
    }
    return merged;
  };

  // Only creators whose latest media is vertical make the story carousel.
  // Each of their vertical posts becomes its own story card, so the whole
  // carousel is one continuous run of featured creators' posts.
  const stories = profiles
    .map((profile) => ({ profile, media: mediaOf(profile.pubkey) }))
    .map((entry) => ({ ...entry, media: entry.media.filter((item) => isVertical(item)) }))
    .filter((entry) => entry.media.length > 0)
    .flatMap(({ profile, media }) => media.map((item) => ({ profile, item, highlighted: false })));
  if (stories.length > 0) stories[0].highlighted = true;

  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[14px] font-semibold tracking-tight text-zinc-900">
          Featured creators
        </h2>
        <span className="text-[11px] font-medium text-zinc-400">Stories</span>
      </div>
      <div
        ref={rowRef}
        onPointerDown={onPointerDown}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className={`-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 select-none active:cursor-grabbing sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          dragging ? "cursor-grab" : "snap-x cursor-grab"
        }`}
      >
        {stories.map(({ profile, item, highlighted }) => (
          <StoryCard
            key={item.note.id}
            profile={profile}
            media={item}
            highlighted={highlighted}
            onOpen={setOpenPost}
          />
        ))}
      </div>

      {/* The tapped story, opened as a full post. */}
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

/** One story card: a single post by one featured creator. */
function StoryCard({
  profile,
  media,
  highlighted,
  onOpen,
}: {
  profile: Profile;
  media: CreatorMedia;
  highlighted: boolean;
  onOpen: (note: FeedNote) => void;
}) {
  const name = profile.displayName || profile.name || profile.handle;

  return (
    <div className="w-44 shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated sm:w-52">
      <Link
        to="/profile"
        search={{ pubkey: profile.pubkey }}
        className="flex items-center gap-2.5 px-3 py-2.5"
      >
        {profile.picture ? (
          <img
            src={profile.picture}
            alt=""
            className={`size-8 shrink-0 rounded-full object-cover ${
              highlighted ? "ring-2 ring-brand ring-offset-2" : ""
            }`}
          />
        ) : (
          <AvatarTile seed={name} size={32} />
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-zinc-900">
          {name}
        </span>
      </Link>

      <div className="relative aspect-[4/5] w-full bg-zinc-900">
        <button
          onClick={() => onOpen(media.note)}
          className="absolute inset-0 block size-full"
          aria-label="Open post"
        >
          {media.video ? (
            <>
              {media.poster ? (
                <img
                  src={media.poster}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="absolute inset-0 size-full object-contain object-center"
                />
              ) : (
                <video
                  src={media.video}
                  muted
                  preload="metadata"
                  className="absolute inset-0 size-full object-contain object-center"
                />
              )}
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-zinc-900/60 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white backdrop-blur">
                <Play className="size-2.5 fill-white" /> Video
              </span>
            </>
          ) : media.image ? (
            <img
              src={media.image}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute inset-0 size-full object-contain object-center transition-transform duration-300 hover:scale-[1.03]"
            />
          ) : null}
        </button>
      </div>
    </div>
  );
}
