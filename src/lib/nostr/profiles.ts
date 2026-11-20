import { nip19, type Filter, type NostrEvent } from "nostr-tools";
import { getRelayList, normalizeRelayUrl, pool, queryEvents } from "./relays";
import { primalFollowerCounts, primalUserSearchEvents } from "./primal-cache";

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
  /** Only populated by profile search (via Primal's cache). */
  followers?: number;
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

export type ProfilePointer = {
  pubkey: string;
  /** Relay hints carried by an nprofile, when present. */
  relays: string[];
};

/**
 * Accept a hex key, npub or nprofile — including `nostr:` URIs and links that
 * contain one (for example https://njump.me/nprofile1…).
 */
export function parseProfilePointer(input: string): ProfilePointer | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[0-9a-f]{64}$/i.test(value)) return { pubkey: value.toLowerCase(), relays: [] };

  const match = value.match(/(?:nostr:)?(?:npub|nprofile)1[0-9a-z]+/i);
  if (!match) return null;
  const token = match[0].replace(/^nostr:/i, "").toLowerCase();
  try {
    const decoded = nip19.decode(token);
    if (decoded.type === "npub") return { pubkey: decoded.data, relays: [] };
    if (decoded.type === "nprofile") {
      return { pubkey: decoded.data.pubkey, relays: decoded.data.relays ?? [] };
    }
  } catch {
    return null;
  }
  return null;
}

