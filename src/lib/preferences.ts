import { useSyncExternalStore } from "react";

export type NotificationPreferences = {
  zaps: boolean;
  replies: boolean;
  reactions: boolean;
  reposts: boolean;
};

export type PrivacyPreferences = {
  showSensitive: boolean;
  hideSpam: boolean;
};

export type Preferences = {
  notifications: NotificationPreferences;
  privacy: PrivacyPreferences;
};

const STORAGE_KEY = "crays.preferences.v1";

const DEFAULTS: Preferences = {
  notifications: { zaps: true, replies: true, reactions: true, reposts: true },
  privacy: { showSensitive: false, hideSpam: true },
};

let cache: Preferences | null = null;
const listeners = new Set<() => void>();

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function merge(base: Preferences, patch: Partial<Preferences>): Preferences {
  return {
    notifications: { ...base.notifications, ...patch.notifications },
    privacy: { ...base.privacy, ...patch.privacy },
  };
}

function load(): Preferences {
  if (!canUseStorage()) return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    return merge(DEFAULTS, parsed as Partial<Preferences>);
  } catch {
    return DEFAULTS;
  }
}

export function getPreferences(): Preferences {
  if (!cache) cache = load();
  return cache;
}

export function setPreferences(patch: Partial<Preferences>) {
  const next = merge(getPreferences(), patch);
  cache = next;
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getServerSnapshot = () => DEFAULTS;

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getPreferences, getServerSnapshot);
}
