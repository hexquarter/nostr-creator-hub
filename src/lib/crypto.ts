const DEVICE_KEY_STORAGE = "crays.device-key.v1";

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return base64ToBytes(padded);
}

export function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(value: string): Uint8Array {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (hex.length % 2 !== 0) throw new Error("Invalid hex value");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error("Invalid hex value");
    bytes[i] = byte;
  }
  return bytes;
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  return new Uint8Array(digest);
}

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

/**
 * A device-bound AES key. It keeps secrets out of plain sight in localStorage,
 * but it is not a hardware boundary — passkey encryption is used for identities.
 */
export async function getDeviceKey(): Promise<CryptoKey> {
  let raw: Uint8Array | null = null;
  if (canUseStorage()) {
    try {
      const stored = window.localStorage.getItem(DEVICE_KEY_STORAGE);
      if (stored) raw = base64ToBytes(stored);
    } catch {
      raw = null;
    }
  }
  if (!raw || raw.length !== 32) {
    raw = crypto.getRandomValues(new Uint8Array(32));
    if (canUseStorage()) {
      try {
        window.localStorage.setItem(DEVICE_KEY_STORAGE, bytesToBase64(raw));
      } catch {
        // private mode: fall back to an ephemeral key
      }
    }
  }
  return crypto.subtle.importKey("raw", raw as unknown as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export type EncryptedBlob = { iv: string; ct: string };

export async function encryptBytes(key: CryptoKey, data: Uint8Array): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data as unknown as BufferSource,
  );
  return { iv: bytesToBase64(iv), ct: bytesToBase64(new Uint8Array(ct)) };
}

export async function decryptBytes(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
  const iv = base64ToBytes(blob.iv);
  const ct = base64ToBytes(blob.ct);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    ct as unknown as BufferSource,
  );
  return new Uint8Array(plain);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const blob = await encryptBytes(key, utf8ToBytes(JSON.stringify(value)));
  return `${blob.iv}.${blob.ct}`;
}

export async function decryptJson<T>(key: CryptoKey, value: string): Promise<T | null> {
  try {
    const [iv, ct] = value.split(".");
    if (!iv || !ct) return null;
    const bytes = await decryptBytes(key, { iv, ct });
    return JSON.parse(bytesToUtf8(bytes)) as T;
  } catch {
    return null;
  }
}

export async function hkdfKey(secret: ArrayBuffer | Uint8Array, salt: string, info: string) {
  const base = await crypto.subtle.importKey(
    "raw",
    secret as unknown as BufferSource,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: utf8ToBytes(salt) as unknown as BufferSource,
      info: utf8ToBytes(info) as unknown as BufferSource,
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
