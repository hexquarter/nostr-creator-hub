import {
  finalizeEvent,
  getEventHash,
  type EventTemplate,
  type Filter,
  type NostrEvent,
} from "nostr-tools";
import { getSatoshisAmountFromBolt11 } from "nostr-tools/nip57";
import { queryEvents, queryEventsMany, publishEvent, getRelayList } from "./relays";
import { emptyProfile, fetchProfiles, type Profile } from "./profiles";
import type { AppSigner } from "./signer";

export type NoteCounts = {
  replies: number;
  reposts: number;
  reactions: number;
  zaps: number;
  zapSats: number;
};

export type FeedNote = {
  event: NostrEvent;
  id: string;
  author: Profile;
  content: string;
  createdAt: number;
  images: string[];
  contentWarning?: string;
  isReply: boolean;
  counts: NoteCounts;
  referencedEventId?: string;
};

const EMPTY_COUNTS: NoteCounts = { replies: 0, reposts: 0, reactions: 0, zaps: 0, zapSats: 0 };

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const BASE64_BLOB = /^[A-Za-z0-9+/]{80,}={0,2}$/;
const HEX_BLOB = /^[0-9a-f]{80,}$/i;

/** Drop obvious relay spam: long single-token base64/hex blobs and JSON payloads. */
function looksLikeSpam(content: string) {
  const value = content.trim();
  if (!value) return false;
  if (value.startsWith("{") && value.endsWith("}")) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object") return true;
    } catch {
      // Not JSON — keep it.
    }
  }
  if (value.length < 80 || value.includes("://") || /\s/.test(value)) return false;
  return BASE64_BLOB.test(value) || HEX_BLOB.test(value);
}

function tagValues(event: NostrEvent, name: string) {
  return event.tags
    .filter((t) => t[0] === name)
    .map((t) => t[1])
    .filter(Boolean);
}

export function firstTag(event: NostrEvent, name: string) {
  return event.tags.find((t) => t[0] === name)?.[1];
}

export function parseImages(event: NostrEvent): string[] {
  const urls: string[] = [];
  for (const tag of event.tags) {
    if (tag[0] === "imeta") {
      for (const part of tag.slice(1)) {
        if (part.startsWith("url ")) urls.push(part.slice(4).trim());
      }
    }
    if (tag[0] === "r" && tag[1]) urls.push(tag[1]);
  }
  for (const match of event.content.match(URL_RE) ?? []) {
    urls.push(match.replace(/[),.!?]+$/, ""));
  }
  const unique = Array.from(new Set(urls)).filter((url) => /^https?:\/\//i.test(url));
  const images = unique.filter((url) => IMAGE_EXT.test(url));
  return images.slice(0, 4);
}

export function noteIsReply(event: NostrEvent) {
  return event.tags.some((t) => t[0] === "e");
}

export function noteFromEvent(event: NostrEvent, author?: Profile): FeedNote {
  const warning = firstTag(event, "content-warning");
  return {
    event,
    id: event.id,
    author: author ?? emptyProfile(event.pubkey),
    content: event.content,
    createdAt: event.created_at,
    images: parseImages(event),
    contentWarning: warning || undefined,
    isReply: noteIsReply(event),
    counts: { ...EMPTY_COUNTS },
    referencedEventId: firstTag(event, "e"),
  };
}

async function enrichCounts(ids: string[]): Promise<Map<string, NoteCounts>> {
  const counts = new Map<string, NoteCounts>();
  ids.forEach((id) => counts.set(id, { ...EMPTY_COUNTS }));
  if (ids.length === 0) return counts;

  const [replies, reactions, reposts, zaps] = await Promise.all([
    queryEvents({ kinds: [1], "#e": ids, limit: 500 }, { timeout: 3500 }),
    queryEvents({ kinds: [7], "#e": ids, limit: 600 }, { timeout: 3500 }),
    queryEvents({ kinds: [6], "#e": ids, limit: 300 }, { timeout: 3500 }),
    queryEvents({ kinds: [9735], "#e": ids, limit: 500 }, { timeout: 3500 }),
  ]);

  for (const reply of replies) {
    ids.forEach((id) => {
      if (reply.tags.some((t) => t[0] === "e" && t[1] === id)) {
        counts.get(id)!.replies += 1;
      }
    });
  }
  const reacted = new Set<string>();
  for (const reaction of reactions) {
    for (const id of ids) {
      if (reaction.tags.some((t) => t[0] === "e" && t[1] === id)) {
        const key = `${id}:${reaction.pubkey}`;
        if (!reacted.has(key)) {
          reacted.add(key);
          counts.get(id)!.reactions += 1;
        }
      }
    }
  }
  for (const repost of reposts) {
    for (const id of ids) {
      if (repost.tags.some((t) => t[0] === "e" && t[1] === id)) {
        counts.get(id)!.reposts += 1;
      }
    }
  }
  for (const zap of zaps) {
    const bolt11 = firstTag(zap, "bolt11");
    for (const id of ids) {
      if (zap.tags.some((t) => t[0] === "e" && t[1] === id)) {
        counts.get(id)!.zaps += 1;
        if (bolt11) counts.get(id)!.zapSats += getSatoshisAmountFromBolt11(bolt11);
      }
    }
  }
  return counts;
}

