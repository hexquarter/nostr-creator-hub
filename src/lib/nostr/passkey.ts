import { finalizeEvent, generateSecretKey, getPublicKey, type NostrEvent } from "nostr-tools";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  bytesToHex,
  decryptBytes,
  encryptBytes,
  getDeviceKey,
  hexToBytes,
  hkdfKey,
  sha256Bytes,
  utf8ToBytes,
} from "@/lib/crypto";
import { publishEvent, queryEvents } from "./relays";
import { pubkeyToNpub } from "./profiles";

const VAULT_INDEX_KEY = "crays.passkeys.v1";
const vaultKeyFor = (pubkey: string) => `crays.passkey.vault.${pubkey}`;
const VAULT_D_TAG = (pubkey: string) => `crays/passkey-vault/${pubkey}`;

export type PasskeyVault = {
  v: 1;
  pubkey: string;
  credentialId: string;
  prf: boolean;
  iv: string;
  ct: string;
  name?: string;
  createdAt: number;
};

export type PasskeyIndexEntry = {
  credentialId: string;
  pubkey: string;
  name?: string;
  createdAt: number;
};

export type PasskeyIdentity = {
  vault: PasskeyVault;
  secretKey: Uint8Array;
  pubkey: string;
  prfBacked: boolean;
};

function canUseStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function hasWebAuthn() {
  return typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;
}

export function listPasskeys(): PasskeyIndexEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(VAULT_INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PasskeyIndexEntry =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as PasskeyIndexEntry).credentialId === "string" &&
        typeof (entry as PasskeyIndexEntry).pubkey === "string",
    );
  } catch {
    return [];
  }
}

export function hasPasskey() {
  return listPasskeys().length > 0;
}

export function lastPasskey(): PasskeyIndexEntry | null {
  const entries = listPasskeys();
  return entries.length ? entries[entries.length - 1] : null;
}

function savePasskeyIndex(entry: PasskeyIndexEntry) {
  if (!canUseStorage()) return;
  const entries = listPasskeys().filter((e) => e.credentialId !== entry.credentialId);
  entries.push(entry);
  window.localStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(entries));
}

export function saveLocalVault(vault: PasskeyVault) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(vaultKeyFor(vault.pubkey), JSON.stringify(vault));
  savePasskeyIndex({
    credentialId: vault.credentialId,
    pubkey: vault.pubkey,
    name: vault.name,
    createdAt: vault.createdAt,
  });
}

export function loadLocalVault(pubkey: string): PasskeyVault | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(vaultKeyFor(pubkey));
    if (!raw) return null;
    return JSON.parse(raw) as PasskeyVault;
  } catch {
    return null;
  }
}

export function forgetPasskey(pubkey: string) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(vaultKeyFor(pubkey));
  const entries = listPasskeys().filter((e) => e.pubkey !== pubkey);
  window.localStorage.setItem(VAULT_INDEX_KEY, JSON.stringify(entries));
}

export async function fetchVaultFromRelays(pubkey: string): Promise<PasskeyVault | null> {
  const events = await queryEvents(
    { kinds: [30078], "#d": [VAULT_D_TAG(pubkey)], limit: 1 },
    { timeout: 5000 },
  );
  const event = events[0];
  if (!event) return null;
  try {
    const content = JSON.parse(event.content) as Omit<PasskeyVault, "v" | "pubkey" | "createdAt">;
    if (!content.iv || !content.ct || !content.credentialId) return null;
    return {
      v: 1,
      pubkey,
      credentialId: content.credentialId,
      prf: !!content.prf,
      iv: content.iv,
      ct: content.ct,
      name: content.name,
      createdAt: event.created_at,
    };
  } catch {
    return null;
  }
}

async function publishVault(vault: PasskeyVault, secretKey: Uint8Array) {
  try {
    const event = finalizeEvent(
      {
        kind: 30078,
        created_at: Math.floor(Date.now() / 1000),
        content: JSON.stringify({
          v: 1,
          credentialId: vault.credentialId,
          prf: vault.prf,
          iv: vault.iv,
          ct: vault.ct,
          name: vault.name,
        }),
        tags: [
          ["d", VAULT_D_TAG(vault.pubkey)],
          ["t", "crays-passkey-vault"],
          ["client", "crays"],
        ],
      },
      secretKey,
    );
    await publishEvent(event);
  } catch {
    // local vault still works; cross-device recovery is best-effort
  }
}

