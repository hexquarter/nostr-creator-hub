import { useSyncExternalStore } from "react";
import type { EventTemplate, NostrEvent } from "nostr-tools";
import { queryEvents } from "./relays";
import type { FeedNote } from "./social";

/**
 * Memberships are the only way into members-only content, and readers have two
 * ways to buy in:
 *
 *   - a membership (the creator's "badge"): one payment unlocks every
 *     members-only post from that creator for 30 days, like a monthly
 *     subscription that has to be renewed by hand.
 *   - a single-post unlock: pay once for one members-only post, keep it
 *     forever.
 *
 * A creator joins the program by publishing a members-only post, which sets
 * the monthly price (and, per post, the single-post price).
 *
 * Purchases are kept on this device and also announced as signed kind-30078
 * events, so a creator can count members and a reader can restore what they
 * bought on another device. The BOLT-11 invoice that settled the purchase
 * rides along in the `pr` tag, which doubles as payment proof when the reader
 * asks the creator for an exclusive post's decryption key. Payments go
 * straight to the creator's Lightning address, so Crays never holds the sats.
 */
export type CreatorBadge = {
  creator: string;
  /** Price paid for the badge, in sats. */
  sats: number;
  purchasedAt: number;
  expiresAt: number;
  /** Settled BOLT-11 invoice, when the payment flow captured one. */
  invoice?: string;
};

export const BADGE_DAYS = 30;
export const DEFAULT_BADGE_SATS = 5000;
/** Addressable app-data event that records a badge purchase. */
export const BADGE_ANNOUNCE_KIND = 30078;
const BADGE_ANNOUNCE_TAG = "crays-badge";

const STORAGE_PREFIX = "crays.badges.v2";
const LEGACY_STORAGE_KEY = "crays.badges.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Purchases belong to the signed-in account, not the device. */
let owner: string | null = null;
let cache: CreatorBadge[] | null = null;
const listeners = new Set<() => void>();

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function storageKey(pubkey: string) {
  return `${STORAGE_PREFIX}.${pubkey}`;
}

function isBadge(value: unknown): value is CreatorBadge {
  if (!value || typeof value !== "object") return false;
  const badge = value as Partial<CreatorBadge>;
  return (
    typeof badge.creator === "string" &&
    typeof badge.sats === "number" &&
    typeof badge.purchasedAt === "number" &&
    typeof badge.expiresAt === "number"
  );
}

function parseBadges(raw: string | null): CreatorBadge[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isBadge) : [];
  } catch {
    return [];
  }
}

function load(pubkey: string): CreatorBadge[] {
  if (!canUseStorage()) return [];
  try {
    const scoped = window.localStorage.getItem(storageKey(pubkey));
    if (scoped) return parseBadges(scoped);
    // Move purchases saved before they were scoped to an account.
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return [];
    const badges = parseBadges(legacy);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    if (badges.length) window.localStorage.setItem(storageKey(pubkey), JSON.stringify(badges));
    return badges;
  } catch {
    return [];
  }
}

/**
 * Point the store at the signed-in account's purchases. Memberships and
 * single-post unlocks are per-account, so switching accounts must not leak
 * them across.
 */
export function setPurchaseOwner(pubkey: string | null) {
  if (owner === pubkey) return;
  owner = pubkey;
  cache = pubkey ? load(pubkey) : null;
  unlockCache = pubkey ? loadUnlocks(pubkey) : null;
  listeners.forEach((listener) => listener());
  unlockListeners.forEach((listener) => listener());
}

function persist(badges: CreatorBadge[]) {
  cache = badges;
  if (owner && canUseStorage()) {
    try {
      window.localStorage.setItem(storageKey(owner), JSON.stringify(badges));
    } catch {
      // ignore quota errors
    }
  }
  listeners.forEach((listener) => listener());
}

export function isBadgeActive(badge: CreatorBadge | null | undefined) {
  return Boolean(badge && badge.expiresAt > Date.now());
}

export function getBadges(): CreatorBadge[] {
  if (!cache) cache = owner ? load(owner) : [];
  return cache;
}

export function getCreatorBadge(creator: string): CreatorBadge | null {
  return getBadges().find((badge) => badge.creator === creator) ?? null;
}

export function hasCreatorBadge(creator: string | undefined): boolean {
  if (!creator) return false;
  return isBadgeActive(getCreatorBadge(creator));
}

export function grantCreatorBadge(
  creator: string,
  sats: number,
  days = BADGE_DAYS,
  invoice?: string,
): CreatorBadge {
  const now = Date.now();
  const existing = getCreatorBadge(creator);
  // Renewing extends the current badge instead of losing the remaining days.
  const start = existing && isBadgeActive(existing) ? existing.expiresAt : now;
  const badge: CreatorBadge = {
    creator,
    sats,
    purchasedAt: now,
    expiresAt: start + days * DAY_MS,
    invoice: invoice ?? existing?.invoice,
  };
  persist([...getBadges().filter((item) => item.creator !== creator), badge]);
  return badge;
}

