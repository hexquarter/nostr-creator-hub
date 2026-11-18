import type { NostrEvent } from "nostr-tools";
import { bech32 } from "@scure/base";
import {
  getSatoshisAmountFromBolt11,
  getZapEndpoint,
  makeZapRequest,
  useFetchImplementation,
} from "nostr-tools/nip57";
import { getRelayList, publishEvent } from "./relays";
import type { Profile } from "./profiles";
import type { AppSigner } from "./signer";

// nostr-tools requires an explicit fetch implementation for LNURL lookups.
// eslint-disable-next-line react-hooks/rules-of-hooks -- not a React hook
useFetchImplementation(fetch);

export type ZapInvoice = {
  invoice: string;
  amountSats: number;
  callback: string;
  zapRequest?: NostrEvent;
};

export function amountFromInvoice(invoice: string) {
  try {
    return getSatoshisAmountFromBolt11(invoice);
  } catch {
    return 0;
  }
}

export function isLightningInvoice(value: string) {
  return /^(lnbc|lntb|lnbcrt)/i.test(value.trim());
}

/**
 * Ask a creator's LNURL-pay / zap endpoint for an invoice for a profile or note.
 * Signs a real kind-9734 zap request so wallets can publish a public receipt.
 */
export async function requestZapInvoice(input: {
  profile: Profile;
  amountSats: number;
  comment?: string;
  signer?: AppSigner | null;
  note?: NostrEvent | null;
}): Promise<ZapInvoice> {
  const { profile, amountSats } = input;
  if (!Number.isFinite(amountSats) || amountSats < 1) {
    throw new Error("Pick an amount of at least 1 sat.");
  }
  if (!profile.event) {
    throw new Error("We couldn't load this creator's Lightning profile yet.");
  }

  const callback = await getZapEndpoint(profile.event);
  if (!callback) {
    throw new Error(
      `${profile.displayName} hasn't enabled Lightning zaps yet. Ask them to add a Lightning address to their Nostr profile.`,
    );
  }

  const amountMsats = Math.round(amountSats * 1000);
  const relays = getRelayList();
  const template = input.note
    ? makeZapRequest({
        event: input.note,
        amount: amountMsats,
        comment: input.comment,
        relays,
      })
    : makeZapRequest({
        pubkey: profile.pubkey,
        amount: amountMsats,
        comment: input.comment,
        relays,
      });

  const zapRequest = input.signer ? await input.signer.signEvent(template) : null;
  if (zapRequest) {
    // Best-effort: don't block the payment if relays are slow.
    publishEvent(zapRequest).catch(() => undefined);
  }

  const url = new URL(callback);
  url.searchParams.set("amount", String(amountMsats));
  if (zapRequest) url.searchParams.set("nostr", JSON.stringify(zapRequest));

  const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error("The creator's Lightning server is unavailable right now.");
  }
  const body = (await response.json()) as { pr?: string; reason?: string; status?: string };
  if (!body.pr) {
    throw new Error(body.reason || "The creator's wallet didn't return an invoice.");
  }

  return {
    invoice: body.pr,
    amountSats: amountFromInvoice(body.pr) || amountSats,
    callback,
    zapRequest: zapRequest ?? undefined,
  };
}

type LnurlPayResponse = {
  callback?: string;
  minSendable?: number;
  maxSendable?: number;
  metadata?: string;
  tag?: string;
  allowsNostr?: boolean;
  status?: string;
  reason?: string;
};

function lightningAddressUrl(address: string) {
  const [name, domain] = address.split("@");
  if (!name || !domain || !domain.includes(".")) {
    throw new Error("That doesn't look like a Lightning address (name@domain).");
  }
  return `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`;
}

export type PaymentDetails = {
  invoice: string;
  /**
   * LUD-21 verification endpoint, when the wallet exposes one. Polling it lets
   * the app activate a purchase only after the payment has actually settled.
   */
  verifyUrl?: string;
};

/** Resolve a lightning address or LNURL into a payable BOLT-11 invoice. */
export async function requestPaymentDetails(
  destination: string,
  amountSats: number,
): Promise<PaymentDetails> {
  const trimmed = destination.trim();
  if (isLightningInvoice(trimmed)) return { invoice: trimmed };
  if (amountSats < 1) throw new Error("Enter an amount in sats.");

  let lnurlUrl: string;
  if (trimmed.toLowerCase().startsWith("lnurl1")) {
    // LNURL-pay links are bech32-encoded URLs; decode them before fetching.
    const { words } = bech32.decode(trimmed.toLowerCase() as `${string}1${string}`, 2000);
    lnurlUrl = new TextDecoder().decode(Uint8Array.from(bech32.fromWords(words)));
  } else {
    lnurlUrl = lightningAddressUrl(trimmed);
  }

  const metaResponse = await fetch(lnurlUrl);
  if (!metaResponse.ok) throw new Error("We couldn't find that Lightning address.");
  const meta = (await metaResponse.json()) as LnurlPayResponse;
  if (meta.status === "ERROR") {
    throw new Error(meta.reason || "That Lightning address isn't available right now.");
  }
  if (meta.tag && meta.tag !== "payRequest") {
    throw new Error("That Lightning address doesn't accept payments.");
  }
  if (!meta.callback) throw new Error("That Lightning address is misconfigured.");

  const amountMsats = Math.round(amountSats * 1000);
  if (meta.minSendable && amountMsats < meta.minSendable) {
    throw new Error(`Minimum is ${Math.ceil(meta.minSendable / 1000).toLocaleString()} sats.`);
  }
  if (meta.maxSendable && amountMsats > meta.maxSendable) {
    throw new Error(`Maximum is ${Math.floor(meta.maxSendable / 1000).toLocaleString()} sats.`);
  }

  const callback = new URL(meta.callback);
  callback.searchParams.set("amount", String(amountMsats));
  const invoiceResponse = await fetch(callback.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!invoiceResponse.ok) throw new Error("The wallet didn't return an invoice.");
  const invoiceBody = (await invoiceResponse.json()) as {
    pr?: string;
    reason?: string;
    verify?: string;
  };
  if (!invoiceBody.pr)
    throw new Error(invoiceBody.reason || "The wallet didn't return an invoice.");

  let verifyUrl: string | undefined;
  if (invoiceBody.verify) {
    try {
      const resolved = new URL(invoiceBody.verify, callback);
      if (resolved.protocol === "https:" || resolved.protocol === "http:") {
        verifyUrl = resolved.toString();
      }
    } catch {
      // A malformed verify URL just means no automatic confirmation.
    }
  }

  return { invoice: invoiceBody.pr, verifyUrl };
}

/** Resolve a lightning address or LNURL into a payable BOLT-11 invoice. */
export async function requestPaymentInvoice(
  destination: string,
  amountSats: number,
): Promise<string> {
  return (await requestPaymentDetails(destination, amountSats)).invoice;
}
