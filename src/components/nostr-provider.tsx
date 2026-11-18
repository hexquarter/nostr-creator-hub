import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  generateSecretKey,
  getPublicKey,
  nip19,
  type EventTemplate,
  type NostrEvent,
} from "nostr-tools";
import {
  BunkerSigner,
  createNostrConnectURI,
  parseBunkerInput,
  toBunkerURL,
} from "nostr-tools/nip46";
import { bytesToHex, hexToBytes } from "@/lib/crypto";
import { getRelayList, pool, publishEvent, warmRelays } from "@/lib/nostr/relays";
import {
  emptyProfile,
  fetchProfile,
  profileMetadataTemplate,
  pubkeyToNpub,
  type Profile,
} from "@/lib/nostr/profiles";
import {
  bookmarkIds,
  fetchBookmarkList,
  publishNote,
  publishReaction,
  publishRepost,
  toggleBookmark as toggleBookmarkEvent,
  updateFollows,
  fetchFollows,
  type FeedNote,
  type FollowState,
  type PublishNoteInput,
} from "@/lib/nostr/social";
import {
  getNip07Provider,
  LocalSigner,
  Nip07Signer,
  wrapRemoteSigner,
  type AppSigner,
} from "@/lib/nostr/signer";
import {
  clearSession,
  loadSession,
  saveSession,
  loadWalletConnection,
  saveWalletConnection,
  clearWalletConnection,
  type StoredSession,
} from "@/lib/nostr/session";
import { createPasskeyIdentity, unlockPasskeyIdentity } from "@/lib/nostr/passkey";
import { randomHex } from "@/lib/nostr/signer";
import { uploadBlob, uploadFile as uploadFileToBlossom } from "@/lib/nostr/blossom";
import { fetchDirectMessages, sendDirectMessage, type DirectMessage } from "@/lib/nostr/dm";
import { NwcClient, type NwcTransaction } from "@/lib/nostr/nwc";
import {
  lightningAddressFor,
  lightningAddressSource,
  type LightningAddressSource,
} from "@/lib/nostr/lightning";
import { requestZapInvoice } from "@/lib/nostr/zaps";
import { syncCreatorBadges } from "@/lib/nostr/badges";

export type NostrAuthMethod = "passkey" | "nsec" | "bunker" | "nostr-connect" | "nip07";

export type NostrAccount = {
  pubkey: string;
  npub: string;
  method: NostrAuthMethod;
  profile: Profile;
  prfBacked: boolean;
  canExportKey: boolean;
};

export type WalletState = {
  connected: boolean;
  loading: boolean;
  alias?: string;
  network?: string;
  balanceSats: number | null;
  /**
   * Lightning address derived from the Nostr identity: the profile's
   * lud16/lud06 when present, otherwise the account's npub.cash address.
   */
  address?: string;
  addressSource?: LightningAddressSource;
  error?: string;
};

type ConnectResult = { prfBacked: boolean };

type NostrContextValue = {
  account: NostrAccount | null;
  restoring: boolean;
  wallet: WalletState;
  following: string[];
  bookmarks: string[];

  signInWithNsec: (input: string) => Promise<void>;
  createLocalAccount: () => Promise<ConnectResult>;
  signInWithPasskey: (mode: "signin" | "create", displayName?: string) => Promise<ConnectResult>;
  signInWithNip07: () => Promise<void>;
  signInWithBunker: (uri: string) => Promise<void>;
  startNostrConnect: () => { uri: string; wait: () => Promise<ConnectResult> };
  signOut: () => void;

  exportNsec: () => string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;

  publish: (input: PublishNoteInput) => Promise<NostrEvent>;
  /** Sign and publish any event template (profile, badge proof, …). */
  signAndPublish: (template: EventTemplate) => Promise<NostrEvent>;
  uploadMedia: (bytes: Uint8Array, mime: string) => Promise<string>;
  uploadFile: (file: File) => Promise<string>;
  react: (target: NostrEvent, content?: string) => Promise<void>;
  repost: (target: NostrEvent) => Promise<void>;
  toggleBookmark: (target: NostrEvent) => Promise<boolean>;
  isFollowing: (pubkey: string) => boolean;
  toggleFollow: (pubkey: string) => Promise<boolean>;

  connectWallet: (uri: string) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  refreshBalance: () => Promise<number | null>;
  listTransactions: () => Promise<NwcTransaction[]>;
  fetchDMs: () => Promise<DirectMessage[]>;
  sendDM: (recipient: string, text: string) => Promise<void>;
  payInvoice: (invoice: string) => Promise<{ preimage?: string }>;
  makeInvoice: (amountSats: number, memo?: string) => Promise<{ invoice: string }>;
  zap: (input: {
    profile: Profile;
    amountSats: number;
    comment?: string;
    note?: NostrEvent | null;
  }) => Promise<{ preimage?: string; invoice: string }>;
};