export function revokeCreatorBadge(creator: string) {
  persist(getBadges().filter((badge) => badge.creator !== creator));
}

export function badgeAnnouncementDTag(creator: string) {
  return `crays:badge:${creator}`;
}

function tagValue(event: NostrEvent, name: string) {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}

/**
 * Publish the signed proof of a badge purchase. Best-effort: the badge is
 * already active on this device, so a relay hiccup must not lose it.
 */
export async function announceCreatorBadge(input: {
  creator: string;
  sats: number;
  expiresAt: number;
  invoice?: string;
  signAndPublish: (template: EventTemplate) => Promise<NostrEvent>;
}): Promise<void> {
  const tags: string[][] = [
    ["d", badgeAnnouncementDTag(input.creator)],
    ["p", input.creator],
    ["t", BADGE_ANNOUNCE_TAG],
    ["amount", String(input.sats)],
    ["expires", String(Math.floor(input.expiresAt / 1000))],
  ];
  // The settled invoice lets the creator's key server verify the payment
  // before handing over exclusive content keys.
  if (input.invoice) tags.push(["pr", input.invoice]);
  await input.signAndPublish({
    kind: BADGE_ANNOUNCE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "",
  });
}

/** How many readers currently hold a creator's badge. */
export async function fetchCreatorMembers(creator: string, timeout = 5000): Promise<number> {
  if (typeof window === "undefined") return 0;
  const events = await queryEvents(
    { kinds: [BADGE_ANNOUNCE_KIND], "#d": [badgeAnnouncementDTag(creator)], limit: 500 },
    { timeout, fresh: true },
  );
  const now = Math.floor(Date.now() / 1000);
  const holders = new Set<string>();
  for (const event of events) {
    const expires = Number(tagValue(event, "expires"));
    if (!Number.isFinite(expires) || expires <= now) continue;
    holders.add(event.pubkey);
  }
  return holders.size;
}

/** The badge price is set by the creator's latest members-only post. */
export function badgePriceFromNotes(notes: FeedNote[]): number | null {
  const premium = notes.filter((note) => note.premium).sort((a, b) => b.createdAt - a.createdAt)[0];
  return premium?.premiumSats ?? (premium ? DEFAULT_BADGE_SATS : null);
}

export function daysLeft(badge: CreatorBadge): number {
  return Math.max(0, Math.ceil((badge.expiresAt - Date.now()) / DAY_MS));
}

// ---------- Single-post unlocks ----------

export type PostUnlock = {
  postId: string;
  creator: string;
  sats: number;
  purchasedAt: number;
  /** Settled BOLT-11 invoice, when the payment flow captured one. */
  invoice?: string;
};

/** One-off purchases never expire: the post stays readable. */
export const POST_UNLOCK_ANNOUNCE_TAG = "crays-unlock";
const UNLOCK_STORAGE_PREFIX = "crays.post-unlocks.v2";
const LEGACY_UNLOCK_STORAGE_KEY = "crays.post-unlocks.v1";

let unlockCache: PostUnlock[] | null = null;
const unlockListeners = new Set<() => void>();

function isPostUnlock(value: unknown): value is PostUnlock {
  if (!value || typeof value !== "object") return false;
  const unlock = value as Partial<PostUnlock>;
  return (
    typeof unlock.postId === "string" &&
    typeof unlock.creator === "string" &&
    typeof unlock.sats === "number" &&
    typeof unlock.purchasedAt === "number"
  );
}

function parseUnlocks(raw: string | null): PostUnlock[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPostUnlock) : [];
  } catch {
    return [];
  }
}

function unlockStorageKey(pubkey: string) {
  return `${UNLOCK_STORAGE_PREFIX}.${pubkey}`;
}

function loadUnlocks(pubkey: string): PostUnlock[] {
  if (!canUseStorage()) return [];
  try {
    const scoped = window.localStorage.getItem(unlockStorageKey(pubkey));
    if (scoped) return parseUnlocks(scoped);
    const legacy = window.localStorage.getItem(LEGACY_UNLOCK_STORAGE_KEY);
    if (!legacy) return [];
    const unlocks = parseUnlocks(legacy);
    window.localStorage.removeItem(LEGACY_UNLOCK_STORAGE_KEY);
    if (unlocks.length) {
      window.localStorage.setItem(unlockStorageKey(pubkey), JSON.stringify(unlocks));
    }
    return unlocks;
  } catch {
    return [];
  }
}

function persistUnlocks(unlocks: PostUnlock[]) {
  unlockCache = unlocks;
  if (owner && canUseStorage()) {
    try {
      window.localStorage.setItem(unlockStorageKey(owner), JSON.stringify(unlocks));
    } catch {
      // ignore quota errors
    }
  }
  unlockListeners.forEach((listener) => listener());
}

export function getPostUnlocks(): PostUnlock[] {
  if (!unlockCache) unlockCache = owner ? loadUnlocks(owner) : [];
  return unlockCache;
}

