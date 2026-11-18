import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip04,
  type NostrEvent,
} from "nostr-tools";
import { pool } from "./relays";

export type NwcInfo = {
  alias?: string;
  color?: string;
  pubkey?: string;
  network?: string;
  block_height?: number;
  block_hash?: string;
  methods?: string[];
  notifications?: string[];
};

export type NwcInvoice = {
  invoice: string;
  payment_hash?: string;
  expires_at?: number;
};

export type NwcPayment = {
  preimage?: string;
  fees_paid?: number;
};

export type NwcTransaction = {
  type: "incoming" | "outgoing";
  invoice?: string;
  description?: string;
  description_hash?: string;
  preimage?: string;
  payment_hash?: string;
  amount: number;
  fees_paid?: number;
  created_at: number;
  settled_at?: number;
  metadata?: Record<string, unknown>;
};

type NwcConnection = {
  pubkey: string;
  relays: string[];
  secret: string;
};

type NwcError = { code?: string; message?: string };

/**
 * Parse a NIP-47 connection string:
 * nostr+walletconnect://<wallet-pubkey>?relay=<relay>&secret=<hex>[&lud16=…]
 */
export function parseNwcConnection(uri: string): NwcConnection {
  const trimmed = uri.trim();
  const match = trimmed.match(/^nostr\+walletconnect:\/\/([0-9a-f]{64})(?:\?(.*))?$/i);
  if (!match) {
    throw new Error("That doesn't look like a Nostr Wallet Connect string.");
  }
  const params = new URLSearchParams(match[2] ?? "");
  const relays = params.getAll("relay").filter(Boolean);
  const secret = params.get("secret") ?? "";
  if (!relays.length) {
    throw new Error("That wallet connection string is missing a relay.");
  }
  if (!secret) {
    throw new Error("That wallet connection string is missing a secret.");
  }
  return { pubkey: match[1].toLowerCase(), relays, secret };
}

/**
 * Minimal NIP-47 client. Requests are signed with a throwaway key per call,
 * so the wallet can't correlate payments to a long-lived client identity.
 */
export class NwcClient {
  private connection: NwcConnection;

  constructor(connectionString: string) {
    this.connection = parseNwcConnection(connectionString);
  }

  get walletPubkey() {
    return this.connection.pubkey;
  }

  get relays() {
    return this.connection.relays;
  }

  private async request<T>(
    method: string,
    params: Record<string, unknown>,
    timeout = 30000,
  ): Promise<T> {
    const secretKey = generateSecretKey();
    const clientPubkey = getPublicKey(secretKey);
    const content = nip04.encrypt(
      secretKey,
      this.connection.pubkey,
      JSON.stringify({ method, params }),
    );
    const request = finalizeEvent(
      {
        kind: 23194,
        created_at: Math.floor(Date.now() / 1000),
        content,
        tags: [["p", this.connection.pubkey]],
      },
      secretKey,
    );

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let sub: { close: () => void } | null = null;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        sub?.close();
        fn();
      };

      const timer = setTimeout(() => {
        finish(() =>
          reject(new Error("Your wallet didn't respond. Check that it's online and unlocked.")),
        );
      }, timeout);

      sub = pool.subscribeMany(
        this.connection.relays,
        {
          kinds: [23195],
          authors: [this.connection.pubkey],
          "#p": [clientPubkey],
        },
        {
          onevent: (reply: NostrEvent) => {
            const requestId = reply.tags.find((tag) => tag[0] === "e")?.[1];
            if (requestId && requestId !== request.id) return;
            let payload: { result?: T; error?: NwcError };
            try {
              payload = JSON.parse(
                nip04.decrypt(secretKey, this.connection.pubkey, reply.content),
              ) as {
                result?: T;
                error?: NwcError;
              };
            } catch {
              return;
            }
            if (payload.error) {
              finish(() =>
                reject(new Error(payload.error?.message || "Your wallet rejected the request.")),
              );
              return;
            }
            finish(() => resolve(payload.result as T));
          },
        },
      );

      Promise.allSettled(pool.publish(this.connection.relays, request)).then((results) => {
        const rejected = results.filter((result) => result.status === "rejected");
        if (rejected.length === results.length) {
          const reason = rejected[0]?.status === "rejected" ? rejected[0].reason : null;
          finish(() =>
            reject(
              reason instanceof Error ? reason : new Error("Couldn't reach your wallet relay."),
            ),
          );
        }
      });
    });
  }

  getInfo() {
    return this.request<NwcInfo>("get_info", {}, 6000);
  }

  /** Wallet balance in sats. */
  async getBalance(): Promise<number> {
    const result = await this.request<{ balance: number }>("get_balance", {}, 8000);
    return Math.floor((result.balance ?? 0) / 1000);
  }

  payInvoice(invoice: string) {
    return this.request<NwcPayment>("pay_invoice", { invoice }, 60000);
  }

  async listTransactions(limit = 25): Promise<NwcTransaction[]> {
    const result = await this.request<{ transactions?: NwcTransaction[] }>(
      "list_transactions",
      { limit },
      12000,
    );
    return result.transactions ?? [];
  }

  makeInvoice(amountSats: number, description = "Crays") {
    return this.request<NwcInvoice>(
      "make_invoice",
      {
        amount: Math.round(amountSats * 1000),
        description,
      },
      30000,
    );
  }
}