export function normalizePubkey(input: string): string | null {
  return parseProfilePointer(input)?.pubkey ?? null;
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

const PROFILE_DISCOVERY_RELAYS = [
  "wss://purplepag.es",
  "wss://relay.snort.social",
  "wss://relay.nostr.net",
  "wss://relay.noswhere.com",
  "wss://profiles.nostr1.com",
  "wss://user.kindpag.es",
];

async function discoverUserRelays(pubkey: string, hints: string[] = []): Promise<string[]> {
  const sources = Array.from(
    new Set([...hints, ...getRelayList(), ...PROFILE_DISCOVERY_RELAYS].filter(Boolean)),
  );
  const events = await queryEvents(
    { kinds: [10002], authors: [pubkey], limit: 1 },
    { relays: sources, timeout: 3500, fresh: true },
  );
  const event = events[0];
  if (!event) return [];
  const relays = new Set<string>();
  for (const tag of event.tags) {
    if (tag[0] !== "r" || !tag[1]) continue;
    const url = normalizeRelayUrl(tag[1]);
    if (url) relays.add(url);
  }
  return [...relays];
}

export async function fetchProfile(pubkey: string, relays?: string[]): Promise<Profile> {
  const base = relays && relays.length > 0 ? relays : getRelayList();
  let events = await queryEvents(
    { kinds: [0], authors: [pubkey], limit: 1 },
    { relays: base, timeout: 3500 },
  );
  if (!events[0]) {
    const discovered = await discoverUserRelays(pubkey, relays ?? []);
    const merged = Array.from(new Set([...base, ...discovered, ...PROFILE_DISCOVERY_RELAYS]));
    events = await queryEvents(
      { kinds: [0], authors: [pubkey], limit: 1 },
      { relays: merged, timeout: 5000, fresh: true },
    );
  }
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

  const baseRelays = relays ?? getRelayList();

  // Relays sometimes cap `authors`; chunk to stay friendly.
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 80) chunks.push(unique.slice(i, i + 80));

  const events = (
    await Promise.all(
      chunks.map((authors) =>
        queryEvents(
          { kinds: [0], authors, limit: authors.length * 2 },
          { relays: baseRelays, timeout: 4500 },
        ),
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

  const missing = unique.filter((pubkey) => !map.has(pubkey));
  if (missing.length > 0) {
    const discoveryRelays = Array.from(new Set([...baseRelays, ...PROFILE_DISCOVERY_RELAYS]));
    const discoveryChunks: string[][] = [];
    for (let i = 0; i < missing.length; i += 80) {
      discoveryChunks.push(missing.slice(i, i + 80));
    }
    const discoveredEvents = (
      await Promise.all(
        discoveryChunks.map((authors) =>
          queryEvents(
            { kinds: [0], authors, limit: authors.length * 2 },
            { relays: discoveryRelays, timeout: 5000, fresh: true },
          ),
        ),
      )
    ).flat();
    for (const event of discoveredEvents) {
      const current = newest.get(event.pubkey);
      if (!current || event.created_at > current.created_at) newest.set(event.pubkey, event);
    }
    for (const pubkey of missing) {
      if (newest.has(pubkey)) map.set(pubkey, profileFromEvent(newest.get(pubkey)!));
    }
  }

  return map;
}

type SearchOptions = {
  limit?: number;
  timeout?: number;
  /** Called as soon as fast (cache) results are ready, before slower relays. */
  onPartial?: (profiles: Profile[]) => void;
};

/**
 * Search kind-0 profiles by name/display name/nip05. Primal's cache answers in
 * ~200-300ms and includes follower counts, so it is tried first; NIP-50 relays
 * are only used as a fallback or to widen weak matches.
 */
export async function searchProfiles(
  query: string,
  options: SearchOptions = {},
): Promise<Profile[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const limit = options.limit ?? 20;

  const cached = await searchProfilesInCache(q, limit).catch(() => []);
  const rankedCache = rankProfiles(cached, q, limit);
  if (rankedCache.length > 0) options.onPartial?.(rankedCache);

  // A strong direct name match from the cache is enough — don't make the user
  // wait for relays. Otherwise fall back to NIP-50 relays for extra recall.
  const hasStrongMatch = rankedCache.some((profile) => profileSearchScore(profile, q) >= 60);
  if (hasStrongMatch) return rankedCache;

  const relayProfiles = await searchProfilesOnRelaysNetwork(q, options.timeout ?? 5000);
  const merged = mergeProfiles(rankedCache, relayProfiles);
  const ranked = rankProfiles(merged, q, limit);
  if (ranked.length > rankedCache.length) options.onPartial?.(ranked);
  return ranked;
}

async function searchProfilesInCache(query: string, limit: number): Promise<Profile[]> {
  const events = await primalUserSearchEvents(query, Math.max(limit * 2, 24));
  const newest = new Map<string, NostrEvent>();
  for (const event of events) {
    const current = newest.get(event.pubkey);
    if (!current || event.created_at > current.created_at) newest.set(event.pubkey, event);
  }
  const profiles = [...newest.values()].map(profileFromEvent);
  if (profiles.length === 0) return [];

  const counts = await primalFollowerCounts(profiles.map((profile) => profile.pubkey));
  for (const profile of profiles) {
    const followers = counts.get(profile.pubkey.toLowerCase());
    if (typeof followers === "number") profile.followers = followers;
  }
  return profiles;
}

async function searchProfilesOnRelaysNetwork(query: string, timeout: number): Promise<Profile[]> {
  // Prefer relays known to support NIP-50 profile search.
  const relays = [
    "wss://relay.nostr.band",
    "wss://search.nos.today",
    "wss://relay.primal.net",
    "wss://relay.noswhere.com",
  ];

  const filter: Filter = { kinds: [0], search: query, limit: 100 };
  const events = await searchProfilesOnRelays(relays, filter, timeout);

  const newest = new Map<string, NostrEvent>();
  for (const event of events) {
    const current = newest.get(event.pubkey);
    if (!current || event.created_at > current.created_at) newest.set(event.pubkey, event);
  }
  const profiles = [...newest.values()].map(profileFromEvent);
  if (profiles.length === 0) return [];

  // Reuse the cache for follower counts so duplicates can be told apart.
  const counts = await primalFollowerCounts(profiles.map((profile) => profile.pubkey)).catch(
    () => new Map<string, number>(),
  );
  for (const profile of profiles) {
    const followers = counts.get(profile.pubkey.toLowerCase());
    if (typeof followers === "number") profile.followers = followers;
  }
  return profiles;
}

function mergeProfiles(primary: Profile[], secondary: Profile[]): Profile[] {
  const byPubkey = new Map<string, Profile>();
  for (const profile of [...primary, ...secondary]) {
    const existing = byPubkey.get(profile.pubkey);
    if (!existing) {
      byPubkey.set(profile.pubkey, profile);
      continue;
    }
    if (existing.followers === undefined && profile.followers !== undefined) {
      existing.followers = profile.followers;
    }
  }
  return [...byPubkey.values()];
}

function rankProfiles(profiles: Profile[], query: string, limit: number): Profile[] {
  let filtered = profiles.filter((profile) => profileMatchesQuery(profile, query));

  // NIP-50 relays can rank valid name matches lower than noisy results; keep
  // relay-returned profiles when strict matching finds nothing so an exact or
  // near-exact display name still shows up.
  if (filtered.length === 0) filtered = profiles;

  filtered.sort((a, b) => {
    const scoreDiff = profileSearchScore(b, query) - profileSearchScore(a, query);
    if (scoreDiff !== 0) return scoreDiff;
    const followerDiff = (b.followers ?? -1) - (a.followers ?? -1);
    if (followerDiff !== 0) return followerDiff;
    return a.displayName.localeCompare(b.displayName);
  });
  return filtered.slice(0, limit);
}

async function searchProfilesOnRelays(
  relays: string[],
  filter: Filter,
  timeout: number,
): Promise<NostrEvent[]> {
  if (typeof window === "undefined" || relays.length === 0) return [];

  return new Promise<NostrEvent[]>((resolve) => {
    const byId = new Map<string, NostrEvent>();
    const subs: Array<{ close: () => void }> = [];
    let settled = false;
    let finished = 0;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      for (const sub of subs) {
        try {
          sub.close();
        } catch {
          // relay already gone
        }
      }
      resolve([...byId.values()]);
    };

    const deadline = setTimeout(finish, timeout);

    const done = () => {
      finished += 1;
      if (finished >= relays.length) finish();
    };

    for (const url of relays) {
      void pool
        .ensureRelay(url, { connectionTimeout: 4000 })
        .then((relay) => {
          if (settled) return;
          if (!relay) {
            done();
            return;
          }
          let ended = false;
          const end = () => {
            if (ended) return;
            ended = true;
            done();
          };
          try {
            const sub = relay.subscribe([filter], {
              onevent(event) {
                const existing = byId.get(event.id);
                if (!existing || event.created_at > existing.created_at) {
                  byId.set(event.id, event);
                }
              },
              oneose: end,
              onclose: end,
            });
            subs.push(sub);
          } catch {
            end();
          }
        })
        .catch(() => {
          if (!settled) done();
        });
    }
  });
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function profileMatchesQuery(profile: Profile, query: string): boolean {
  const needle = query.toLowerCase().trim();
  const compactNeedle = compactSearchText(query);
  const fields = [
    profile.displayName,
    profile.name,
    profile.nip05,
    profile.about,
    profile.handle,
    profile.website,
  ].filter(Boolean) as string[];
  const haystack = fields.join(" ").toLowerCase();
  const compactHaystack = compactSearchText(fields.join(" "));

  if (needle && haystack.includes(needle)) return true;
  if (compactNeedle.length >= 2 && compactHaystack.includes(compactNeedle)) return true;

  const tokens = normalizeSearchText(query).split(" ").filter(Boolean);
  if (tokens.length > 0) {
    const normalizedHaystack = normalizeSearchText(fields.join(" "));
    if (tokens.every((token) => normalizedHaystack.includes(token))) return true;
  }

  return false;
}

function profileSearchScore(profile: Profile, query: string): number {
  let score = 0;
  const needle = query.toLowerCase().trim();
  const compactNeedle = compactSearchText(query);
  const display = profile.displayName.toLowerCase();
  const name = profile.name.toLowerCase();
  const nip05 = (profile.nip05 ?? "").toLowerCase();
  const compactDisplay = compactSearchText(profile.displayName);
  const compactName = compactSearchText(profile.name);

  if (
    display === needle ||
    name === needle ||
    compactDisplay === compactNeedle ||
    compactName === compactNeedle
  )
    score += 140;
  else if (
    display.startsWith(needle) ||
    name.startsWith(needle) ||
    compactDisplay.startsWith(compactNeedle) ||
    compactName.startsWith(compactNeedle)
  )
    score += 80;
  else if (
    normalizeSearchText(profile.displayName)
      .split(" ")
      .some((part) => part.startsWith(normalizeSearchText(query)))
  )
    score += 50;
  else if (
    display.includes(needle) ||
    name.includes(needle) ||
    compactDisplay.includes(compactNeedle) ||
    compactName.includes(compactNeedle)
  )
    score += 30;

  if (nip05 === needle || nip05.split("@")[0] === needle) score += 35;
  else if (nip05.startsWith(needle) || nip05.includes(needle)) score += 12;

  const about = (profile.about ?? "").toLowerCase();
  if (about.includes(needle)) score += 4;

  if (profile.picture) score += 2;
  if (profile.nip05) score += 1;
  return score;
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
