import { pubkeyToNpub, type Profile } from "./profiles";

/**
 * npub.cash gives every Nostr public key a working Lightning address, so a
 * signed-in account can receive sats without creating a separate wallet.
 * Payments are held as Cashu ecash until the owner claims them with their
 * Nostr key at https://npub.cash.
 */
export const HOSTED_ADDRESS_DOMAIN = "npub.cash";

export type LightningAddressSource = "profile" | "hosted";

export function hostedLightningAddress(pubkey: string): string {
  return `${pubkeyToNpub(pubkey)}@${HOSTED_ADDRESS_DOMAIN}`;
}

export function hasProfileLightningAddress(profile?: Profile | null): boolean {
  return Boolean(profile?.lud16?.trim() || profile?.lud06?.trim());
}

/** The address a creator can receive at: their profile address, else npub.cash. */
export function lightningAddressFor(pubkey: string, profile?: Profile | null): string {
  return profile?.lud16?.trim() || profile?.lud06?.trim() || hostedLightningAddress(pubkey);
}

export function lightningAddressSource(profile?: Profile | null): LightningAddressSource {
  return hasProfileLightningAddress(profile) ? "profile" : "hosted";
}