export type FeedOptions = {
  authors?: string[];
  limit?: number;
  search?: string;
  tag?: string;
  ids?: string[];
  includeReplies?: boolean;
  timeout?: number;
};

/** Fetch notes, their authors, and engagement counts in one pass. */
export async function fetchFeed(options: FeedOptions = {}): Promise<FeedNote[]> {
  const limit = options.limit ?? 30;
  const filter: Filter = { kinds: [1], limit: Math.min(limit * 2, 200) };
  if (options.authors?.length) filter.authors = options.authors;
  if (options.ids?.length) filter.ids = options.ids;
  if (options.search) filter.search = options.search;
  if (options.tag) filter["#t"] = [options.tag];

  const events = (await queryEvents(filter, { timeout: options.timeout ?? 5000 }))
    .filter(
      (event) => (options.includeReplies || !noteIsReply(event)) && !looksLikeSpam(event.content),
    )
    .slice(0, limit);
  if (events.length === 0) return [];

  const ids = events.map((e) => e.id);
  const [profiles, counts] = await Promise.all([
    fetchProfiles(
      events.map((e) => e.pubkey),
      getRelayList(),
    ),
    enrichCounts(ids),
  ]);

  return events.map((event) => {
    const note = noteFromEvent(event, profiles.get(event.pubkey));
    note.counts = counts.get(event.id) ?? note.counts;
    return note;
  });
}

export async function fetchNoteById(id: string): Promise<FeedNote | null> {
  const notes = await fetchFeed({ ids: [id], limit: 1, includeReplies: true, timeout: 4000 });
  return notes[0] ?? null;
}

export type PublishNoteInput = {
  content: string;
  replyTo?: NostrEvent;
  rootId?: string;
  images?: string[];
  contentWarning?: string;
  tags?: string[][];
  createdAt?: number;
  kind?: number;
};

export async function publishNote(signer: AppSigner, input: PublishNoteInput): Promise<NostrEvent> {
  const tags: string[][] = [...(input.tags ?? [])];

  if (input.replyTo) {
    const reply = input.replyTo;
    const root = input.rootId ?? reply.id;
    tags.push(["e", root, "", "root"]);
    if (reply.id !== root) tags.push(["e", reply.id, "", "reply"]);
    tags.push(["p", reply.pubkey]);
    tags.push(["k", String(reply.kind)]);
    for (const mention of tagValues(reply, "p").slice(0, 3)) {
      if (!tags.some((t) => t[0] === "p" && t[1] === mention)) tags.push(["p", mention]);
    }
  }

  if (input.contentWarning) tags.push(["content-warning", input.contentWarning]);
  for (const url of input.images ?? []) {
    tags.push(["imeta", `url ${url}`]);
  }

  const template: EventTemplate = {
    kind: input.kind ?? 1,
    created_at: input.createdAt ?? Math.floor(Date.now() / 1000),
    content: input.content,
    tags,
  };
  const signedEvent = await signer.signEvent(template);
  await publishEvent(signedEvent);
  return signedEvent;
}

export async function publishReaction(
  signer: AppSigner,
  target: NostrEvent,
  content = "+",
): Promise<NostrEvent> {
  const event = await signer.signEvent({
    kind: 7,
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags: [
      ["e", target.id],
      ["p", target.pubkey],
      ["k", String(target.kind)],
    ],
  });
  await publishEvent(event);
  return event;
}

export async function publishRepost(signer: AppSigner, target: NostrEvent): Promise<NostrEvent> {
  const event = await signer.signEvent({
    kind: 6,
    created_at: Math.floor(Date.now() / 1000),
    content: JSON.stringify(target),
    tags: [
      ["e", target.id],
      ["p", target.pubkey],
      ["k", String(target.kind)],
    ],
  });
  await publishEvent(event);
  return event;
}

export type FollowState = { pubkeys: string[]; event: NostrEvent | null };

export async function fetchFollows(pubkey: string): Promise<FollowState> {
  const events = await queryEvents({ kinds: [3], authors: [pubkey], limit: 1 }, { timeout: 4000 });
  const event = events[0] ?? null;
  const pubkeys = event ? tagValues(event, "p") : [];
  return { pubkeys: Array.from(new Set(pubkeys)), event };
}

