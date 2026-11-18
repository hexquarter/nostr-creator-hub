import { useSyncExternalStore } from "react";
import type { EventTemplate, NostrEvent } from "nostr-tools";
import { queryEvents } from "./relays";
import type { FeedNote } from "./social";

/**
 * Creator badges are the only way into members-only content.
 *
 * A creator joins the program by publishing a members-only post, which sets
 * the badge price. Readers buy that creator's badge with Lightning and the
 * badge unlocks every members-only post from that creator for 30 days.
 *
 * Purchases are kept on this device and also announced as a signed kind-30078
 * event, so a creator can count members and a reader can restore a badge on
 * another device. Payments go straight to the creator's Lightning address, so
 * Crays never holds the sats.
 */
export type CreatorBadge = {
  creator: string;
  /** Price paid for the badge, in sats. */
  sats: number;
  purchasedAt: number;
  expiresAt: number;
};

export const BADGE_DAYS = 30;
export const DEFAULT_BADGE_SATS = 5000;
/** Addressable app-data event that records a badge purchase. */
export const BADGE_ANNOUNCE_KIND = 30078;
const BADGE_ANNOUNCE_TAG = "crays-badge";

const STORAGE_KEY = "crays.badges.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

let cache: CreatorBadge[] | null = null;
const listeners = new Set<() => void>();

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
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

function load(): CreatorBadge[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isBadge) : [];
  } catch {
    return [];
  }
}

function persist(badges: CreatorBadge[]) {
  cache = badges;
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(badges));
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
  if (!cache) cache = load();
  return cache;
}

export function getCreatorBadge(creator: string): CreatorBadge | null {
  return getBadges().find((badge) => badge.creator === creator) ?? null;
}

export function hasCreatorBadge(creator: string | undefined): boolean {
  if (!creator) return false;
  return isBadgeActive(getCreatorBadge(creator));
}

export function grantCreatorBadge(creator: string, sats: number, days = BADGE_DAYS): CreatorBadge {
  const now = Date.now();
  const existing = getCreatorBadge(creator);
  // Renewing extends the current badge instead of losing the remaining days.
  const start = existing && isBadgeActive(existing) ? existing.expiresAt : now;
  const badge: CreatorBadge = {
    creator,
    sats,
    purchasedAt: now,
    expiresAt: start + days * DAY_MS,
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
  signAndPublish: (template: EventTemplate) => Promise<NostrEvent>;
}): Promise<void> {
  await input.signAndPublish({
    kind: BADGE_ANNOUNCE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["d", badgeAnnouncementDTag(input.creator)],
      ["p", input.creator],
      ["t", BADGE_ANNOUNCE_TAG],
      ["amount", String(input.sats)],
      ["expires", String(Math.floor(input.expiresAt / 1000))],
    ],
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

/**
 * Restore badges from the signed announcements this account published, so a
 * membership survives clearing storage or switching devices.
 */
export async function syncCreatorBadges(pubkey: string): Promise<void> {
  if (typeof window === "undefined") return;
  const events = await queryEvents(
    {
      kinds: [BADGE_ANNOUNCE_KIND],
      authors: [pubkey],
      "#t": [BADGE_ANNOUNCE_TAG],
      limit: 200,
    },
    { timeout: 5000, fresh: true },
  );
  const next = [...getBadges()];
  let changed = false;
  for (const event of events) {
    const d = tagValue(event, "d") ?? "";
    if (!d.startsWith("crays:badge:")) continue;
    const creator = d.slice("crays:badge:".length);
    const expiresAt = Number(tagValue(event, "expires")) * 1000;
    if (!creator || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) continue;
    const sats = Number(tagValue(event, "amount")) || 0;
    const index = next.findIndex((badge) => badge.creator === creator);
    const existing = index >= 0 ? next[index] : null;
    if (existing && existing.expiresAt >= expiresAt) continue;
    const badge: CreatorBadge = {
      creator,
      sats,
      purchasedAt: existing?.purchasedAt ?? event.created_at * 1000,
      expiresAt,
    };
    if (index >= 0) next[index] = badge;
    else next.push(badge);
    changed = true;
  }
  if (changed) persist(next);
}

/** The badge price is set by the creator's latest members-only post. */
export function badgePriceFromNotes(notes: FeedNote[]): number | null {
  const premium = notes.filter((note) => note.premium).sort((a, b) => b.createdAt - a.createdAt)[0];
  return premium?.premiumSats ?? (premium ? DEFAULT_BADGE_SATS : null);
}

export function daysLeft(badge: CreatorBadge): number {
  return Math.max(0, Math.ceil((badge.expiresAt - Date.now()) / DAY_MS));
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
