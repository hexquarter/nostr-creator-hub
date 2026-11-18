import { nip19, type NostrEvent } from "nostr-tools";
import { queryEvents } from "./relays";

export type Profile = {
  pubkey: string;
  npub: string;
  name: string;
  displayName: string;
  handle: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
  website?: string;
  createdAt?: number;
  event?: NostrEvent;
};

export type ProfileMetadata = {
  name?: string;
  display_name?: string;
  displayName?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud16?: string;
  lud06?: string;
  website?: string;
  [key: string]: unknown;
};

export function shortNpub(pubkey: string) {
  const npub = pubkeyToNpub(pubkey);
  return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

export function pubkeyToNpub(pubkey: string) {
  try {
    return nip19.npubEncode(pubkey);
  } catch {
    return pubkey;
  }
}

export function normalizePubkey(input: string): string | null {
  const value = input.trim().replace(/^nostr:/i, "");
  if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
  if (value.startsWith("npub1")) {
    try {
      const decoded = nip19.decode(value);
      if (decoded.type === "npub") return decoded.data;
    } catch {
      return null;
    }
  }
  if (value.startsWith("nprofile1")) {
    try {
      const decoded = nip19.decode(value);
      if (decoded.type === "nprofile") return decoded.data.pubkey;
    } catch {
      return null;
    }
  }
  return null;
}

export function emptyProfile(pubkey: string): Profile {
  const npub = pubkeyToNpub(pubkey);
  return {
    pubkey,
    npub,
    name: shortNpub(pubkey),
    displayName: shortNpub(pubkey),
    handle: `@${shortNpub(pubkey)}`,
  };
}

export function profileFromEvent(event: NostrEvent): Profile {
  let meta: ProfileMetadata = {};
  try {
    const parsed: unknown = JSON.parse(event.content);
    if (parsed && typeof parsed === "object") meta = parsed as ProfileMetadata;
  } catch {
    // some clients publish invalid metadata; fall back to npub
  }
  const displayName =
    clean(meta.display_name) ||
    clean(meta.displayName) ||
    clean(meta.name) ||
    shortNpub(event.pubkey);
  const nip05 = clean(meta.nip05);
  const handle = nip05 ? `@${nip05.split("@")[0]}` : `@${shortNpub(event.pubkey)}`;
  return {
    pubkey: event.pubkey,
    npub: pubkeyToNpub(event.pubkey),
    name: clean(meta.name) || displayName,
    displayName,
    handle,
    about: clean(meta.about),
    picture: clean(meta.picture),
    banner: clean(meta.banner),
    nip05,
    lud16: clean(meta.lud16),
    lud06: clean(meta.lud06),
    website: clean(meta.website),
    event,
  };
}

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function fetchProfile(pubkey: string, relays?: string[]): Promise<Profile> {
  const events = await queryEvents(
    { kinds: [0], authors: [pubkey], limit: 1 },
    { relays, timeout: 3500 },
  );
  return events[0] ? profileFromEvent(events[0]) : emptyProfile(pubkey);
}

/** Batch fetch kind-0 metadata for many pubkeys. */
export async function fetchProfiles(
  pubkeys: string[],
  relays?: string[],
): Promise<Map<string, Profile>> {
  const unique = Array.from(new Set(pubkeys.filter(Boolean)));
  const map = new Map<string, Profile>();
  if (unique.length === 0) return map;

  // Relays sometimes cap `authors`; chunk to stay friendly.
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 80) chunks.push(unique.slice(i, i + 80));

  const events = (
    await Promise.all(
      chunks.map((authors) =>
        queryEvents({ kinds: [0], authors, limit: authors.length * 2 }, { relays, timeout: 4500 }),
      ),
    )
  ).flat();

  const newest = new Map<string, NostrEvent>();
  for (const event of events) {
    const current = newest.get(event.pubkey);
    if (!current || event.created_at > current.created_at) newest.set(event.pubkey, event);
  }
  for (const pubkey of unique) {
    if (newest.has(pubkey)) map.set(pubkey, profileFromEvent(newest.get(pubkey)!));
  }
  return map;
}

export function profileMetadataTemplate(profile: Partial<Profile>): string {
  const meta: ProfileMetadata = {};
  if (profile.name) meta.name = profile.name;
  if (profile.displayName) meta.display_name = profile.displayName;
  if (profile.about) meta.about = profile.about;
  if (profile.picture) meta.picture = profile.picture;
  if (profile.banner) meta.banner = profile.banner;
  if (profile.nip05) meta.nip05 = profile.nip05;
  if (profile.lud16) meta.lud16 = profile.lud16;
  if (profile.lud06) meta.lud06 = profile.lud06;
  if (profile.website) meta.website = profile.website;
  return JSON.stringify(meta);
}