export async function updateFollows(
  signer: AppSigner,
  current: FollowState,
  pubkey: string,
  follow: boolean,
): Promise<FollowState> {
  const relayTags = current.event
    ? current.event.tags.filter((t) => t[0] !== "p" && t[0] !== "content")
    : getRelayList().map((relay) => ["r", relay]);
  const next = new Set(current.pubkeys);
  if (follow) next.add(pubkey);
  else next.delete(pubkey);

  const event = await signer.signEvent({
    kind: 3,
    created_at: Math.floor(Date.now() / 1000),
    content: current.event?.content ?? "",
    tags: [...relayTags, ...Array.from(next).map((key) => ["p", key])],
  });
  await publishEvent(event);
  return { pubkeys: Array.from(next), event };
}

export async function fetchBookmarkList(pubkey: string): Promise<NostrEvent | null> {
  const [modern] = await queryEvents(
    { kinds: [10003], authors: [pubkey], limit: 1 },
    { timeout: 4000 },
  );
  if (modern) return modern;
  const legacy = await queryEvents(
    { kinds: [30001], authors: [pubkey], "#d": ["bookmarks"], limit: 1 },
    { timeout: 3000 },
  );
  return legacy[0] ?? null;
}

export function bookmarkIds(list: NostrEvent | null): string[] {
  if (!list) return [];
  return Array.from(new Set(tagValues(list, "e")));
}

export async function toggleBookmark(
  signer: AppSigner,
  pubkey: string,
  target: NostrEvent,
): Promise<{ bookmarked: boolean; ids: string[] }> {
  const current = await fetchBookmarkList(pubkey);
  const ids = new Set(bookmarkIds(current));
  const nowBookmarked = !ids.has(target.id);
  if (nowBookmarked) ids.add(target.id);
  else ids.delete(target.id);

  const tags: string[][] = [];
  if (current) {
    for (const tag of current.tags) {
      if (tag[0] === "d" || tag[0] === "title" || tag[0] === "r") tags.push(tag);
    }
  } else {
    tags.push(["d", "bookmarks"]);
  }
  for (const id of ids) tags.push(["e", id]);
  tags.push(["p", target.pubkey]);

  const event = await signer.signEvent({
    kind: 10003,
    created_at: Math.floor(Date.now() / 1000),
    content: current?.content ?? "",
    tags,
  });
  await publishEvent(event);
  return { bookmarked: nowBookmarked, ids: Array.from(ids) };
}

export type NotificationKind = "reply" | "mention" | "reaction" | "zap" | "repost";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  event: NostrEvent;
  actor: Profile;
  targetId?: string;
  amountSats?: number;
  text?: string;
  createdAt: number;
};

export async function fetchNotifications(pubkey: string): Promise<NotificationItem[]> {
  const [replies, reactions, zaps, reposts] = await Promise.all([
    queryEvents({ kinds: [1], "#p": [pubkey], limit: 40 }, { timeout: 5000 }),
    queryEvents({ kinds: [7], "#p": [pubkey], limit: 30 }, { timeout: 4000 }),
    queryEvents({ kinds: [9735], "#p": [pubkey], limit: 30 }, { timeout: 4000 }),
    queryEvents({ kinds: [6], "#p": [pubkey], limit: 20 }, { timeout: 4000 }),
  ]);

  const all = [...replies, ...reactions, ...zaps, ...reposts].filter((e) => e.pubkey !== pubkey);
  if (all.length === 0) return [];

  const profiles = await fetchProfiles(all.map((e) => e.pubkey));
  const items: NotificationItem[] = all.map((event) => {
    const actor = profiles.get(event.pubkey) ?? emptyProfile(event.pubkey);
    let kind: NotificationKind = "reply";
    if (event.kind === 7) kind = "reaction";
    else if (event.kind === 9735) kind = "zap";
    else if (event.kind === 6) kind = "repost";
    else if (event.content.includes(`nostr:${actor.npub}`)) kind = "mention";
    return {
      id: event.id,
      kind,
      event,
      actor,
      targetId: firstTag(event, "e"),
      amountSats:
        event.kind === 9735 && firstTag(event, "bolt11")
          ? getSatoshisAmountFromBolt11(firstTag(event, "bolt11")!)
          : undefined,
      text: event.kind === 1 ? event.content : firstTag(event, "content") || undefined,
      createdAt: event.created_at,
    };
  });

  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function fetchProfileStats(pubkey: string) {
  const [notes, follows, followers] = await Promise.all([
    queryEvents({ kinds: [1], authors: [pubkey], limit: 100 }, { timeout: 4000 }),
    fetchFollows(pubkey),
    queryEvents({ kinds: [3], "#p": [pubkey], limit: 500 }, { timeout: 4500 }),
  ]);
  const followersCount = new Set(followers.map((e) => e.pubkey)).size;
  return {
    posts: notes.length,
    following: follows.pubkeys.length,
    followers: followersCount,
  };
}

export function extractHashtags(notes: FeedNote[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const note of notes) {
    for (const tag of tagValues(note.event, "t")) {
      const key = tag.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}
