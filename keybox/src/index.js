/**
 * Crays keybox — offline key distribution for members-only posts.
 *
 * The creator's Crays client deposits each encrypted post's content key here
 * (signed with a NIP-98 auth event, kind 27235), along with the prices the
 * post accepts. Readers redeem a settled BOLT-11 invoice for the key:
 *
 *   - an invoice of at least the membership price, settled within the last 30
 *     days, unlocks every post of that creator (the subscription route, and
 *     with it the full post history);
 *   - an invoice of at least the single-post price unlocks exactly one post —
 *     an invoice binds to the first post it redeems, so one cheap payment
 *     cannot unlock everything.
 *
 * Settlement is verified against the creator's own LUD-21 `verify` endpoint,
 * so the keybox doesn't need a wallet, a Nostr key, or the creator online.
 * Deploy: `npx wrangler deploy` in this folder (create the KV namespace first).
 */

import { unpackEventFromToken, validateToken, hashPayload } from "nostr-tools/nip98";

const KIND_HTTP_AUTH = 27235;
const BADGE_DAYS_SECONDS = 30 * 24 * 60 * 60;
const UNLOCK_BINDING_TTL_SECONDS = 60 * 60 * 24 * 365;

// Minimal bech32 decoding (BOLT-11 uses bech32, not bech32m).
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function bech32Decode(value, limit) {
  const lower = String(value).toLowerCase();
  if (lower.length > limit) throw new Error("too long");
  const separator = lower.lastIndexOf("1");
  if (separator < 1 || separator + 7 > lower.length) throw new Error("invalid bech32");
  const hrp = lower.slice(0, separator);
  const words = [];
  for (const char of lower.slice(separator + 1)) {
    const index = BECH32_CHARSET.indexOf(char);
    if (index === -1) throw new Error("invalid character");
    words.push(index);
  }
  const values = [
    ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
    0,
    ...[...hrp].map((c) => c.charCodeAt(0) & 31),
    ...words,
  ];
  if (bech32Polymod(values) !== 1) throw new Error("bad checksum");
  return { hrp, words: words.slice(0, -6) };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ---------- NIP-98 auth ----------

function tagValue(event, name) {
  return event.tags.find((tag) => tag[0] === name)?.[1];
}

/**
 * Verify a `Nostr <base64 event>` Authorization header against this request:
 * valid Schnorr signature, kind 27235, fresh timestamp, and the u/method tags
 * matching this exact URL and method.
 */
async function verifyAuth(request) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Nostr ") ? header.slice(6).trim() : header.trim();
  if (!token) return null;
  try {
    const event = await unpackEventFromToken(token);
    if (event.kind !== KIND_HTTP_AUTH) return null;
    await validateToken(token, new URL(request.url).toString(), request.method);
    return event;
  } catch {
    return null;
  }
}

// ---------- BOLT-11 ----------

/** Amount in sats, decoded from the hrp (lnbc<magnitude><unit>). */
function invoiceAmountSats(pr) {
  const s = String(pr).toLowerCase().slice(0, 50);
  const separator = s.lastIndexOf("1");
  if (separator < 4) return 0;
  const hrp = s.slice(0, separator);
  if (!hrp.startsWith("lnbc")) return 0;
  const amount = hrp.slice(4);
  if (!amount.length) return 0;
  const unit = amount[amount.length - 1];
  const digits = unit >= "0" && unit <= "9" ? amount : amount.slice(0, -1);
  const num = Number.parseInt(digits, 10);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const multipliers = { m: 1e5, u: 100, n: 0.1, p: 1e-4 };
  if (unit in multipliers) return Math.floor(num * multipliers[unit]);
  return num * 1e8; // whole bitcoin
}

/** Invoice creation time, from the first 35 bits of the bech32 data. */
function invoiceTimestamp(pr) {
  try {
    const { words } = bech32Decode(pr, 2000);
    let ts = 0;
    for (let i = 0; i < 7; i++) ts = ts * 32 + words[i];
    return ts;
  } catch {
    return 0;
  }
}

// ---------- LUD-21 settlement check ----------

const verifyEndpointCache = new Map();

async function fetchVerifyEndpoint(address) {
  const domain = String(address).split("@")[1]?.toLowerCase();
  if (!domain) return null;
  if (verifyEndpointCache.has(domain)) return verifyEndpointCache.get(domain);
  try {
    const [name, host] = address.split("@");
    const metaResponse = await fetch(
      `https://${host}/.well-known/lnurlp/${encodeURIComponent(name)}`,
    );
    if (!metaResponse.ok) return null;
    const meta = await metaResponse.json();
    if (!meta.callback) return null;
    const callback = new URL(meta.callback);
    callback.searchParams.set("amount", String(Math.max(1000, meta.minSendable ?? 1000)));
    const invoiceResponse = await fetch(callback.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!invoiceResponse.ok) return null;
    const invoiceBody = await invoiceResponse.json();
    if (!invoiceBody.verify) return null;
    const resolved = new URL(invoiceBody.verify, callback);
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") return null;
    verifyEndpointCache.set(domain, resolved.toString());
    return resolved.toString();
  } catch {
    return null;
  }
}

