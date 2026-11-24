import { type Profile } from "./profiles";

/**
 * Crays is fully self-custodial: there is no hosted Lightning address. A
 * creator receives at whatever Lightning address they set on their own
 * profile (lud16/lud06), or creates self-custodial invoices through their
 * Crays wallet instead.
 */

export function hasProfileLightningAddress(profile?: Profile | null): boolean {
  return Boolean(profile?.lud16?.trim() || profile?.lud06?.trim());
}

/** The profile's own Lightning address, or "" when none is set. */
export function lightningAddressFor(_pubkey: string, profile?: Profile | null): string {
  return profile?.lud16?.trim() || profile?.lud06?.trim() || "";
}
