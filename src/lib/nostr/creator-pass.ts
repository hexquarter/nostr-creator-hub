import { useSyncExternalStore } from "react";

/**
 * The Crays creator badge is the platform entitlement that lets an account
 * sell memberships: publish members-only posts and run a creator badge.
 *
 * It is separate from the creator badges readers buy, so the rule lives in one
 * place and can be priced later without touching the post form. Crays is in
 * beta, so activating it is free today.
 */
export type CreatorPass = {
  active: boolean;
  activatedAt: number;
  expiresAt: number;
  plan: "beta";
};

export const CREATOR_PASS_DAYS = 365;

const STORAGE_KEY = "crays.creator-pass.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

let cache: CreatorPass | null | undefined;
const listeners = new Set<() => void>();

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function isPass(value: unknown): value is CreatorPass {
  if (!value || typeof value !== "object") return false;
  const pass = value as Partial<CreatorPass>;
  return (
    pass.active === true &&
    typeof pass.activatedAt === "number" &&
    typeof pass.expiresAt === "number"
  );
}

function load(): CreatorPass | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPass(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persist(pass: CreatorPass | null) {
  cache = pass;
  if (canUseStorage()) {
    try {
      if (pass) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pass));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore quota errors
    }
  }
  listeners.forEach((listener) => listener());
}

export function getCreatorPass(): CreatorPass | null {
  if (cache === undefined) cache = load();
  return cache;
}

export function isCreatorPassActive(pass: CreatorPass | null = getCreatorPass()): boolean {
  return Boolean(pass && pass.active && pass.expiresAt > Date.now());
}

export function activateCreatorPass(): CreatorPass {
  const now = Date.now();
  const pass: CreatorPass = {
    active: true,
    activatedAt: now,
    expiresAt: now + CREATOR_PASS_DAYS * DAY_MS,
    plan: "beta",
  };
  persist(pass);
  return pass;
}

export function deactivateCreatorPass() {
  persist(null);
}

export function creatorPassDaysLeft(pass: CreatorPass): number {
  return Math.max(0, Math.ceil((pass.expiresAt - Date.now()) / DAY_MS));
}

const getServerSnapshot = (): CreatorPass | null => null;

export function useCreatorPass(): CreatorPass | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getCreatorPass,
    getServerSnapshot,
  );
}