/** "settled" | "unsettled" | "unsupported" — per the creator's own service. */
async function verifySettled(address, pr) {
  const endpoint = await fetchVerifyEndpoint(address);
  if (!endpoint) return "unsupported";
  try {
    const url = new URL(endpoint);
    url.searchParams.set("invoice", pr);
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return "unsettled";
    const body = await response.json();
    return body.status === "settled" || body.settled === true ? "settled" : "unsettled";
  } catch {
    return "unsettled";
  }
}

// ---------- Routing ----------

function validHex64(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
}

async function handleUpload(request, env) {
  const auth = await verifyAuth(request);
  if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
  const body = await request.json().catch(() => null);
  if (!body) return jsonResponse({ error: "invalid body" }, 400);
  // The auth event commits to this exact payload; reject a mismatch.
  if (tagValue(auth, "payload") !== hashPayload(body)) {
    return jsonResponse({ error: "payload mismatch" }, 401);
  }
  const { postId, key, address, badgeSats, unlockSats } = body;
  if (!validHex64(postId) || !validHex64(key)) {
    return jsonResponse({ error: "postId and key must be 64-char hex" }, 400);
  }
  const record = {
    key,
    address: typeof address === "string" ? address : "",
    badgeSats: Number(badgeSats) || 0,
    unlockSats: Number(unlockSats) || 0,
    at: Math.floor(Date.now() / 1000),
  };
  await env.KEYBOX.put(`k:${auth.pubkey}:${postId}`, JSON.stringify(record));
  return jsonResponse({ ok: true });
}

async function handleList(request, env) {
  const auth = await verifyAuth(request);
  if (!auth) return jsonResponse({ error: "unauthorized" }, 401);
  const posts = [];
  let cursor;
  do {
    const page = await env.KEYBOX.list({ prefix: `k:${auth.pubkey}:`, cursor });
    for (const key of page.keys) {
      const postId = key.name.split(":")[2];
      if (postId) posts.push(postId);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return jsonResponse({ posts });
}

async function handleRedeem(request, env) {
  const url = new URL(request.url);
  const creator = url.searchParams.get("creator");
  const postId = url.searchParams.get("post");
  const pr = url.searchParams.get("pr");
  if (!validHex64(creator) || !validHex64(postId)) {
    return jsonResponse({ error: "bad request" }, 400);
  }
  const raw = await env.KEYBOX.get(`k:${creator}:${postId}`);
  if (!raw) return jsonResponse({ error: "not found" }, 404);
  const record = JSON.parse(raw);
  if (!pr || typeof pr !== "string" || pr.length < 50) {
    return jsonResponse({ error: "payment required" }, 403);
  }

  const settled = await verifySettled(record.address, pr);
  if (settled !== "settled") return jsonResponse({ error: "payment not settled" }, 403);

  const sats = invoiceAmountSats(pr);
  const paidAt = invoiceTimestamp(pr);
  const now = Math.floor(Date.now() / 1000);

  // Subscription route: a settled invoice at or above the membership price,
  // inside its 30-day window, covers every post of the creator — history
  // included.
  const membership =
    record.badgeSats > 0 &&
    sats >= record.badgeSats &&
    paidAt > 0 &&
    now - paidAt <= BADGE_DAYS_SECONDS;
  if (membership) return jsonResponse({ key: record.key, via: "membership" });

  // Single-post route: at or above the post price, and each invoice redeems
  // exactly one post — the first one it asks for.
  if (record.unlockSats > 0 && sats >= record.unlockSats) {
    const bindingKey = `inv:${await sha256Hex(pr)}`;
    const bound = await env.KEYBOX.get(bindingKey);
    if (bound) {
      if (JSON.parse(bound).post === postId) {
        return jsonResponse({ key: record.key, via: "unlock" });
      }
      return jsonResponse({ error: "invoice already used for another post" }, 403);
    }
    await env.KEYBOX.put(bindingKey, JSON.stringify({ post: postId }), {
      expirationTtl: UNLOCK_BINDING_TTL_SECONDS,
    });
    return jsonResponse({ key: record.key, via: "unlock" });
  }

  return jsonResponse({ error: "amount too low" }, 403);
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    try {
      if (request.method === "POST" && url.pathname === "/keys") return await handleUpload(request, env);
      if (request.method === "GET" && url.pathname === "/mine") return await handleList(request, env);
      if (request.method === "GET" && url.pathname === "/keys") return await handleRedeem(request, env);
      return jsonResponse({ error: "not found" }, 404);
    } catch (error) {
      return jsonResponse({ error: String(error && error.message ? error.message : error) }, 500);
    }
  },
};
