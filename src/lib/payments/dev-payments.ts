import { useSyncExternalStore } from "react";
import { activateCreatorPass, deactivateCreatorPass } from "@/lib/nostr/creator-pass";

/**
 * Developer-only payment controls.
 *
 * Enabled in `vite dev`, or explicitly in a build with
 * `VITE_CRAYS_DEV_PAYMENTS=true` (useful for a staging deploy). Never enable
 * this for a production build you don't control.
 */
export const DEV_PAYMENTS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_CRAYS_DEV_PAYMENTS === "true";

export type DevPaymentSettings = {
  /** Hide Lightning checkout / invoices and force the card or dev flow. */
  disableLightning: boolean;
};

const STORAGE_KEY = "crays.dev-payments.v1";
const DEFAULTS: DevPaymentSettings = { disableLightning: false };

let cache: DevPaymentSettings | null = null;
const listeners = new Set<() => void>();

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function load(): DevPaymentSettings {
  if (!DEV_PAYMENTS_ENABLED || !canUseStorage()) return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DevPaymentSettings>;
    return { disableLightning: parsed.disableLightning === true };
  } catch {
    return DEFAULTS;
  }
}

export function getDevPaymentSettings(): DevPaymentSettings {
  if (!cache) cache = load();
  return cache;
}

export function setDevPaymentSettings(patch: Partial<DevPaymentSettings>) {
  if (!DEV_PAYMENTS_ENABLED) return;
  const next = { ...getDevPaymentSettings(), ...patch };
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

export function lightningPaymentsDisabled(): boolean {
  return DEV_PAYMENTS_ENABLED && getDevPaymentSettings().disableLightning;
}

const getServerSnapshot = () => DEFAULTS;

export function useDevPaymentSettings(): DevPaymentSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getDevPaymentSettings,
    getServerSnapshot,
  );
}

/** Grant the Crays creator badge locally without a payment (dev only). */
export function simulatePremiumAccess() {
  if (!DEV_PAYMENTS_ENABLED) throw new Error("Dev payments are not enabled.");
  return activateCreatorPass(0);
}

/** Remove the locally simulated creator badge (dev only). */
export function clearSimulatedPremiumAccess() {
  if (!DEV_PAYMENTS_ENABLED) throw new Error("Dev payments are not enabled.");
  deactivateCreatorPass();
}