async function prfSalt(): Promise<Uint8Array> {
  return sha256Bytes(utf8ToBytes("crays.passkey.vault.v1"));
}

async function deriveVaultKey(prfOutput: ArrayBuffer | Uint8Array, pubkey: string) {
  return hkdfKey(prfOutput, "crays.passkey.v1", `vault:${pubkey}`);
}

type AssertionResult = {
  credentialId: string;
  userHandle: string | null;
  prfOutput: ArrayBuffer | null;
  prfEnabled: boolean;
};

function readPrf(credential: PublicKeyCredential): {
  output: ArrayBuffer | null;
  enabled: boolean;
} {
  const extensions = credential.getClientExtensionResults() as unknown as {
    prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } };
  };
  return {
    output: extensions.prf?.results?.first ?? null,
    enabled: !!extensions.prf?.enabled || !!extensions.prf?.results?.first,
  };
}

function describeWebAuthnError(error: unknown): Error {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") {
    return new Error("The passkey prompt was cancelled or timed out. Try again.");
  }
  if (name === "SecurityError") {
    return new Error("Passkeys can't run on this address. Use the app over HTTPS or localhost.");
  }
  if (name === "NotSupportedError") {
    return new Error(
      "This device or browser doesn't support passkeys yet. Use advanced sign-in below.",
    );
  }
  return error instanceof Error ? error : new Error("Couldn't use the passkey on this device.");
}

async function createCredential(displayName: string, pubkey: string) {
  if (!hasWebAuthn()) throw new Error("This browser doesn't support passkeys.");
  const salt = await prfSalt();
  const options = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rp: { id: window.location.hostname, name: "Crays" },
    user: {
      id: hexToBytes(pubkey),
      name: displayName || pubkeyToNpub(pubkey),
      displayName: displayName || "Crays creator",
    },
    pubKeyCredParams: [
      { type: "public-key" as const, alg: -7 },
      { type: "public-key" as const, alg: -257 },
    ],
    authenticatorSelection: {
      residentKey: "preferred" as const,
      userVerification: "required" as const,
    },
    timeout: 90000,
    attestation: "none" as const,
    extensions: { prf: { eval: { first: salt } } },
  };
  try {
    const credential = (await navigator.credentials.create({
      publicKey: options as unknown as PublicKeyCredentialCreationOptions,
    })) as PublicKeyCredential | null;
    if (!credential) throw new Error("Passkey setup was cancelled.");
    const prf = readPrf(credential);
    return {
      credential,
      credentialId: credential.id,
      prfOutput: prf.output,
      prfEnabled: prf.enabled,
    };
  } catch (error) {
    throw describeWebAuthnError(error);
  }
}

async function assertCredential(allowCredentials: string[] | null): Promise<AssertionResult> {
  if (!hasWebAuthn()) throw new Error("This browser doesn't support passkeys.");
  const salt = await prfSalt();
  const options = {
    challenge: crypto.getRandomValues(new Uint8Array(32)),
    rpId: window.location.hostname,
    allowCredentials:
      allowCredentials && allowCredentials.length
        ? allowCredentials.map((id) => ({
            type: "public-key" as const,
            id: base64UrlToBytes(id),
          }))
        : undefined,
    userVerification: "required" as const,
    timeout: 90000,
    extensions: { prf: { eval: { first: salt } } },
  };
  try {
    const credential = (await navigator.credentials.get({
      publicKey: options as unknown as PublicKeyCredentialRequestOptions,
    })) as PublicKeyCredential | null;
    if (!credential) throw new Error("Passkey sign-in was cancelled.");
    const response = credential.response as AuthenticatorAssertionResponse;
    const userHandle = response.userHandle ? bytesToHex(new Uint8Array(response.userHandle)) : null;
    const prf = readPrf(credential);
    return {
      credentialId: credential.id,
      userHandle,
      prfOutput: prf.output,
      prfEnabled: prf.enabled,
    };
  } catch (error) {
    throw describeWebAuthnError(error);
  }
}

