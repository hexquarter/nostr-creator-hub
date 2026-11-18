import { useSyncExternalStore } from "react";
import type { FeedNote } from "./social";

/**
 * Creator badges are the only way into members-only content.
 *
 * A creator joins the program by publishing a members-only post, which sets
 * the badge price. Readers buy that creator's badge with Lightning and the
 * badge unlocks every members-only post from that creator for 30 days.
 *
 * Purchases are kept on this device. Payments go straight to the creator's
 * Lightning address, so Crays never holds the sats.
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

/** The badge price is set by the creator's latest members-only post. */
export function badgePriceFromNotes(notes: FeedNote[]): number | null {
  const premium = notes.filter((note) => note.premium).sort((a, b) => b.createdAt - a.createdAt)[0];
  return premium?.premiumSats ?? (premium ? DEFAULT_BADGE_SATS : null);
}

export function daysLeft(badge: CreatorBadge): number {
  return Math.max(0, Math.ceil((badge.expiresAt - Date.now()) / DAY_MS));
}

const getServerSnapshot = (): CreatorBadge[] => [];

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
