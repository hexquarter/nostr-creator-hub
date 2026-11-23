import { nip98 } from "nostr-tools";
import type { AppSigner } from "./signer";

/**
 * The keybox is a tiny companion service that lets members-only posts unlock
 * while the creator is offline (see `keybox/` in this repo). The creator's
 * client uploads post keys signed with a NIP-98 auth event; readers redeem
 * their settled BOLT-11 invoice for the key, which the keybox verifies against
 * the creator's own LUD-21 endpoint.
 *
 * Without a keybox everything still works while the creator is signed in —
 * their client runs the key server. The keybox just removes the online
 * requirement, and unlocks the full post history for subscribers.
 */
const CONFIGURED_URL =
  (import.meta.env.VITE_CRAYS_KEYBOX_URL as string | undefined)?.trim().replace(/\/+$/, "") || "";

export function keyboxUrl(): string | null {
  return CONFIGURED_URL || null;
}

/** One content key covering one members-only post. */
export async function uploadPostKey(input: {
  signer: AppSigner;
  address: string;
  badgeSats: number;
  unlockSats: number;
  postId: string;
  key: string;
}): Promise<boolean> {
  const base = keyboxUrl();
  if (!base) return false;
  const payload = {
    address: input.address,
    badgeSats: input.badgeSats,
    unlockSats: input.unlockSats,
    postId: input.postId,
    key: input.key,
  };
  try {
    const auth = await nip98.getToken(
      `${base}/keys`,
      "POST",
      (event) => input.signer.signEvent(event),
      true,
      payload,
    );
    const response = await fetch(`${base}/keys`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Post ids the keybox already holds keys for, or null when unreachable. */
export async function listKeyboxPosts(
  signer: AppSigner,
  creator: string,
): Promise<string[] | null> {
  const base = keyboxUrl();
  if (!base) return null;
  try {
    const auth = await nip98.getToken(`${base}/mine`, "GET", (event) => signer.signEvent(event));
    const response = await fetch(`${base}/mine`, { headers: { Authorization: auth } });
    if (!response.ok) return null;
    const body = (await response.json()) as { posts?: unknown };
    if (!Array.isArray(body.posts)) return null;
    return body.posts.filter((id): id is string => typeof id === "string");
  } catch {
    return null;
  }
}

/** Redeem a settled invoice for a post's key. Null means "no key for you". */
export async function fetchKeyFromKeybox(
  creator: string,
  postId: string,
  invoice?: string,
): Promise<string | null> {
  const base = keyboxUrl();
  if (!base || !invoice) return null;
  try {
    const url = `${base}/keys?creator=${encodeURIComponent(creator)}&post=${encodeURIComponent(
      postId,
    )}&pr=${encodeURIComponent(invoice)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const body = (await response.json()) as { key?: unknown };
    if (typeof body.key !== "string" || body.key.length !== 64) return null;
    return body.key;
  } catch {
    return null;
  }
}