async function encryptIdentity(
  secretKey: Uint8Array,
  prfOutput: ArrayBuffer | null,
  pubkey: string,
) {
  if (prfOutput) {
    const key = await deriveVaultKey(prfOutput, pubkey);
    const blob = await encryptBytes(key, secretKey);
    return { prf: true, ...blob };
  }
  const key = await getDeviceKey();
  const blob = await encryptBytes(key, secretKey);
  return { prf: false, ...blob };
}

async function decryptIdentity(
  vault: PasskeyVault,
  prfOutput: ArrayBuffer | null,
): Promise<Uint8Array> {
  const key = vault.prf
    ? prfOutput
      ? await deriveVaultKey(prfOutput, vault.pubkey)
      : null
    : await getDeviceKey();
  if (!key) {
    throw new Error(
      "This passkey can't decrypt your key on this device. Use advanced sign-in with your nsec.",
    );
  }
  return decryptBytes(key, { iv: vault.iv, ct: vault.ct });
}

/**
 * Create a brand-new Nostr identity protected by a passkey.
 * The encrypted key is also published as a Nostr event so a synced passkey can
 * recover the account on another device.
 */
export async function createPasskeyIdentity(
  displayName = "Crays creator",
): Promise<PasskeyIdentity> {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const created = await createCredential(displayName, pubkey);

  let prfOutput = created.prfOutput;
  if (!prfOutput && created.prfEnabled) {
    try {
      const assertion = await assertCredential([created.credentialId]);
      prfOutput = assertion.prfOutput;
    } catch {
      // fall back to device-bound encryption below
    }
  }

  const encrypted = await encryptIdentity(secretKey, prfOutput, pubkey);
  const vault: PasskeyVault = {
    v: 1,
    pubkey,
    credentialId: created.credentialId,
    prf: encrypted.prf,
    iv: encrypted.iv,
    ct: encrypted.ct,
    name: displayName,
    createdAt: Math.floor(Date.now() / 1000),
  };
  saveLocalVault(vault);
  await publishVault(vault, secretKey);

  return {
    vault,
    secretKey,
    pubkey,
    prfBacked: encrypted.prf,
  };
}

/** Unlock the passkey identity saved on this device (or synced passkeys). */
export async function unlockPasskeyIdentity(): Promise<PasskeyIdentity> {
  const entries = listPasskeys();
  const assertion = await assertCredential(
    entries.length ? entries.map((e) => e.credentialId) : null,
  );

  const known = entries.find((e) => e.credentialId === assertion.credentialId);
  const pubkey =
    (assertion.userHandle && /^[0-9a-f]{64}$/i.test(assertion.userHandle)
      ? assertion.userHandle.toLowerCase()
      : null) ?? known?.pubkey;

  if (!pubkey) {
    throw new Error(
      "We found a passkey but not the Crays account it belongs to. Use advanced sign-in with your nsec once, then create a new passkey.",
    );
  }

  let vault = loadLocalVault(pubkey);
  if (!vault) vault = await fetchVaultFromRelays(pubkey);
  if (!vault) {
    throw new Error("This passkey isn't linked to an account on this device yet.");
  }
  if (vault.credentialId !== assertion.credentialId && vault.prf) {
    throw new Error(
      "This passkey belongs to a different credential than the one that encrypted this account.",
    );
  }

  const secretKey = await decryptIdentity(vault, assertion.prfOutput);
  saveLocalVault(vault);
  return {
    vault,
    secretKey,
    pubkey,
    prfBacked: vault.prf,
  };
}

/** Recover a vault from Nostr using a known public key (used after signer login). */
export async function loadVaultForPubkey(pubkey: string): Promise<PasskeyVault | null> {
  return loadLocalVault(pubkey) ?? (await fetchVaultFromRelays(pubkey));
}

export type { NostrEvent };