const NostrContext = createContext<NostrContextValue | null>(null);

export function useNostr() {
  const ctx = useContext(NostrContext);
  if (!ctx) throw new Error("useNostr must be used within NostrProvider");
  return ctx;
}

const EMPTY_WALLET: WalletState = {
  connected: false,
  loading: false,
  balanceSats: null,
};

function accountFrom(
  pubkey: string,
  method: NostrAuthMethod,
  profile: Profile,
  prfBacked = false,
): NostrAccount {
  return {
    pubkey,
    npub: pubkeyToNpub(pubkey),
    method,
    profile,
    prfBacked,
    canExportKey: method === "passkey" || method === "nsec",
  };
}

export function NostrProvider({ children }: { children: ReactNode }) {
  const signerRef = useRef<AppSigner | null>(null);
  const walletRef = useRef<NwcClient | null>(null);
  const followsRef = useRef<FollowState>({ pubkeys: [], event: null });
  const restoreAttempted = useRef(false);

  const [account, setAccount] = useState<NostrAccount | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [wallet, setWallet] = useState<WalletState>(EMPTY_WALLET);
  const [following, setFollowing] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);

  const applyAccount = useCallback(
    async (pubkey: string, method: NostrAuthMethod, prfBacked = false) => {
      const base = emptyProfile(pubkey);
      setAccount(accountFrom(pubkey, method, base, prfBacked));
      try {
        const profile = await fetchProfile(pubkey);
        setAccount((current) =>
          current && current.pubkey === pubkey ? { ...current, profile } : current,
        );
      } catch {
        // keep the npub placeholder if relays are unreachable
      }
    },
    [],
  );

  const loadSocialState = useCallback(async (pubkey: string) => {
    try {
      const follows = await fetchFollows(pubkey);
      followsRef.current = follows;
      setFollowing(follows.pubkeys);
    } catch {
      followsRef.current = { pubkeys: [], event: null };
      setFollowing([]);
    }
    try {
      const list = await fetchBookmarkList(pubkey);
      setBookmarks(bookmarkIds(list));
    } catch {
      setBookmarks([]);
    }
    // Badge purchases are signed events, so a membership follows the account
    // to any device even though the local cache starts empty.
    void syncCreatorBadges(pubkey).catch(() => undefined);
  }, []);

  // Restore a previous session from encrypted local storage.
  useEffect(() => {
    if (restoreAttempted.current) return;
    restoreAttempted.current = true;
    // Start the relay handshakes immediately so the first feed query doesn't
    // pay for them while the user is already looking at the page.
    warmRelays();
    let cancelled = false;

    void (async () => {
      try {
        const stored = await loadSession();
        if (!stored || cancelled) return;

        if (stored.method === "nsec" || stored.method === "passkey") {
          if (!stored.nsec) return;
          const signer = new LocalSigner(hexToBytes(stored.nsec));
          const pubkey = await signer.getPublicKey();
          if (pubkey !== stored.pubkey) return;
          signerRef.current = signer;
          await applyAccount(pubkey, stored.method, stored.prfBacked);
          void loadSocialState(pubkey);
        } else if (stored.method === "nip07") {
          const provider = getNip07Provider();
          if (!provider) return;
          const signer = new Nip07Signer(provider);
          const pubkey = await signer.getPublicKey();
          if (pubkey !== stored.pubkey) return;
          signerRef.current = signer;
          await applyAccount(pubkey, "nip07");
          void loadSocialState(pubkey);
        } else if (stored.method === "bunker" || stored.method === "nostr-connect") {
          if (!stored.bunkerUri || !stored.clientSecret) return;
          const pointer = await parseBunkerInput(stored.bunkerUri);
          if (!pointer) return;
          const remote = BunkerSigner.fromBunker(hexToBytes(stored.clientSecret), pointer, {
            pool,
          });
          signerRef.current = wrapRemoteSigner(remote);
          await applyAccount(stored.pubkey, stored.method);
          void loadSocialState(stored.pubkey);
        }
      } catch {
        // a broken session should never block the app
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyAccount, loadSocialState]);

  // Restore Lightning wallet connection.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const uri = await loadWalletConnection();
      if (!uri || cancelled) return;
      setWallet((w) => ({ ...w, loading: true }));
      try {
        const client = new NwcClient(uri);
        walletRef.current = client;
        const [info, balance] = await Promise.allSettled([client.getInfo(), client.getBalance()]);
        if (cancelled) return;
        if (info.status === "rejected" && balance.status === "rejected") {
          throw info.reason instanceof Error ? info.reason : new Error("Wallet didn't respond");
        }
        setWallet((w) => ({
          connected: true,
          loading: false,
          alias: info.status === "fulfilled" ? info.value.alias : undefined,
          network: info.status === "fulfilled" ? info.value.network : undefined,
          balanceSats: balance.status === "fulfilled" ? balance.value : null,
          address: w.address,
          addressSource: w.addressSource,
        }));
      } catch (error) {
        if (cancelled) return;
        setWallet((w) => ({
          ...EMPTY_WALLET,
          address: w.address,
          addressSource: w.addressSource,
          error: error instanceof Error ? error.message : "Couldn't reconnect your wallet.",
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The Lightning address is derived from the Nostr identity at login, so
  // receiving works without connecting a separate wallet. Profiles without a
  // lud16/lud06 fall back to the account's npub.cash address.
  useEffect(() => {
    if (!account) {
      setWallet((w) =>
        w.address === undefined && w.addressSource === undefined
          ? w
          : { ...w, address: undefined, addressSource: undefined },
      );
      return;
    }
    const address = lightningAddressFor(account.pubkey, account.profile);
    const addressSource = lightningAddressSource(account.profile);
    setWallet((w) =>
      w.address === address && w.addressSource === addressSource
        ? w
        : { ...w, address, addressSource },
    );
  }, [account]);

  const finishSignIn = useCallback(
    async (stored: StoredSession, signer: AppSigner, prfBacked = false) => {
      signerRef.current = signer;
      await saveSession(stored);
      await applyAccount(stored.pubkey, stored.method, prfBacked);
      void loadSocialState(stored.pubkey);
    },
    [applyAccount, loadSocialState],
  );

  const signInWithNsec = useCallback(
    async (input: string) => {
      const value = input.trim();
      let secretKey: Uint8Array;
      if (value.startsWith("nsec1")) {
        const decoded = nip19.decode(value);
        if (decoded.type !== "nsec") throw new Error("That isn't a valid nsec key.");
        secretKey = decoded.data;
      } else if (/^[0-9a-f]{64}$/i.test(value)) {
        secretKey = hexToBytes(value.toLowerCase());
      } else {
        throw new Error("Paste an nsec1… key or a 64-character hex key.");
      }
      const signer = new LocalSigner(secretKey);
      const pubkey = await signer.getPublicKey();
      await finishSignIn({ v: 1, method: "nsec", pubkey, nsec: bytesToHex(secretKey) }, signer);
    },
    [finishSignIn],
  );

  const createLocalAccount = useCallback(async () => {
    const secretKey = generateSecretKey();
    const signer = new LocalSigner(secretKey);
    const pubkey = getPublicKey(secretKey);
    await finishSignIn({ v: 1, method: "nsec", pubkey, nsec: bytesToHex(secretKey) }, signer);
    return { prfBacked: false };
  }, [finishSignIn]);

  const signInWithPasskey = useCallback(
    async (mode: "signin" | "create", displayName?: string) => {
      const identity =
        mode === "create"
          ? await createPasskeyIdentity(displayName?.trim() || "Crays creator")
          : await unlockPasskeyIdentity();
      const signer = new LocalSigner(identity.secretKey);
      await finishSignIn(
        {
          v: 1,
          method: "passkey",
          pubkey: identity.pubkey,
          nsec: bytesToHex(identity.secretKey),
          prfBacked: identity.prfBacked,
        },
        signer,
        identity.prfBacked,
      );
      return { prfBacked: identity.prfBacked };
    },
    [finishSignIn],
  );

  const signInWithNip07 = useCallback(async () => {
    const provider = getNip07Provider();
    if (!provider) {
      throw new Error("No Nostr extension found. Install Alby or nos2x, then try again.");
    }
    const signer = new Nip07Signer(provider);
    const pubkey = await signer.getPublicKey();
    await finishSignIn({ v: 1, method: "nip07", pubkey }, signer);
  }, [finishSignIn]);

  const signInWithBunker = useCallback(
    async (uri: string) => {
      const pointer = await parseBunkerInput(uri.trim());
      if (!pointer)
        throw new Error("That bunker link isn't valid. Ask your signer for a fresh one.");
      const clientSecret = generateSecretKey();
      const remote = BunkerSigner.fromBunker(clientSecret, pointer, { pool });
      await remote.connect({ name: "Crays", url: window.location.origin });
      const pubkey = await remote.getPublicKey();
      const signer = wrapRemoteSigner(remote);
      await finishSignIn(
        {
          v: 1,
          method: "bunker",
          pubkey,
          bunkerUri: toBunkerURL(remote.bp),
          clientSecret: bytesToHex(clientSecret),
        },
        signer,
      );
    },
    [finishSignIn],
  );

  const startNostrConnect = useCallback(() => {
    const clientSecret = generateSecretKey();
    const clientPubkey = getPublicKey(clientSecret);
    const secret = randomHex(16);
    const uri = createNostrConnectURI({
      clientPubkey,
      relays: getRelayList(),
      secret,
      name: "Crays",
      url: window.location.origin,
      image: `${window.location.origin}/favicon.ico`,
      perms: [
        "get_public_key",
        "sign_event:0",
        "sign_event:1",
        "sign_event:3",
        "sign_event:6",
        "sign_event:7",
        "sign_event:9734",
        "sign_event:10003",
        "sign_event:30023",
        "sign_event:30078",
        "nip04_encrypt",
        "nip04_decrypt",
        "nip44_encrypt",
        "nip44_decrypt",
      ],
    });

    const wait = async (): Promise<ConnectResult> => {
      const remote = await BunkerSigner.fromURI(clientSecret, uri, { pool }, 5 * 60 * 1000);
      const pubkey = await remote.getPublicKey();
      const signer = wrapRemoteSigner(remote);
      await finishSignIn(
        {
          v: 1,
          method: "nostr-connect",
          pubkey,
          bunkerUri: toBunkerURL(remote.bp),
          clientSecret: bytesToHex(clientSecret),
        },
        signer,
      );
      return { prfBacked: false };
    };

    return { uri, wait };
  }, [finishSignIn]);

  const signOut = useCallback(() => {
    const signer = signerRef.current;
    signerRef.current = null;
    Promise.resolve(signer?.close?.()).catch(() => undefined);
    clearSession();
    setAccount(null);
    setFollowing([]);
    setBookmarks([]);
    followsRef.current = { pubkeys: [], event: null };
  }, []);

  const requireSigner = useCallback(() => {
    const signer = signerRef.current;
    if (!signer) throw new Error("Sign in first.");
    return signer;
  }, []);

  const exportNsec = useCallback(() => {
    const signer = signerRef.current;
    if (!signer || !(signer instanceof LocalSigner)) return null;
    return nip19.nsecEncode(signer.secretKey);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!account) return;
    const profile = await fetchProfile(account.pubkey);
    setAccount((current) => (current ? { ...current, profile } : current));
  }, [account]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!account) throw new Error("Sign in first.");
      const signer = requireSigner();
      const merged = { ...account.profile, ...patch };
      const event = await signer.signEvent({
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        content: profileMetadataTemplate(merged),
        tags: [],
      });
      await publishEvent(event);
      await refreshProfile();
    },
    [account, refreshProfile, requireSigner],
  );

  const publish = useCallback(
    async (input: PublishNoteInput) => publishNote(requireSigner(), input),
    [requireSigner],
  );

  const signAndPublish = useCallback(
    async (template: EventTemplate) => {
      const event = await requireSigner().signEvent(template);
      await publishEvent(event);
      return event;
    },
    [requireSigner],
  );

  const uploadMedia = useCallback(
    async (bytes: Uint8Array, mime: string) => {
      const result = await uploadBlob(bytes, mime, requireSigner());
      return result.url;
    },
    [requireSigner],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const result = await uploadFileToBlossom(file, requireSigner());
      return result.url;
    },
    [requireSigner],
  );

  const react = useCallback(
    async (target: NostrEvent, content = "+") => {
      await publishReaction(requireSigner(), target, content);
    },
    [requireSigner],
  );

  const repost = useCallback(
    async (target: NostrEvent) => {
      await publishRepost(requireSigner(), target);
    },
    [requireSigner],
  );

  const toggleBookmark = useCallback(
    async (target: NostrEvent) => {
      if (!account) throw new Error("Sign in first.");
      const result = await toggleBookmarkEvent(requireSigner(), account.pubkey, target);
      setBookmarks(result.ids);
      return result.bookmarked;
    },
    [account, requireSigner],
  );

  const isFollowing = useCallback((pubkey: string) => following.includes(pubkey), [following]);

  const toggleFollow = useCallback(
    async (pubkey: string) => {
      if (!account) throw new Error("Sign in first.");
      const next = await updateFollows(
        requireSigner(),
        followsRef.current,
        pubkey,
        !followsRef.current.pubkeys.includes(pubkey),
      );
      followsRef.current = next;
      setFollowing(next.pubkeys);
      return next.pubkeys.includes(pubkey);
    },
    [account, requireSigner],
  );

  const connectWallet = useCallback(async (uri: string) => {
    setWallet((w) => ({ ...w, loading: true, error: undefined }));
    try {
      const client = new NwcClient(uri);
      const [info, balance] = await Promise.allSettled([client.getInfo(), client.getBalance()]);
      if (info.status === "rejected" && balance.status === "rejected") {
        throw info.reason instanceof Error ? info.reason : new Error("Your wallet didn't respond.");
      }
      walletRef.current = client;
      await saveWalletConnection(uri);
      setWallet((w) => ({
        connected: true,
        loading: false,
        alias: info.status === "fulfilled" ? info.value.alias : undefined,
        network: info.status === "fulfilled" ? info.value.network : undefined,
        balanceSats: balance.status === "fulfilled" ? balance.value : null,
        address: w.address,
        addressSource: w.addressSource,
      }));
    } catch (error) {
      setWallet((w) => ({
        ...EMPTY_WALLET,
        address: w.address,
        addressSource: w.addressSource,
        error: error instanceof Error ? error.message : "Couldn't connect that wallet.",
      }));
      throw error;
    }
  }, []);

  const disconnectWallet = useCallback(async () => {
    walletRef.current = null;
    clearWalletConnection();
    setWallet((w) => ({
      ...EMPTY_WALLET,
      address: w.address,
      addressSource: w.addressSource,
    }));
  }, []);

  const refreshBalance = useCallback(async () => {
    const client = walletRef.current;
    if (!client) return null;
    try {
      const balance = await client.getBalance();
      setWallet((w) => ({ ...w, connected: true, balanceSats: balance, error: undefined }));
      return balance;
    } catch (error) {
      setWallet((w) => ({
        ...w,
        error: error instanceof Error ? error.message : "Couldn't refresh balance.",
      }));
      return null;
    }
  }, []);

  const listTransactions = useCallback(async () => {
    const client = walletRef.current;
    if (!client) return [];
    try {
      return await client.listTransactions();
    } catch {
      return [];
    }
  }, []);

  const fetchDMs = useCallback(async () => {
    const signer = requireSigner();
    const pubkey = await signer.getPublicKey();
    return fetchDirectMessages(signer, pubkey);
  }, [requireSigner]);

  const sendDM = useCallback(
    async (recipient: string, text: string) => {
      await sendDirectMessage(requireSigner(), recipient, text);
    },
    [requireSigner],
  );

  const payInvoice = useCallback(
    async (invoice: string) => {
      const client = walletRef.current;
      if (!client) throw new Error("Connect a Lightning wallet first.");
      const result = await client.payInvoice(invoice);
      void refreshBalance();
      return { preimage: result.preimage };
    },
    [refreshBalance],
  );

  const makeInvoice = useCallback(async (amountSats: number, memo?: string) => {
    const client = walletRef.current;
    if (!client) throw new Error("Connect a Lightning wallet first.");
    const result = await client.makeInvoice(amountSats, memo);
    return { invoice: result.invoice };
  }, []);

  const zap = useCallback(
    async (input: {
      profile: Profile;
      amountSats: number;
      comment?: string;
      note?: NostrEvent | null;
    }) => {
      const client = walletRef.current;
      if (!client) throw new Error("Connect a Lightning wallet first.");
      const invoice = await requestZapInvoice({
        ...input,
        signer: signerRef.current,
      });
      const payment = await client.payInvoice(invoice.invoice);
      void refreshBalance();
      return { preimage: payment.preimage, invoice: invoice.invoice };
    },
    [refreshBalance],
  );

  const value = useMemo<NostrContextValue>(
    () => ({
      account,
      restoring,
      wallet,
      following,
      bookmarks,
      signInWithNsec,
      createLocalAccount,
      signInWithPasskey,
      signInWithNip07,
      signInWithBunker,
      startNostrConnect,
      signOut,
      exportNsec,
      refreshProfile,
      updateProfile,
      publish,
      signAndPublish,
      uploadMedia,
      uploadFile,
      react,
      repost,
      toggleBookmark,
      isFollowing,
      toggleFollow,
      connectWallet,
      disconnectWallet,
      refreshBalance,
      listTransactions,
      fetchDMs,
      sendDM,
      payInvoice,
      makeInvoice,
      zap,
    }),
    [
      account,
      restoring,
      wallet,
      following,
      bookmarks,
      signInWithNsec,
      createLocalAccount,
      signInWithPasskey,
      signInWithNip07,
      signInWithBunker,
      startNostrConnect,
      signOut,
      exportNsec,
      refreshProfile,
      updateProfile,
      publish,
      signAndPublish,
      uploadMedia,
      uploadFile,
      react,
      repost,
      toggleBookmark,
      isFollowing,
      toggleFollow,
      connectWallet,
      disconnectWallet,
      refreshBalance,
      listTransactions,
      fetchDMs,
      sendDM,
      payInvoice,
      makeInvoice,
      zap,
    ],
  );

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>;
}

export type { FeedNote };
