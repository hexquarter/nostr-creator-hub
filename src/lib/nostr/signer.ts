import {
  finalizeEvent,
  getPublicKey,
  nip04,
  nip44,
  type EventTemplate,
  type NostrEvent,
} from "nostr-tools";

/** The signing surface every Crays identity method implements. */
export interface AppSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<NostrEvent>;
  nip04Encrypt?(pubkey: string, plaintext: string): Promise<string>;
  nip04Decrypt?(pubkey: string, ciphertext: string): Promise<string>;
  nip44Encrypt?(pubkey: string, plaintext: string): Promise<string>;
  nip44Decrypt?(pubkey: string, ciphertext: string): Promise<string>;
  close?(): Promise<void>;
}

/** Keys held in memory (passkey vault or nsec import). */
export class LocalSigner implements AppSigner {
  readonly secretKey: Uint8Array;

  constructor(secretKey: Uint8Array) {
    this.secretKey = secretKey;
  }

  async getPublicKey() {
    return getPublicKey(this.secretKey);
  }

  async signEvent(event: EventTemplate) {
    return finalizeEvent(event, this.secretKey);
  }

  async nip04Encrypt(pubkey: string, plaintext: string) {
    return nip04.encrypt(this.secretKey, pubkey, plaintext);
  }

  async nip04Decrypt(pubkey: string, ciphertext: string) {
    return nip04.decrypt(this.secretKey, pubkey, ciphertext);
  }

  async nip44Encrypt(pubkey: string, plaintext: string) {
    return nip44.encrypt(plaintext, nip44.getConversationKey(this.secretKey, pubkey));
  }

  async nip44Decrypt(pubkey: string, ciphertext: string) {
    return nip44.decrypt(ciphertext, nip44.getConversationKey(this.secretKey, pubkey));
  }
}

type Nip07Provider = {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<NostrEvent>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
};

/** NIP-07 browser extension (Alby, nos2x, …). */
export class Nip07Signer implements AppSigner {
  private provider: Nip07Provider;

  constructor(provider: Nip07Provider) {
    this.provider = provider;
  }

  async getPublicKey() {
    return this.provider.getPublicKey();
  }

  async signEvent(event: EventTemplate) {
    return this.provider.signEvent(event);
  }

  async nip04Encrypt(pubkey: string, plaintext: string) {
    if (!this.provider.nip04) throw new Error("Your extension doesn't support encrypted messages.");
    return this.provider.nip04.encrypt(pubkey, plaintext);
  }

  async nip04Decrypt(pubkey: string, ciphertext: string) {
    if (!this.provider.nip04) throw new Error("Your extension doesn't support encrypted messages.");
    return this.provider.nip04.decrypt(pubkey, ciphertext);
  }

  async nip44Encrypt(pubkey: string, plaintext: string) {
    if (!this.provider.nip44) throw new Error("Your extension doesn't support NIP-44 encryption.");
    return this.provider.nip44.encrypt(pubkey, plaintext);
  }

  async nip44Decrypt(pubkey: string, ciphertext: string) {
    if (!this.provider.nip44) throw new Error("Your extension doesn't support NIP-44 encryption.");
    return this.provider.nip44.decrypt(pubkey, ciphertext);
  }
}

export function getNip07Provider(): Nip07Provider | null {
  if (typeof window === "undefined") return null;
  const nostr = (window as unknown as { nostr?: Nip07Provider }).nostr;
  return nostr && typeof nostr.getPublicKey === "function" ? nostr : null;
}

/** Wrap a NIP-46 remote signer so the whole app uses one signer interface. */
export function wrapRemoteSigner(remote: {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<NostrEvent>;
  nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>;
  nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>;
  nip44Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string>;
  nip44Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string>;
  close?(): Promise<void>;
}): AppSigner {
  return {
    getPublicKey: () => remote.getPublicKey(),
    signEvent: (event) => remote.signEvent(event),
    nip04Encrypt: (pubkey, text) => remote.nip04Encrypt(pubkey, text),
    nip04Decrypt: (pubkey, text) => remote.nip04Decrypt(pubkey, text),
    nip44Encrypt: (pubkey, text) => remote.nip44Encrypt(pubkey, text),
    nip44Decrypt: (pubkey, text) => remote.nip44Decrypt(pubkey, text),
    close: remote.close ? () => remote.close!() : undefined,
  };
}

export function randomHex(bytes = 16) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, (b) => b.toString(16).padStart(2, "0")).join("");
}