export function hasUnlockedPost(postId: string | undefined): boolean {
  if (!postId) return false;
  return getPostUnlocks().some((unlock) => unlock.postId === postId);
}

export function grantPostUnlock(input: {
  postId: string;
  creator: string;
  sats: number;
  invoice?: string;
}): PostUnlock {
  const unlock: PostUnlock = {
    postId: input.postId,
    creator: input.creator,
    sats: input.sats,
    purchasedAt: Date.now(),
    invoice: input.invoice,
  };
  persistUnlocks([...getPostUnlocks().filter((item) => item.postId !== input.postId), unlock]);
  return unlock;
}

export function postUnlockAnnouncementDTag(postId: string) {
  return `crays:unlock:${postId}`;
}

/** Signed proof of a single-post purchase, so it can be restored elsewhere. */
export async function announcePostUnlock(input: {
  postId: string;
  creator: string;
  sats: number;
  invoice?: string;
  signAndPublish: (template: EventTemplate) => Promise<NostrEvent>;
}): Promise<void> {
  const tags: string[][] = [
    ["d", postUnlockAnnouncementDTag(input.postId)],
    ["p", input.creator],
    ["t", POST_UNLOCK_ANNOUNCE_TAG],
    ["e", input.postId],
    ["amount", String(input.sats)],
  ];
  if (input.invoice) tags.push(["pr", input.invoice]);
  await input.signAndPublish({
    kind: BADGE_ANNOUNCE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: "",
  });
}

/**
 * Restore memberships and single-post unlocks from the announcements this
 * account published, so purchases survive clearing storage or a new device.
 */
export async function syncCreatorPurchases(pubkey: string): Promise<void> {
  if (typeof window === "undefined") return;
  setPurchaseOwner(pubkey);
  const events = await queryEvents(
    {
      kinds: [BADGE_ANNOUNCE_KIND],
      authors: [pubkey],
      "#t": [BADGE_ANNOUNCE_TAG, POST_UNLOCK_ANNOUNCE_TAG],
      limit: 500,
    },
    { timeout: 5000, fresh: true },
  );

  const nextBadges = [...getBadges()];
  const nextUnlocks = [...getPostUnlocks()];
  let badgesChanged = false;
  let unlocksChanged = false;

  for (const event of events) {
    const d = tagValue(event, "d") ?? "";

    if (d.startsWith("crays:unlock:")) {
      const postId = d.slice("crays:unlock:".length);
      const creator = tagValue(event, "p") ?? "";
      if (!postId || !creator) continue;
      const invoice = tagValue(event, "pr") || undefined;
      const index = nextUnlocks.findIndex((unlock) => unlock.postId === postId);
      if (index >= 0) {
        // Backfill the payment proof on a record restored before invoices
        // were recorded, so a later key request can prove the payment.
        if (invoice && !nextUnlocks[index].invoice) {
          nextUnlocks[index] = { ...nextUnlocks[index], invoice };
          unlocksChanged = true;
        }
        continue;
      }
      nextUnlocks.push({
        postId,
        creator,
        sats: Number(tagValue(event, "amount")) || 0,
        purchasedAt: event.created_at * 1000,
        invoice,
      });
      unlocksChanged = true;
      continue;
    }

    if (!d.startsWith("crays:badge:")) continue;
    const creator = d.slice("crays:badge:".length);
    const expiresAt = Number(tagValue(event, "expires")) * 1000;
    if (!creator || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) continue;
    const sats = Number(tagValue(event, "amount")) || 0;
    const index = nextBadges.findIndex((badge) => badge.creator === creator);
    const existing = index >= 0 ? nextBadges[index] : null;
    if (existing && existing.expiresAt >= expiresAt) continue;
    const badge: CreatorBadge = {
      creator,
      sats,
      purchasedAt: existing?.purchasedAt ?? event.created_at * 1000,
      expiresAt,
      invoice: tagValue(event, "pr") || existing?.invoice,
    };
    if (index >= 0) nextBadges[index] = badge;
    else nextBadges.push(badge);
    badgesChanged = true;
  }

  if (badgesChanged) persist(nextBadges);
  if (unlocksChanged) persistUnlocks(nextUnlocks);
}

// Must be a stable reference: a fresh [] on every render trips React's
// "getServerSnapshot should be cached" warning.
const EMPTY_BADGES: CreatorBadge[] = [];
const getServerSnapshot = (): CreatorBadge[] => EMPTY_BADGES;

export function useCreatorBadges(): CreatorBadge[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getBadges,
    getServerSnapshot,
  );
}

const EMPTY_UNLOCKS: PostUnlock[] = [];
const getUnlockServerSnapshot = (): PostUnlock[] => EMPTY_UNLOCKS;

export function usePostUnlocks(): PostUnlock[] {
  return useSyncExternalStore(
    (listener) => {
      unlockListeners.add(listener);
      return () => unlockListeners.delete(listener);
    },
    getPostUnlocks,
    getUnlockServerSnapshot,
  );
}
