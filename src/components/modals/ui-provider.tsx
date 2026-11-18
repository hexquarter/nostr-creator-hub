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
import { QRCodeSVG } from "qrcode.react";
import type { NostrEvent } from "nostr-tools";
import { useNostr } from "@/components/nostr-provider";
import type { Profile } from "@/lib/nostr/profiles";
import {
  fetchProfile,
  normalizePubkey,
  parseProfilePointer,
  pubkeyToNpub,
  shortNpub,
} from "@/lib/nostr/profiles";
import { addRelay, getCustomRelays, removeRelay } from "@/lib/nostr/relays";
import {
  BADGE_DAYS,
  DEFAULT_BADGE_SATS,
  announceCreatorBadge,
  announcePostUnlock,
  daysLeft,
  fetchCreatorMembers,
  grantCreatorBadge,
  grantPostUnlock,
  isBadgeActive,
  useCreatorBadges,
  usePostUnlocks,
} from "@/lib/nostr/badges";
import { lightningAddressFor } from "@/lib/nostr/lightning";
import {
  CREATOR_PASS_ADDRESS,
  CREATOR_PASS_CONFIGURED,
  CREATOR_PASS_DAYS,
  CREATOR_PASS_USD,
  activateCreatorPass,
  cardOnramps,
  creatorPassDaysLeft,
  isCreatorPassActive,
  useCreatorPass,
  type CardOnramp,
} from "@/lib/nostr/creator-pass";
import { hasPasskey, hasWebAuthn } from "@/lib/nostr/passkey";
import { useBtcPrice, satsToUsd, usdToSats, formatUsd } from "@/lib/nostr/price";
import { isLightningInvoice, requestPaymentDetails, requestPaymentInvoice } from "@/lib/nostr/zaps";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { AvatarTile } from "@/components/avatar-tile";
import {
  Zap,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Coins,
  Crown,
  Sparkles,
  Image as ImageIcon,
  BarChart3,
  FileText,
  Mic,
  Copy,
  Check,
  Server,
  Plus,
  Eye,
  EyeOff,
  Share2,
  Link as LinkIcon,
  X,
  Home,
  Compass,
  Users,
  MessageCircle,
  Bell,
  Bookmark,
  Wallet,
  User,
  Settings as Cog,
  Fingerprint,
  KeyRound,
  Radio,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Lock,
  Loader2,
  Pencil,
  LogIn,
  ChevronDown,
  ChevronLeft,
  Puzzle,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

// ---------- Types ----------
type ZapOptions = {
  recipient?: string;
  postTitle?: string;
  pubkey?: string;
  profile?: Profile;
  note?: NostrEvent;
};
type BadgeOptions = {
  creator?: string;
  name?: string;
  /** Monthly membership price, in sats per 30 days. */
  sats?: number;
  /** Set when the reader opened this from one specific members-only post. */
  postId?: string;
  postSats?: number;
  mode?: "subscribe" | "post";
};
type ShareOptions = { url?: string; title?: string };
type ComposeOptions = {
  mode?: "post" | "article" | "poll" | "reply";
  replyTo?: string;
  replyToEvent?: NostrEvent;
};
type TxDetail = {
  id: string;
  who: string;
  note: string;
  amount: string;
  usd: string;
  time: string;
  kind: "in" | "out";
};

export type AuthMethod = "passkey" | "bunker" | "nostr-connect" | "nip07" | "nsec";
export type AuthUser = {
  name: string;
  handle: string;
  npub: string;
  method: AuthMethod;
  pubkey?: string;
  picture?: string;
};
type AuthOptions = { intent?: string };

type UICtx = {
  user: AuthUser | null;
  signOut: () => void;
  requireAuth: (intent: string, cb?: () => void) => boolean;
  openAuth: (o?: AuthOptions) => void;

  openZap: (o?: ZapOptions) => void;
  openCompose: (o?: ComposeOptions) => void;
  openBadge: (o?: BadgeOptions) => void;
  openShare: (o?: ShareOptions) => void;
  openUpgrade: () => void;
  openSend: () => void;
  openReceive: () => void;
  openTopUp: () => void;
  openTxDetail: (tx: TxDetail) => void;
  openEditProfile: () => void;
  openLinkBlock: (existing?: { title: string; url: string } | null) => void;
  openNewDM: () => void;
  openAddRelay: () => void;
  openRevealKey: () => void;
  openLogoutConfirm: () => void;
  openCommandPalette: () => void;
  openImagePicker: () => void;
  openPollBuilder: () => void;
};

const UIContext = createContext<UICtx | null>(null);

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}

// ---------- Provider ----------
export function UIProvider({ children }: { children: ReactNode }) {
  const { account, signOut: nostrSignOut } = useNostr();
  const [auth, setAuth] = useState<AuthOptions | null>(null);

  const [zap, setZap] = useState<ZapOptions | null>(null);
  const [compose, setCompose] = useState<ComposeOptions | null>(null);
  const [badge, setBadge] = useState<BadgeOptions | null>(null);
  const [share, setShare] = useState<ShareOptions | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [send, setSend] = useState(false);
  const [receive, setReceive] = useState(false);
  const [topup, setTopup] = useState(false);
  const [tx, setTx] = useState<TxDetail | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [linkBlock, setLinkBlock] = useState<{ title: string; url: string } | null | false>(false);
  const [newDM, setNewDM] = useState(false);
  const [addRelay, setAddRelay] = useState(false);
  const [revealKey, setRevealKey] = useState(false);
  const [logout, setLogout] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [imagePicker, setImagePicker] = useState(false);
  const [pollBuilder, setPollBuilder] = useState(false);

  const user = useMemo<AuthUser | null>(() => {
    if (!account) return null;
    const profile = account.profile;
    return {
      name: profile.displayName || profile.name,
      handle: profile.handle,
      npub: account.npub,
      method: account.method,
      pubkey: account.pubkey,
      picture: profile.picture,
    };
  }, [account]);

  const signOut = useCallback(() => {
    nostrSignOut();
    toast.success("Signed out");
  }, [nostrSignOut]);

  const value = useMemo<UICtx>(() => {
    const gate = (intent: string, run: () => void) => {
      if (user) {
        run();
        return true;
      }
      setAuth({ intent });
      return false;
    };
    return {
      user,
      signOut,
      requireAuth: (intent, cb) => gate(intent, () => cb?.()),
      openAuth: (o) => setAuth(o ?? {}),

      openZap: (o) => gate("send a zap", () => setZap(o ?? {})),
      openCompose: (o) => gate("post to Nostr", () => setCompose(o ?? { mode: "post" })),
      openBadge: (o) => gate("get a creator badge", () => setBadge(o ?? {})),
      openShare: (o) => setShare(o ?? {}),
      openUpgrade: () => gate("become a Creator", () => setUpgrade(true)),
      openSend: () => gate("send sats", () => setSend(true)),
      openReceive: () => gate("receive sats", () => setReceive(true)),
      openTopUp: () => gate("top up your wallet", () => setTopup(true)),
      openTxDetail: (t) => setTx(t),
      openEditProfile: () => gate("edit your profile", () => setEditProfile(true)),
      openLinkBlock: (e) => gate("edit your link-in-bio", () => setLinkBlock(e ?? null)),
      openNewDM: () => gate("start a chat", () => setNewDM(true)),
      openAddRelay: () => gate("add a relay", () => setAddRelay(true)),
      openRevealKey: () => gate("reveal your key", () => setRevealKey(true)),
      openLogoutConfirm: () => setLogout(true),
      openCommandPalette: () => setCmd(true),
      openImagePicker: () => gate("attach media", () => setImagePicker(true)),
      openPollBuilder: () => gate("create a poll", () => setPollBuilder(true)),
    };
  }, [user, signOut]);

  // Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <UIContext.Provider value={value}>
      {children}

      <ZapModal open={!!zap} onClose={() => setZap(null)} options={zap ?? {}} />
      <ComposeModal
        open={!!compose}
        onClose={() => setCompose(null)}
        options={compose ?? { mode: "post" }}
      />
      <BadgeModal open={!!badge} onClose={() => setBadge(null)} options={badge ?? {}} />
      <ShareModal open={!!share} onClose={() => setShare(null)} options={share ?? {}} />
      <UpgradeModal open={upgrade} onClose={() => setUpgrade(false)} />
      <SendModal open={send} onClose={() => setSend(false)} />
      <ReceiveModal open={receive} onClose={() => setReceive(false)} />
      <TopUpModal open={topup} onClose={() => setTopup(false)} />
      <TxDetailSheet tx={tx} onClose={() => setTx(null)} />
      <EditProfileModal open={editProfile} onClose={() => setEditProfile(false)} />
      <LinkBlockModal
        open={linkBlock !== false}
        existing={linkBlock || null}
        onClose={() => setLinkBlock(false)}
      />
      <NewDMModal open={newDM} onClose={() => setNewDM(false)} />
      <AddRelayModal open={addRelay} onClose={() => setAddRelay(false)} />
      <RevealKeyModal open={revealKey} onClose={() => setRevealKey(false)} />
      <LogoutConfirm open={logout} onClose={() => setLogout(false)} onConfirm={signOut} />
      <CommandPalette open={cmd} onOpenChange={setCmd} />
      <ImagePickerModal open={imagePicker} onClose={() => setImagePicker(false)} />
      <PollBuilderModal open={pollBuilder} onClose={() => setPollBuilder(false)} />
      <AuthModal
        open={!!auth}
        options={auth ?? {}}
        onClose={() => setAuth(null)}
        onSignedIn={() => setAuth(null)}
      />
    </UIContext.Provider>
  );
}

// ---------- Building blocks ----------
function PrimaryBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50 ${p.className ?? ""}`}
    >
      {children}
    </button>
  );
}
function GhostBtn({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-2.5 text-[13px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-200 ${p.className ?? ""}`}
    >
      {children}
    </button>
  );
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}
const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// ---------- Zap ----------
function ZapModal({
  open,
  onClose,
  options,
}: {
  open: boolean;
  onClose: () => void;
  options: ZapOptions;
}) {
  const nostr = useNostr();
  const price = useBtcPrice();
  const presets = [21, 100, 500, 1000, 5000, 21000];
  const [amount, setAmount] = useState(500);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(options.profile ?? null);
  const [nwcUri, setNwcUri] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(500);
    setNote("");
    setBusy(false);
    setNwcUri("");
    setProfile(options.profile ?? null);
    if (!options.profile && options.pubkey) {
      fetchProfile(options.pubkey)
        .then((next) => setProfile(next))
        .catch(() => undefined);
    }
  }, [open, options.profile, options.pubkey]);

  const usd = formatUsd(satsToUsd(amount, price));

  const connect = async () => {
    setConnecting(true);
    try {
      await nostr.connectWallet(nwcUri);
      toast.success("Lightning wallet connected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't connect that wallet.");
    } finally {
      setConnecting(false);
    }
  };

  const send = async () => {
    if (!profile) {
      toast.error("Open the creator's profile to zap them.");
      return;
    }
    if (!nostr.wallet.connected) {
      toast.error("Connect a Lightning wallet first.");
      return;
    }
    setBusy(true);
    try {
      await nostr.zap({
        profile,
        amountSats: amount,
        comment: note.trim() || undefined,
        note: options.note ?? null,
      });
      toast.success(`Zapped ${amount.toLocaleString()} sats ⚡`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The zap didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <Zap className="size-4" />
            </span>
            Send a zap
          </DialogTitle>
          <DialogDescription>
            {profile
              ? `To ${profile.displayName}${profile.lud16 ? ` · ${profile.lud16}` : ""}`
              : options.recipient
                ? `To ${options.recipient}`
                : "Reward great content with sats."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center ring-1 ring-amber-100">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">
              Amount
            </p>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
                className="w-32 bg-transparent text-center text-[36px] font-bold tracking-tight text-zinc-900 outline-none"
              />
              <span className="text-[13px] font-medium text-zinc-500">sats</span>
            </div>
            <p className="text-[11.5px] text-zinc-500">≈ {usd} USD</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`rounded-lg py-2 text-[12px] font-semibold ring-1 transition-colors ${
                  amount === p
                    ? "bg-zinc-900 text-white ring-zinc-900"
                    : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>
          <Field label="Message (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Great post!"
              className={inputCls}
            />
          </Field>

          {!nostr.wallet.connected && (
            <div className="space-y-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <p className="text-[12px] font-semibold text-zinc-800">Connect a Lightning wallet</p>
              <p className="text-[11.5px] text-zinc-500">
                Paste a Nostr Wallet Connect string from Alby, Zeus, Primal or your node.
              </p>
              <input
                value={nwcUri}
                onChange={(e) => setNwcUri(e.target.value)}
                placeholder="nostr+walletconnect://…"
                className={`${inputCls} font-mono text-[11px]`}
              />
              <GhostBtn
                className="w-full"
                disabled={!nwcUri.trim() || connecting || nostr.wallet.loading}
                onClick={connect}
              >
                {connecting || nostr.wallet.loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Connect wallet"
                )}
              </GhostBtn>
              {nostr.wallet.error && (
                <p className="text-[11px] text-rose-600">{nostr.wallet.error}</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            className="!bg-amber-500 hover:!bg-amber-600"
            disabled={busy || !profile || !nostr.wallet.connected}
            onClick={send}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {busy ? "Sending…" : "Send zap"}
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Compose ----------
const SENSITIVE_REASONS = ["Nudity", "Graphic", "Violence", "Language", "Other"] as const;
type SensitiveReason = (typeof SENSITIVE_REASONS)[number];

function ToggleRow({
  icon,
  title,
  hint,
  on,
  onToggle,
  tone,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
  tone: "amber" | "rose";
}) {
  const bg = tone === "amber" ? "bg-amber-50 ring-amber-100" : "bg-rose-50 ring-rose-100";
  const knob = tone === "amber" ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 ring-1 ${bg}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-zinc-900">{title}</p>
          <p className="text-[11.5px] text-zinc-500">{hint}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={onToggle}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? knob : "bg-zinc-300"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`}
        />
      </button>
    </div>
  );
}

function ComposeModal({
  open,
  onClose,
  options,
}: {
  open: boolean;
  onClose: () => void;
  options: ComposeOptions;
}) {
  const nostr = useNostr();
  const ui = useUI();
  const creatorPass = useCreatorPass();
  const canPublishPremium = isCreatorPassActive(creatorPass);
  const [tab, setTab] = useState<"post" | "article" | "poll">(
    options.mode === "article" ? "article" : options.mode === "poll" ? "poll" : "post",
  );
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pollOptions, setPollOptions] = useState(["", "", ""]);
  const [premium, setPremium] = useState(false);
  const [price, setPrice] = useState(500);
  const [unlockPrice, setUnlockPrice] = useState(200);
  const [sensitive, setSensitive] = useState(false);
  const [reason, setReason] = useState<SensitiveReason>("Nudity");
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(options.mode === "article" ? "article" : options.mode === "poll" ? "poll" : "post");
      setTitle("");
      setText("");
      setPollOptions(["", "", ""]);
      setPremium(false);
      setPrice(500);
      setUnlockPrice(200);
      setSensitive(false);
      setReason("Nudity");
      setWarning("");
      setBusy(false);
    }
  }, [open, options.mode]);

  const publish = async () => {
    if (!text.trim()) {
      toast.error("Write something first.");
      return;
    }
    setBusy(true);
    try {
      const tags: string[][] = [];
      // Selling memberships is a Crays creator-badge feature; never tag a post
      // as members-only without it.
      if (premium && canPublishPremium) {
        tags.push(["premium", String(price)]);
        tags.push(["premium-unlock", String(unlockPrice)]);
      }
      if (tab === "article") {
        const d = title.trim()
          ? title
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 48)
          : `article-${Date.now()}`;
        tags.push(
          ["d", d || `article-${Date.now()}`],
          ["published_at", String(Math.floor(Date.now() / 1000))],
        );
        if (title.trim()) tags.push(["title", title.trim()]);
        tags.push(["t", "crays-article"]);
      }
      if (tab === "poll") {
        tags.push(
          ["polltype", "singlechoice"],
          ["endsAt", String(Math.floor(Date.now() / 1000) + 86400)],
        );
        pollOptions
          .map((option) => option.trim())
          .filter(Boolean)
          .forEach((option, index) => tags.push(["option", `option-${index + 1}`, option]));
      }

      await nostr.publish({
        content: text.trim(),
        kind: tab === "article" ? 30023 : tab === "poll" ? 1068 : 1,
        replyTo: options.mode === "reply" ? options.replyToEvent : undefined,
        contentWarning: sensitive ? `${reason}${warning ? ` — ${warning}` : ""}` : undefined,
        tags,
      });

      toast.success(
        tab === "article"
          ? "Article published to Nostr"
          : tab === "poll"
            ? "Poll published to Nostr"
            : "Posted to Nostr",
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't publish that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{options.mode === "reply" ? "Reply" : "Create"}</DialogTitle>
          {options.replyTo && <DialogDescription>Replying to {options.replyTo}</DialogDescription>}
        </DialogHeader>
        {options.mode !== "reply" && (
          <div className="flex gap-1 rounded-full bg-zinc-100 p-1 text-[12px] font-medium w-fit">
            {(["post", "article", "poll"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3.5 py-1.5 capitalize transition-colors ${
                  tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-3">
          {tab === "article" && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="Article title…"
            />
          )}
          <textarea
            rows={tab === "article" ? 8 : 5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              tab === "article"
                ? "Write your essay. Markdown supported."
                : tab === "poll"
                  ? "Ask your community a question…"
                  : "What's on your mind?"
            }
            className={`${inputCls} resize-none`}
          />
          {tab === "poll" && (
            <div className="space-y-2">
              {pollOptions.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={(e) =>
                    setPollOptions((all) =>
                      all.map((value, i) => (i === index ? e.target.value : value)),
                    )
                  }
                  className={inputCls}
                  placeholder={`Option ${index + 1}`}
                />
              ))}
              <button
                onClick={() => setPollOptions((all) => [...all, ""])}
                className="text-[12px] font-semibold text-brand"
              >
                + Add option
              </button>
            </div>
          )}
          <div className="space-y-2">
            {canPublishPremium ? (
              <>
                <ToggleRow
                  icon={<Crown className="size-4 text-amber-600" />}
                  title="Members only"
                  hint={
                    premium
                      ? `Members pay ${price.toLocaleString()} sats / ${BADGE_DAYS} days; anyone can also unlock just this post for ${unlockPrice.toLocaleString()} sats.`
                      : "Free for everyone."
                  }
                  tone="amber"
                  on={premium}
                  onToggle={() => setPremium((v) => !v)}
                />
                {premium && (
                  <div className="space-y-2 rounded-xl bg-amber-50/60 p-2.5 ring-1 ring-amber-100">
                    <div>
                      <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                        Membership · {BADGE_DAYS} days
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[500, 2000, 5000].map((p) => (
                          <button
                            key={p}
                            onClick={() => setPrice(p)}
                            className={`rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
                              price === p
                                ? "bg-white text-amber-900 shadow-sm ring-1 ring-amber-200"
                                : "text-amber-800/70"
                            }`}
                          >
                            {p.toLocaleString()} sats
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                        Single-post unlock
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[50, 200, 500].map((p) => (
                          <button
                            key={p}
                            onClick={() => setUnlockPrice(p)}
                            className={`rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
                              unlockPrice === p
                                ? "bg-white text-amber-900 shadow-sm ring-1 ring-amber-200"
                                : "text-amber-800/70"
                            }`}
                          >
                            {p.toLocaleString()} sats
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-amber-900">
                  <Lock className="size-3.5" /> Members-only posts need the Crays badge
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-amber-800/80">
                  The Crays badge is {formatUsd(CREATOR_PASS_USD)} / month and lets you sell
                  memberships and single-post unlocks with Lightning.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    ui.openUpgrade();
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-amber-600"
                >
                  <Crown className="size-3.5" /> Get Crays badge
                </button>
              </div>
            )}

            <ToggleRow
              icon={<AlertTriangle className="size-4 text-rose-600" />}
              title="Sensitive content"
              hint={
                sensitive
                  ? "Media will be blurred until viewers tap to reveal."
                  : "Turn on if this post contains adult, graphic or shocking media."
              }
              tone="rose"
              on={sensitive}
              onToggle={() => setSensitive((v) => !v)}
            />
            {sensitive && (
              <div className="space-y-2 rounded-xl bg-rose-50/60 p-3 ring-1 ring-rose-100">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
                  Why is it sensitive?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SENSITIVE_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        reason === r
                          ? "bg-rose-600 text-white"
                          : "bg-white text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  value={warning}
                  onChange={(e) => setWarning(e.target.value)}
                  className={inputCls}
                  placeholder="Optional note shown before reveal…"
                />
                <div className="flex items-start gap-2 rounded-lg bg-white/70 p-2.5 text-[11.5px] text-zinc-600 ring-1 ring-rose-100">
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                  Hidden from Discover and from anyone who turned sensitive media off.
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={publish} disabled={busy || !text.trim()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Publishing…" : tab === "article" ? "Publish" : "Post"}
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Creator badge ----------
function BadgeModal({
  open,
  onClose,
  options,
}: {
  open: boolean;
  onClose: () => void;
  options: BadgeOptions;
}) {
  const nostr = useNostr();
  const btc = useBtcPrice();
  const badges = useCreatorBadges();
  const unlocks = usePostUnlocks();
  const [creatorProfile, setCreatorProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const [nwcUri, setNwcUri] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [invoice, setInvoice] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const creator = options.creator;
  const subscriptionSats = options.sats ?? DEFAULT_BADGE_SATS;
  const postSats = options.postSats ?? Math.max(21, Math.round(subscriptionSats / 10));
  const name = options.name ?? "this creator";
  const owned = creator
    ? badges.find((badge) => badge.creator === creator && isBadgeActive(badge))
    : undefined;
  const unlocked = options.postId ? unlocks.some((item) => item.postId === options.postId) : false;
  // Readers can buy the membership or, from a post, just that post.
  const [mode, setMode] = useState<"subscribe" | "post">(
    options.mode ?? (options.postId ? "post" : "subscribe"),
  );
  const buyingPost = mode === "post" && Boolean(options.postId);
  const sats = buyingPost ? postSats : subscriptionSats;
  const usd = satsToUsd(sats, btc);

  useEffect(() => {
    if (!open) return;
    setNwcUri("");
    setConnecting(false);
    setPaying(false);
    setInvoice("");
    setVerifyUrl("");
    setCreatingInvoice(false);
    setMode(options.mode ?? (options.postId ? "post" : "subscribe"));
  }, [open, options.mode, options.postId]);

  useEffect(() => {
    if (!open || !creator) {
      setCreatorProfile(null);
      setMembers(null);
      return;
    }
    let cancelled = false;
    fetchProfile(creator)
      .then((profile) => {
        if (!cancelled) setCreatorProfile(profile);
      })
      .catch(() => undefined);
    fetchCreatorMembers(creator)
      .then((count) => {
        if (!cancelled) setMembers(count);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, creator]);

  const connect = async () => {
    setConnecting(true);
    try {
      await nostr.connectWallet(nwcUri.trim());
      setNwcUri("");
      toast.success("Lightning wallet connected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't connect that wallet.");
    } finally {
      setConnecting(false);
    }
  };

  const grantPurchase = () => {
    if (!creator) return;
    if (buyingPost && options.postId) {
      grantPostUnlock({ postId: options.postId, creator, sats });
      // Signed proof of the purchase, so it can be restored on another device.
      void announcePostUnlock({
        postId: options.postId,
        creator,
        sats,
        signAndPublish: nostr.signAndPublish,
      }).catch(() => undefined);
      toast.success("Post unlocked — it stays in your library");
      onClose();
      return;
    }
    const badge = grantCreatorBadge(creator, sats);
    // Signed proof of the purchase: lets the creator count members and lets
    // this reader restore the membership on another device.
    void announceCreatorBadge({
      creator,
      sats,
      expiresAt: badge.expiresAt,
      signAndPublish: nostr.signAndPublish,
    }).catch(() => undefined);
    toast.success(`Membership active — ${daysLeft(badge)} days of members-only posts`);
    onClose();
  };

  const buyWithWallet = async () => {
    if (!creator) {
      toast.error("This creator hasn't set up a badge yet.");
      return;
    }
    if (!nostr.wallet.connected) {
      toast.error("Connect a Lightning wallet first.");
      return;
    }
    setPaying(true);
    try {
      const profile = creatorProfile ?? (await fetchProfile(creator).catch(() => null));
      const address = lightningAddressFor(creator, profile);
      const nextInvoice = await requestPaymentInvoice(address, sats);
      await nostr.payInvoice(nextInvoice);
      grantPurchase();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't buy that badge.");
    } finally {
      setPaying(false);
    }
  };

  const createInvoice = async () => {
    if (!creator) {
      toast.error("This creator hasn't set up a badge yet.");
      return;
    }
    setCreatingInvoice(true);
    try {
      const profile = creatorProfile ?? (await fetchProfile(creator).catch(() => null));
      const address = lightningAddressFor(creator, profile);
      const details = await requestPaymentDetails(address, sats);
      setInvoice(details.invoice);
      setVerifyUrl(details.verifyUrl ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't create a Lightning invoice.");
    } finally {
      setCreatingInvoice(false);
    }
  };

  const primary = async () => {
    if (invoice) {
      // Only wallets without LUD-21 need a manual confirmation; otherwise the
      // poll below unlocks the moment the invoice settles.
      if (!verifyUrl) grantPurchase();
      return;
    }
    if (nostr.wallet.connected) {
      await buyWithWallet();
      return;
    }
    await createInvoice();
  };

  // LUD-21: unlock only after the invoice settles, so scanning the QR with any
  // wallet works without a self-reported "I've paid" step.
  const grantRef = useRef(grantPurchase);
  grantRef.current = grantPurchase;
  useEffect(() => {
    if (!open || !invoice || !verifyUrl) return;
    if (owned || (unlocked && buyingPost)) return;
    let cancelled = false;
    let timer: number | undefined;
    const deadline = Date.now() + 30 * 60 * 1000;
    const check = async () => {
      if (cancelled || Date.now() > deadline) return;
      try {
        const response = await fetch(verifyUrl, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("verify failed");
        const body = (await response.json()) as { settled?: boolean; status?: string };
        if (cancelled) return;
        if (body.settled === true) {
          grantRef.current();
          return;
        }
        if (body.status === "ERROR") return;
      } catch {
        // Keep polling through transient failures.
      }
      if (!cancelled) timer = window.setTimeout(check, 3000);
    };
    timer = window.setTimeout(check, 2500);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [open, invoice, verifyUrl, owned, unlocked, buyingPost]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="grid max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-amber-500" />
            {owned
              ? "Membership active"
              : unlocked && buyingPost
                ? "Post unlocked"
                : buyingPost
                  ? "Unlock this post"
                  : `${name}’s membership`}
          </DialogTitle>
          <DialogDescription>
            {owned
              ? `Your membership unlocks every members-only post from ${name}.`
              : buyingPost
                ? `Pay once for this post, or join ${name}’s membership to read everything.`
                : `One payment unlocks every members-only post from ${name} for ${BADGE_DAYS} days.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {owned || (unlocked && buyingPost) ? (
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-5 text-center ring-1 ring-emerald-100">
              <p className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                <Check className="size-3.5" />{" "}
                {owned ? `Active · ${daysLeft(owned)} days left` : "Unlocked"}
              </p>
              <p className="mt-1 text-[15px] font-semibold text-zinc-900">
                {owned
                  ? `You’re a member of ${name}’s membership`
                  : "You already unlocked this post"}
              </p>
              <p className="mt-1 text-[11.5px] text-zinc-500">
                {owned
                  ? `Paid ${owned.sats.toLocaleString()} sats · no auto-renew`
                  : "One-time purchase · it stays in your library"}
              </p>
            </div>
          ) : (
            <>
              {options.postId && (
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 text-[12px] font-semibold">
                  <button
                    onClick={() => {
                      setMode("post");
                      setInvoice("");
                      setVerifyUrl("");
                    }}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      buyingPost ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                    }`}
                  >
                    This post · {postSats.toLocaleString()} sats
                  </button>
                  <button
                    onClick={() => {
                      setMode("subscribe");
                      setInvoice("");
                      setVerifyUrl("");
                    }}
                    className={`rounded-lg px-3 py-1.5 transition-colors ${
                      buyingPost ? "text-zinc-500" : "bg-white text-zinc-900 shadow-sm"
                    }`}
                  >
                    Membership · {subscriptionSats.toLocaleString()} sats
                  </button>
                </div>
              )}
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center ring-1 ring-amber-100">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">
                  {buyingPost ? "Single post · forever" : `Membership · ${BADGE_DAYS} days`}
                </p>
                <p className="mt-1 text-[32px] font-bold tracking-tight text-zinc-900">
                  {sats.toLocaleString()} sats
                </p>
                <p className="text-[11.5px] text-zinc-500">
                  {usd != null ? `≈ ${formatUsd(usd)} · ` : ""}paid directly to {name} over
                  Lightning
                </p>
                {!buyingPost && members != null && members > 0 && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                    <Users className="size-3" /> {members} member{members === 1 ? "" : "s"} already
                    in
                  </p>
                )}
              </div>
              <ul className="space-y-1.5 text-[12.5px] text-zinc-600">
                {buyingPost ? (
                  <>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-emerald-500" /> This post, unlocked for
                      good
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-emerald-500" /> Full text and images
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-emerald-500" /> No membership needed
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-emerald-500" /> Every members-only post
                      from {name}
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-emerald-500" /> Full text, images and
                      long-form articles
                    </li>
                    <li className="flex gap-2">
                      <Check className="size-4 shrink-0 text-emerald-500" /> No auto-renew — buy
                      again only if you want
                    </li>
                  </>
                )}
              </ul>

              {invoice ? (
                <div className="rounded-xl bg-zinc-50 p-4 text-center ring-1 ring-zinc-100">
                  <p className="text-[12px] font-semibold text-zinc-900">
                    Scan or open in your Lightning wallet
                  </p>
                  <div className="mx-auto mt-2 grid size-40 place-items-center rounded-xl bg-white p-3 shadow-sm">
                    <QRCodeSVG value={invoice.toUpperCase()} size={136} level="M" />
                  </div>
                  <p className="mt-2 text-[12px] font-semibold text-zinc-900">
                    {sats.toLocaleString()} sats
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11.5px] font-semibold">
                    <a href={`lightning:${invoice}`} className="text-brand hover:underline">
                      Open wallet
                    </a>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(invoice);
                        toast.success("Invoice copied");
                      }}
                      className="inline-flex items-center gap-1 text-zinc-600 hover:underline"
                    >
                      <Copy className="size-3" /> Copy invoice
                    </button>
                  </div>
                  <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-400">
                    {verifyUrl
                      ? "This unlocks by itself the moment the payment settles."
                      : "After your wallet confirms the payment, tap “I’ve paid” to unlock on this device."}
                  </p>
                </div>
              ) : nostr.wallet.connected ? (
                <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[11.5px] text-zinc-500 ring-1 ring-zinc-100">
                  Paying with {nostr.wallet.alias ?? "your connected wallet"}. Crays never holds the
                  sats.
                </p>
              ) : (
                <div className="rounded-xl border border-zinc-200 p-3">
                  <p className="text-[12px] font-semibold text-zinc-900">
                    Pay with any Lightning wallet
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                    Tap “Pay with Lightning” below for an invoice you can scan or open in any
                    wallet. Or connect a NIP-47 wallet to pay in one tap.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={nwcUri}
                      onChange={(e) => setNwcUri(e.target.value)}
                      placeholder="nostr+walletconnect://…"
                      className={`${inputCls} min-w-0 flex-1 font-mono text-[11px]`}
                    />
                    <PrimaryBtn
                      className="!px-3 !py-2 !text-[12px]"
                      disabled={!nwcUri.trim() || connecting}
                      onClick={() => void connect()}
                    >
                      {connecting ? <Loader2 className="size-4 animate-spin" /> : "Connect"}
                    </PrimaryBtn>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {owned || (unlocked && buyingPost) ? (
            <PrimaryBtn className="w-full" onClick={onClose}>
              Start reading
            </PrimaryBtn>
          ) : (
            <>
              <GhostBtn onClick={onClose}>{invoice ? "Cancel" : "Maybe later"}</GhostBtn>
              <PrimaryBtn
                className="!bg-amber-500 hover:!bg-amber-600"
                disabled={paying || creatingInvoice || Boolean(invoice && verifyUrl)}
                onClick={() => void primary()}
              >
                {paying || creatingInvoice ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : invoice ? (
                  <Check className="size-4" />
                ) : (
                  <Zap className="size-4" />
                )}
                {paying
                  ? "Paying…"
                  : creatingInvoice
                    ? "Creating invoice…"
                    : invoice
                      ? verifyUrl
                        ? "Waiting for payment…"
                        : "I’ve paid — unlock"
                      : nostr.wallet.connected
                        ? `${buyingPost ? "Unlock" : "Subscribe"} · ${sats.toLocaleString()} sats`
                        : "Pay with Lightning"}
              </PrimaryBtn>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Share ----------
function ShareModal({
  open,
  onClose,
  options,
}: {
  open: boolean;
  onClose: () => void;
  options: ShareOptions;
}) {
  const url =
    options.url ?? (typeof window !== "undefined" ? window.location.href : "https://crays.app");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>{options.title ?? "Send this post anywhere."}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2">
          <LinkIcon className="size-4 text-zinc-400" />
          <input
            readOnly
            value={url}
            className="flex-1 bg-transparent text-[12.5px] text-zinc-700 outline-none"
          />
          <button
            onClick={() => {
              navigator.clipboard?.writeText(url);
              toast.success("Link copied");
            }}
            className="rounded-md bg-white px-2 py-1 text-[11.5px] font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {["Nostr", "X", "Email", "More"].map((p) => (
            <button
              key={p}
              onClick={() => toast.success(`Shared via ${p}`)}
              className="rounded-xl bg-zinc-50 px-2 py-3 text-[11.5px] font-semibold text-zinc-700 ring-1 ring-zinc-100 hover:bg-white hover:ring-brand/30"
            >
              {p}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Upgrade ----------
/** Fallback price when the live BTC rate has not loaded yet (~$50 at $100k/BTC). */
const CREATOR_PASS_FALLBACK_SATS = 500_000;

function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ui = useUI();
  const nostr = useNostr();
  const pass = useCreatorPass();
  const btc = useBtcPrice();
  const active = isCreatorPassActive(pass);
  const pricedSats = usdToSats(CREATOR_PASS_USD, btc);
  const liveSats = pricedSats ?? CREATOR_PASS_FALLBACK_SATS;
  const priced = pricedSats != null;
  const [quote, setQuote] = useState(liveSats);
  const [invoice, setInvoice] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState<"lightning" | "card">("lightning");
  const [stablecoin, setStablecoin] = useState<CardOnramp | null>(null);
  const liveSatsRef = useRef(liveSats);
  liveSatsRef.current = liveSats;

  const loadInvoice = useCallback(async () => {
    if (!CREATOR_PASS_CONFIGURED) {
      setInvoice("");
      setVerifyUrl("");
      setError("");
      return;
    }
    const amount = liveSatsRef.current;
    setQuote(amount);
    setLoading(true);
    setError("");
    try {
      const details = await requestPaymentDetails(CREATOR_PASS_ADDRESS, amount);
      setInvoice(details.invoice);
      setVerifyUrl(details.verifyUrl ?? "");
    } catch (err) {
      setInvoice("");
      setVerifyUrl("");
      setError(err instanceof Error ? err.message : "We couldn't create a Lightning invoice.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Build the invoice as soon as the modal opens so the QR is ready to scan.
  useEffect(() => {
    if (!open) {
      setInvoice("");
      setVerifyUrl("");
      setLoading(false);
      setPaying(false);
      setError("");
      setStablecoin(null);
      return;
    }
    if (active) return;
    void loadInvoice();
  }, [open, active, priced, loadInvoice]);

  // LUD-21: poll the wallet's verify endpoint and activate only after the
  // invoice actually settles, so there is no "I've paid" honor system.
  useEffect(() => {
    if (!open || !verifyUrl || active) return;
    let cancelled = false;
    let timer: number | undefined;
    const deadline = Date.now() + 30 * 60 * 1000;
    const check = async () => {
      if (cancelled || Date.now() > deadline) return;
      try {
        const response = await fetch(verifyUrl, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("verify failed");
        const body = (await response.json()) as { settled?: boolean; status?: string };
        if (cancelled) return;
        if (body.settled === true) {
          activateCreatorPass(quote);
          toast.success("Payment received — Crays premium is active");
          onClose();
          return;
        }
        if (body.status === "ERROR") return;
      } catch {
        // Keep polling; a transient failure shouldn't cancel the purchase.
      }
      if (!cancelled) timer = window.setTimeout(check, 3000);
    };
    timer = window.setTimeout(check, 2500);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [open, verifyUrl, active, quote, onClose]);

  const payWithWallet = async () => {
    setPaying(true);
    const amount = invoice ? quote : liveSatsRef.current;
    try {
      const details = invoice
        ? { invoice, verifyUrl }
        : await requestPaymentDetails(CREATOR_PASS_ADDRESS, liveSatsRef.current);
      if (!invoice) {
        setQuote(liveSatsRef.current);
        setInvoice(details.invoice);
        setVerifyUrl(details.verifyUrl ?? "");
      }
      await nostr.payInvoice(details.invoice);
      // A successful wallet payment is proof enough to activate immediately.
      activateCreatorPass(amount);
      toast.success("Payment sent — Crays premium is active");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The payment didn't go through.");
    } finally {
      setPaying(false);
    }
  };

  const onramps = cardOnramps(CREATOR_PASS_USD);

  const activateStablecoin = () => {
    activateCreatorPass(quote);
    toast.success("Thanks — Crays premium is active");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="grid max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-amber-500" />
            Crays premium
          </DialogTitle>
          <DialogDescription>
            The monthly badge that lets you sell memberships and get paid by fans. No platform cut —
            readers pay you directly over Lightning.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1">
          {active && pass ? (
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-4 text-center ring-1 ring-amber-100">
              <p className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-emerald-700">
                <Check className="size-3.5" /> Active · {creatorPassDaysLeft(pass)} days left
              </p>
              <p className="mt-1 text-[15px] font-semibold text-zinc-900">
                You can publish members-only posts
              </p>
              <p className="mt-1 text-[11.5px] text-zinc-500">
                {formatUsd(CREATOR_PASS_USD)} / month · renew anytime to add {CREATOR_PASS_DAYS}{" "}
                days
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-2.5 ring-1 ring-amber-100">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Crays premium · {CREATOR_PASS_DAYS} days
                </p>
                <p className="text-[22px] font-bold leading-tight tracking-tight text-zinc-900">
                  {formatUsd(CREATOR_PASS_USD)}
                  <span className="text-[12px] font-semibold text-zinc-500"> / month</span>
                </p>
              </div>
              <p className="text-right text-[10.5px] leading-snug text-zinc-500">
                ≈ {quote.toLocaleString()} sats
                <br />
                {priced ? "at the live BTC rate" : "estimated"}
              </p>
            </div>
          )}

          {!active && (
            <>
              {!CREATOR_PASS_CONFIGURED ? (
                <div className="rounded-xl bg-zinc-50 p-4 text-center ring-1 ring-zinc-100">
                  <p className="text-[12px] font-semibold text-zinc-900">
                    Checkout is almost ready
                  </p>
                  <p className="mx-auto mt-1 max-w-[300px] text-[11.5px] leading-relaxed text-zinc-500">
                    Crays premium payments aren’t connected yet. Once the Crays Lightning address is
                    live, checkout will show a QR you can pay in one scan.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
                    {(
                      [
                        ["lightning", "Lightning"],
                        ["card", "Card"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => {
                          setMethod(value);
                          setStablecoin(null);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                          method === value
                            ? "bg-white text-zinc-900 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-800"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {method === "lightning" ? (
                    <div className="rounded-xl bg-zinc-50 p-4 text-center ring-1 ring-zinc-100">
                      <p className="text-[12px] font-semibold text-zinc-900">
                        {invoice
                          ? `Scan to pay ${quote.toLocaleString()} sats`
                          : "Lightning checkout"}
                      </p>
                      <div className="mx-auto mt-2 grid size-40 place-items-center rounded-xl bg-white p-3 shadow-sm">
                        {loading ? (
                          <Loader2 className="size-6 animate-spin text-zinc-300" />
                        ) : invoice ? (
                          <QRCodeSVG value={invoice.toUpperCase()} size={136} level="M" />
                        ) : (
                          <span className="px-2 text-[11px] leading-relaxed text-zinc-400">
                            {error ? "We couldn’t create an invoice." : "Preparing your invoice…"}
                          </span>
                        )}
                      </div>
                      {invoice ? (
                        <>
                          <p className="mt-2 text-[12px] font-semibold text-zinc-900">
                            {formatUsd(CREATOR_PASS_USD)} · {quote.toLocaleString()} sats
                          </p>
                          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11.5px] font-semibold">
                            <a href={`lightning:${invoice}`} className="text-brand hover:underline">
                              Open wallet
                            </a>
                            <button
                              onClick={() => {
                                void navigator.clipboard.writeText(invoice);
                                toast.success("Invoice copied");
                              }}
                              className="inline-flex items-center gap-1 text-zinc-600 hover:underline"
                            >
                              <Copy className="size-3" /> Copy invoice
                            </button>
                            <button
                              onClick={() => void loadInvoice()}
                              className="text-zinc-600 hover:underline"
                            >
                              New invoice
                            </button>
                          </div>
                          <p className="mt-2 text-[10.5px] leading-relaxed text-zinc-400">
                            {verifyUrl
                              ? "Crays premium turns on by itself the moment the payment settles."
                              : "This wallet doesn’t report payments automatically — connect a wallet to pay in one tap."}
                          </p>
                          {verifyUrl && (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-amber-700">
                              <Loader2 className="size-3 animate-spin" /> Waiting for payment…
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="mx-auto mt-2 max-w-[300px] text-[11.5px] leading-relaxed text-zinc-500">
                            {error
                              ? "Checkout is unavailable right now. Try again in a moment."
                              : "Creating a Lightning invoice…"}
                          </p>
                          {!loading && (
                            <button
                              onClick={() => void loadInvoice()}
                              className="mt-2 text-[11.5px] font-semibold text-brand hover:underline"
                            >
                              Try again
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white p-3.5 ring-1 ring-zinc-100">
                      {stablecoin?.address ? (
                        <>
                          <button
                            onClick={() => setStablecoin(null)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-800"
                          >
                            <ChevronLeft className="size-3.5" /> All payment options
                          </button>
                          <p className="mt-2 text-center text-[12px] font-semibold text-zinc-900">
                            Send {CREATOR_PASS_USD} {stablecoin.id.toUpperCase()} on{" "}
                            {stablecoin.network}
                          </p>
                          <div className="mx-auto mt-2 grid size-40 place-items-center rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-100">
                            <QRCodeSVG value={stablecoin.address} size={136} level="M" />
                          </div>
                          <p className="mt-2 break-all rounded-lg bg-zinc-50 px-2.5 py-2 text-center font-mono text-[10.5px] leading-relaxed text-zinc-600 ring-1 ring-zinc-100">
                            {stablecoin.address}
                          </p>
                          <button
                            onClick={() => {
                              void navigator.clipboard.writeText(stablecoin.address ?? "");
                              toast.success("Address copied");
                            }}
                            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-2 text-[11.5px] font-semibold text-zinc-700 hover:bg-zinc-200"
                          >
                            <Copy className="size-3.5" /> Copy address
                          </button>
                          <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
                            Only send {stablecoin.id.toUpperCase()} on {stablecoin.network} to this
                            address. Stablecoin transfers aren’t verified automatically yet.
                          </p>
                          <PrimaryBtn
                            className="mt-2 w-full !bg-amber-500 hover:!bg-amber-600"
                            onClick={activateStablecoin}
                          >
                            <Check className="size-4" /> I’ve sent it — activate
                          </PrimaryBtn>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[12px] font-semibold text-zinc-900">
                              Pay {formatUsd(CREATOR_PASS_USD)}
                            </p>
                            <p className="text-[10.5px] text-zinc-400">
                              ≈ {quote.toLocaleString()} sats
                            </p>
                          </div>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-zinc-500">
                            Buy Bitcoin with a card, or send USDC/USDT. Lightning activates
                            automatically; stablecoin transfers are confirmed manually.
                          </p>
                          <ul className="mt-2.5 space-y-1.5">
                            {onramps.map((onramp) => {
                              const Icon = onramp.id === "moonpay" ? CreditCard : Coins;
                              const body = (
                                <>
                                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-500">
                                    <Icon className="size-3.5" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[12px] font-semibold text-zinc-800">
                                      {onramp.label}
                                    </span>
                                    <span className="block text-[10.5px] leading-snug text-zinc-500">
                                      {onramp.description}
                                    </span>
                                  </span>
                                  {onramp.href && (
                                    <ArrowUpRight className="size-3.5 shrink-0 text-zinc-300" />
                                  )}
                                </>
                              );
                              return (
                                <li key={onramp.id}>
                                  {onramp.href ? (
                                    <a
                                      href={onramp.href}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 ring-1 ring-zinc-100 transition-colors hover:bg-zinc-50 hover:ring-amber-200"
                                    >
                                      {body}
                                    </a>
                                  ) : onramp.address ? (
                                    <button
                                      onClick={() => setStablecoin(onramp)}
                                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ring-1 ring-zinc-100 transition-colors hover:bg-zinc-50 hover:ring-amber-200"
                                    >
                                      {body}
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 opacity-60 ring-1 ring-zinc-100">
                                      {body}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          <p className="mt-2 text-[10px] leading-relaxed text-zinc-400">
                            MoonPay opens in a new tab. Apple Pay needs Safari; Google Pay needs
                            Chrome.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <ul className="grid gap-x-3 gap-y-1.5 text-[12px] text-zinc-700 sm:grid-cols-2">
            {[
              "Publish members-only posts",
              "Sell memberships & single posts",
              "Set your own prices",
              "See members and earnings",
              "Passkey sign-in",
              "Receive zaps to your wallet",
            ].map((f) => (
              <li key={f} className="flex gap-1.5">
                <Check className="size-3.5 shrink-0 text-emerald-500" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <GhostBtn onClick={onClose}>Close</GhostBtn>
          <div className="flex gap-2">
            {active ? (
              <PrimaryBtn
                onClick={() => {
                  onClose();
                  ui.openCompose({ mode: "post" });
                }}
              >
                Write a post
              </PrimaryBtn>
            ) : method === "lightning" && nostr.wallet.connected && invoice ? (
              <PrimaryBtn
                className="!bg-amber-500 hover:!bg-amber-600"
                disabled={paying}
                onClick={() => void payWithWallet()}
              >
                {paying ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                Pay {quote.toLocaleString()} sats
              </PrimaryBtn>
            ) : error ? (
              <GhostBtn onClick={() => void loadInvoice()}>Try again</GhostBtn>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Send / Receive / Top-up ----------
function SendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nostr = useNostr();
  const price = useBtcPrice();
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDest("");
      setAmount("");
      setBusy(false);
    }
  }, [open]);

  const sats = Number(amount) || 0;
  const usd = formatUsd(satsToUsd(sats, price));

  const send = async () => {
    setBusy(true);
    try {
      const invoice = isLightningInvoice(dest)
        ? dest.trim()
        : await requestPaymentInvoice(dest, sats);
      await nostr.payInvoice(invoice);
      toast.success(`Sent ${sats ? `${sats.toLocaleString()} sats` : "payment"}`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The payment didn't go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpRight className="size-5" /> Send sats
          </DialogTitle>
          <DialogDescription>
            {nostr.wallet.connected
              ? `From ${nostr.wallet.alias ?? "your Lightning wallet"}${nostr.wallet.balanceSats != null ? ` · ${nostr.wallet.balanceSats.toLocaleString()} sats` : ""}`
              : "Connect a Lightning wallet to send payments."}
          </DialogDescription>
        </DialogHeader>
        {!nostr.wallet.connected ? (
          <WalletConnectBlock />
        ) : (
          <>
            <Field label="Destination" hint="lnbc… invoice, you@wallet.com address, or LNURL.">
              <textarea
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                rows={3}
                className={`${inputCls} resize-none font-mono text-[12px]`}
                placeholder="lnbc1…"
              />
            </Field>
            {!isLightningInvoice(dest) && (
              <Field label="Amount (sats)" hint={sats ? `≈ ${usd}` : undefined}>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputCls}
                  placeholder="0"
                />
              </Field>
            )}
          </>
        )}
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            disabled={!nostr.wallet.connected || !dest.trim() || busy}
            onClick={() => void send()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy ? "Sending…" : "Send"}
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nostr = useNostr();
  const price = useBtcPrice();
  const address = nostr.wallet.address;
  const [amount, setAmount] = useState(1000);
  const [invoice, setInvoice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(1000);
      setInvoice("");
      setBusy(false);
    }
  }, [open]);

  const generate = async () => {
    setBusy(true);
    try {
      const created = await nostr.makeInvoice(amount, "Crays deposit");
      setInvoice(created.invoice);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Your wallet couldn't create an invoice.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="size-5" /> Receive sats
          </DialogTitle>
          <DialogDescription>
            {nostr.wallet.connected
              ? "Create a Lightning invoice from your connected wallet."
              : address
                ? nostr.wallet.addressSource === "hosted"
                  ? "Your wallet is derived from your Nostr key. Sats arrive at your npub.cash address — claim them with your Nostr key at npub.cash."
                  : "Share your Lightning address — payments arrive with no setup."
                : "Sign in to derive a Lightning wallet from your Nostr identity."}
          </DialogDescription>
        </DialogHeader>
        {!nostr.wallet.connected ? (
          address ? (
            <div className="rounded-xl bg-zinc-50 p-5 text-center ring-1 ring-zinc-100">
              <div className="mx-auto grid size-44 place-items-center rounded-xl bg-white p-3 shadow-sm">
                <QRCodeSVG value={`lightning:${address}`} size={152} level="M" />
              </div>
              <p className="mt-3 break-all font-mono text-[11px] text-zinc-600">{address}</p>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(address);
                  toast.success("Lightning address copied");
                }}
                className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
              >
                <Copy className="size-3" /> Copy Lightning address
              </button>
            </div>
          ) : (
            <WalletConnectBlock />
          )
        ) : (
          <>
            {invoice ? (
              <div className="rounded-xl bg-zinc-50 p-5 text-center ring-1 ring-zinc-100">
                <div className="mx-auto grid size-44 place-items-center rounded-xl bg-white p-3 shadow-sm">
                  <QRCodeSVG value={invoice.toUpperCase()} size={152} level="M" />
                </div>
                <p className="mt-3 break-all font-mono text-[10.5px] text-zinc-600">
                  {invoice.slice(0, 48)}…
                </p>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(invoice);
                    toast.success("Invoice copied");
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
                >
                  <Copy className="size-3" /> Copy invoice
                </button>
              </div>
            ) : (
              <Field label="Amount (sats)" hint={formatUsd(satsToUsd(amount, price))}>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
                  className={inputCls}
                />
              </Field>
            )}
          </>
        )}
        <DialogFooter>
          <GhostBtn onClick={onClose}>Close</GhostBtn>
          {nostr.wallet.connected ? (
            <PrimaryBtn
              disabled={busy}
              onClick={() =>
                void (invoice
                  ? (navigator.clipboard.writeText(invoice),
                    toast.success("Invoice copied"),
                    onClose())
                  : generate())
              }
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {invoice ? "Copy invoice" : "Generate invoice"}
            </PrimaryBtn>
          ) : address ? (
            <PrimaryBtn
              onClick={() => {
                void navigator.clipboard.writeText(address);
                toast.success("Lightning address copied");
                onClose();
              }}
            >
              <Copy className="size-4" /> Copy address
            </PrimaryBtn>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TopUpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nostr = useNostr();
  const price = useBtcPrice();
  const [usd, setUsd] = useState(20);
  const [invoice, setInvoice] = useState("");
  const [busy, setBusy] = useState(false);
  const sats = price ? Math.max(1, Math.round((usd / price.usd) * 100_000_000)) : 0;

  useEffect(() => {
    if (open) {
      setUsd(20);
      setInvoice("");
      setBusy(false);
    }
  }, [open]);

  const deposit = async () => {
    setBusy(true);
    try {
      const created = await nostr.makeInvoice(sats, "Crays top-up");
      setInvoice(created.invoice);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Your wallet couldn't create an invoice.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5" /> Top up wallet
          </DialogTitle>
          <DialogDescription>
            Generate a Lightning invoice from your wallet, then pay it from any exchange or card
            on-ramp.
          </DialogDescription>
        </DialogHeader>
        {!nostr.wallet.connected ? (
          <WalletConnectBlock />
        ) : invoice ? (
          <div className="rounded-xl bg-zinc-50 p-4 text-center ring-1 ring-zinc-100">
            <div className="mx-auto grid size-40 place-items-center rounded-xl bg-white p-3 shadow-sm">
              <QRCodeSVG value={invoice.toUpperCase()} size={136} level="M" />
            </div>
            <p className="mt-2 text-[12px] font-semibold text-zinc-800">
              {sats.toLocaleString()} sats
            </p>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(invoice);
                toast.success("Invoice copied");
              }}
              className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
            >
              <Copy className="size-3" /> Copy invoice
            </button>
          </div>
        ) : (
          <>
            <Field
              label="Amount (USD)"
              hint={sats ? `≈ ${sats.toLocaleString()} sats` : "Waiting for the live BTC price…"}
            >
              <input
                type="number"
                min={1}
                value={usd}
                onChange={(e) => setUsd(Math.max(1, Number(e.target.value) || 0))}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              {[10, 20, 50, 100, 250, 500].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setUsd(preset)}
                  className={`rounded-lg py-2 text-[12px] font-semibold ring-1 transition-colors ${
                    usd === preset
                      ? "bg-zinc-900 text-white ring-zinc-900"
                      : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  ${preset}
                </button>
              ))}
            </div>
          </>
        )}
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          {nostr.wallet.connected && (
            <PrimaryBtn
              disabled={busy || !sats}
              onClick={() => void (invoice ? onClose() : deposit())}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {invoice ? "Done" : "Generate invoice"}
            </PrimaryBtn>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalletConnectBlock() {
  const nostr = useNostr();
  const [uri, setUri] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
      <p className="text-[12px] font-semibold text-zinc-800">Connect a Lightning wallet</p>
      <p className="text-[11.5px] text-zinc-500">
        Paste a Nostr Wallet Connect string from Alby, Zeus, Primal or your own node.
      </p>
      <input
        value={uri}
        onChange={(e) => setUri(e.target.value)}
        placeholder="nostr+walletconnect://…"
        className={`${inputCls} font-mono text-[11px]`}
      />
      <GhostBtn
        className="w-full"
        disabled={!uri.trim() || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await nostr.connectWallet(uri);
            toast.success("Lightning wallet connected");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Couldn't connect that wallet.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy || nostr.wallet.loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Connect wallet"
        )}
      </GhostBtn>
      {nostr.wallet.error && <p className="text-[11px] text-rose-600">{nostr.wallet.error}</p>}
    </div>
  );
}

// ---------- Tx detail ----------
function TxDetailSheet({ tx, onClose }: { tx: TxDetail | null; onClose: () => void }) {
  return (
    <Sheet open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[420px]">
        <SheetHeader>
          <SheetTitle>Transaction</SheetTitle>
          <SheetDescription>{tx?.time}</SheetDescription>
        </SheetHeader>
        {tx && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
              <AvatarTile seed={tx.who} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-zinc-900">{tx.who}</p>
                <p className="truncate text-[11.5px] text-zinc-500">{tx.note}</p>
              </div>
              <p
                className={`text-[14px] font-bold tabular-nums ${tx.kind === "in" ? "text-emerald-600" : "text-zinc-900"}`}
              >
                {tx.amount}
              </p>
            </div>
            <dl className="space-y-2 text-[12.5px]">
              {[
                ["Status", "Confirmed"],
                ["Fee", "1 sat"],
                ["USD value", tx.usd],
                ["Type", tx.kind === "in" ? "Incoming zap" : "Outgoing payment"],
                ["Preimage", "9f3a…b2c1"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-zinc-100 pb-2">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="font-medium text-zinc-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2">
              <GhostBtn
                className="flex-1"
                onClick={() => {
                  navigator.clipboard?.writeText(tx.id);
                  toast.success("Tx ID copied");
                }}
              >
                <Copy className="size-4" /> Copy ID
              </GhostBtn>
              <PrimaryBtn className="flex-1" onClick={onClose}>
                Done
              </PrimaryBtn>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------- Edit profile ----------
function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nostr = useNostr();
  const profile = nostr.account?.profile;
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [picture, setPicture] = useState("");
  const [website, setWebsite] = useState("");
  const [lud16, setLud16] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? "");
    setDisplayName(profile?.displayName ?? "");
    setAbout(profile?.about ?? "");
    setPicture(profile?.picture ?? "");
    setWebsite(profile?.website ?? "");
    setLud16(profile?.lud16 ?? "");
    setBusy(false);
  }, [open, profile]);

  const save = async () => {
    setBusy(true);
    try {
      await nostr.updateProfile({
        name: name.trim(),
        displayName: displayName.trim() || name.trim(),
        about: about.trim(),
        picture: picture.trim(),
        website: website.trim(),
        lud16: lud16.trim(),
      });
      toast.success("Profile published to Nostr");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Published as a kind-0 metadata event signed by your key.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {picture ? (
              <img src={picture} alt="" className="size-16 rounded-full object-cover" />
            ) : (
              <AvatarTile seed={displayName || name || nostr.account?.npub || "Crays"} size={64} />
            )}
            <div className="flex-1">
              <Field label="Avatar URL">
                <input
                  value={picture}
                  onChange={(e) => setPicture(e.target.value)}
                  placeholder="https://…"
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Display name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Username">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="satoshi"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Bio">
            <textarea
              rows={3}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Website">
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://…"
                className={inputCls}
              />
            </Field>
            <Field label="Lightning address" hint="So people can zap you.">
              <input
                value={lud16}
                onChange={(e) => setLud16(e.target.value)}
                placeholder="you@wallet.com"
                className={inputCls}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Publishing…" : "Save"}
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Link block ----------
function LinkBlockModal({
  open,
  existing,
  onClose,
}: {
  open: boolean;
  existing: { title: string; url: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit link" : "Add link block"}</DialogTitle>
          <DialogDescription>Appears on your link-in-bio page.</DialogDescription>
        </DialogHeader>
        <Field label="Title">
          <input
            defaultValue={existing?.title ?? ""}
            placeholder="My latest essay"
            className={inputCls}
          />
        </Field>
        <Field label="URL">
          <input defaultValue={existing?.url ?? ""} placeholder="https://…" className={inputCls} />
        </Field>
        <Field label="Subtitle (optional)">
          <input className={inputCls} placeholder="Read on Crays" />
        </Field>
        <DialogFooter>
          {existing && (
            <GhostBtn
              className="!text-rose-600 mr-auto"
              onClick={() => {
                toast.success("Link removed");
                onClose();
              }}
            >
              Delete
            </GhostBtn>
          )}
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            onClick={() => {
              toast.success(existing ? "Link updated" : "Link added");
              onClose();
            }}
          >
            {existing ? "Save" : "Add"}
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- New DM ----------
function NewDMModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValue("");
      setError("");
    }
  }, [open]);

  const start = () => {
    const pubkey = normalizePubkey(value);
    if (!pubkey) {
      setError("Enter a valid npub, nprofile or hex public key.");
      return;
    }
    navigate({ to: "/messages", search: { to: pubkeyToNpub(pubkey) } });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>End-to-end encrypted on Nostr.</DialogDescription>
        </DialogHeader>
        <Field label="Recipient" hint="Paste their npub or nprofile.">
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") start();
            }}
            placeholder="npub1…"
            className={inputCls}
            autoFocus
          />
        </Field>
        {error && <p className="text-[11.5px] text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn disabled={!value.trim()} onClick={start}>
            Start chat
          </PrimaryBtn>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Add relay ----------
function AddRelayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [custom, setCustom] = useState<string[]>(() => getCustomRelays());

  useEffect(() => {
    if (open) {
      setUrl("");
      setCustom(getCustomRelays());
    }
  }, [open]);

  const add = () => {
    if (!addRelay(url)) {
      toast.error("Enter a valid relay URL, like wss://relay.example.com");
      return;
    }
    setCustom(getCustomRelays());
    setUrl("");
    toast.success("Relay added");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="size-5" /> Add relay
          </DialogTitle>
          <DialogDescription>
            Relays store and broadcast your Nostr posts. Added relays are used for reads and writes.
          </DialogDescription>
        </DialogHeader>
        <Field label="Relay URL" hint="wss://relay.example.com">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className={`${inputCls} font-mono`}
            placeholder="wss://"
          />
        </Field>
        {custom.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Your relays
            </p>
            {custom.map((relay) => (
              <div
                key={relay}
                className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-100"
              >
                <span className="truncate font-mono text-[11.5px] text-zinc-700">{relay}</span>
                <button
                  onClick={() => {
                    removeRelay(relay);
                    setCustom(getCustomRelays());
                    toast.success("Relay removed");
                  }}
                  className="text-[11px] font-semibold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <GhostBtn onClick={onClose}>Close</GhostBtn>
          <PrimaryBtn disabled={!url.trim()} onClick={add}>
            Add relay
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Reveal key ----------
function RevealKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nostr = useNostr();
  const [revealed, setRevealed] = useState(false);
  const nsec = nostr.exportNsec();
  useEffect(() => {
    if (!open) setRevealed(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-rose-600">⚠ Reveal your secret key</DialogTitle>
          <DialogDescription>
            {nsec
              ? "Your nsec controls your identity. Anyone with it can post as you and drain your funds. Store it in a password manager."
              : "Your key is managed by your signer or browser extension, so Crays can't display it here. Export it from your signer app."}
          </DialogDescription>
        </DialogHeader>
        {nsec && (
          <>
            <div className="rounded-xl bg-zinc-900 p-4 font-mono text-[11.5px] break-all text-zinc-100">
              {revealed ? nsec : "•".repeat(60)}
            </div>
            <div className="flex gap-2">
              <GhostBtn className="flex-1" onClick={() => setRevealed((v) => !v)}>
                {revealed ? (
                  <>
                    <EyeOff className="size-4" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="size-4" /> Reveal
                  </>
                )}
              </GhostBtn>
              <GhostBtn
                className="flex-1"
                onClick={() => {
                  void navigator.clipboard.writeText(nsec);
                  toast.success("Key copied — store it safely");
                }}
              >
                <Copy className="size-4" /> Copy
              </GhostBtn>
            </div>
          </>
        )}
        <DialogFooter>
          <PrimaryBtn onClick={onClose}>Done</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Logout confirm ----------
function LogoutConfirm({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out of Crays?</AlertDialogTitle>
          <AlertDialogDescription>
            Make sure you have your nsec backed up. Without it, you cannot sign back in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-600 hover:bg-rose-700"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Log out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Command palette ----------
function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const ui = useUI();
  const [query, setQuery] = useState("");
  const pointer = useMemo(() => parseProfilePointer(query), [query]);
  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search posts, creators, or paste an npub / nprofile…"
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {pointer && (
          <CommandGroup heading="Open profile">
            <CommandItem
              value={`profile ${pointer.pubkey} ${query}`}
              onSelect={() => {
                onOpenChange(false);
                navigate({
                  to: "/profile",
                  search: {
                    pubkey: pointer.pubkey,
                    relays: pointer.relays.length > 0 ? pointer.relays.join(",") : undefined,
                  },
                });
              }}
            >
              <User className="size-4" /> View @{shortNpub(pointer.pubkey)}
            </CommandItem>
          </CommandGroup>
        )}
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>
            <Home className="size-4" /> Home
          </CommandItem>
          <CommandItem onSelect={() => go("/discover")}>
            <Compass className="size-4" /> Discover
          </CommandItem>
          {ui.user && (
            <>
              <CommandItem onSelect={() => go("/following")}>
                <Users className="size-4" /> Following
              </CommandItem>
              <CommandItem onSelect={() => go("/messages")}>
                <MessageCircle className="size-4" /> Messages
              </CommandItem>
              <CommandItem onSelect={() => go("/notifications")}>
                <Bell className="size-4" /> Notifications
              </CommandItem>
              <CommandItem onSelect={() => go("/bookmarks")}>
                <Bookmark className="size-4" /> Bookmarks
              </CommandItem>
              <CommandItem onSelect={() => go("/premium")}>
                <Crown className="size-4" /> Creator tools
              </CommandItem>
              <CommandItem onSelect={() => go("/wallet")}>
                <Wallet className="size-4" /> Wallet
              </CommandItem>
              <CommandItem onSelect={() => go("/profile")}>
                <User className="size-4" /> Profile
              </CommandItem>
              <CommandItem onSelect={() => go("/settings")}>
                <Cog className="size-4" /> Settings
              </CommandItem>
            </>
          )}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              ui.openCompose({ mode: "post" });
            }}
          >
            <Pencil className="size-4" /> Write a post
          </CommandItem>
          <CommandItem
            onSelect={() => {
              onOpenChange(false);
              ui.openAuth({ intent: "switch accounts" });
            }}
          >
            <LogIn className="size-4" /> Sign in / Create
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// ---------- Image picker ----------
function ImagePickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" /> Attach media
          </DialogTitle>
        </DialogHeader>
        <div className="grid place-items-center rounded-xl border-2 border-dashed border-zinc-200 px-6 py-10 text-center hover:border-brand/40 hover:bg-brand/5">
          <ImageIcon className="size-8 text-zinc-300" />
          <p className="mt-2 text-[13px] font-semibold text-zinc-700">
            Drag & drop or click to upload
          </p>
          <p className="text-[11px] text-zinc-500">JPG · PNG · GIF · MP4 up to 25 MB</p>
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            onClick={() => {
              toast.success("Image attached");
              onClose();
            }}
          >
            Use sample
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Poll builder ----------
function PollBuilderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" /> Create a poll
          </DialogTitle>
        </DialogHeader>
        <Field label="Question">
          <input className={inputCls} placeholder="Will BTC close above $X?" />
        </Field>
        {[1, 2, 3, 4].map((i) => (
          <input
            key={i}
            className={inputCls}
            placeholder={`Option ${i}${i > 2 ? " (optional)" : ""}`}
          />
        ))}
        <Field label="Duration">
          <select className={inputCls}>
            <option>1 day</option>
            <option>3 days</option>
            <option>1 week</option>
          </select>
        </Field>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            onClick={() => {
              toast.success("Poll posted");
              onClose();
            }}
          >
            Post poll
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Decorative QR ----------
function FauxQR() {
  const cells = Array.from({ length: 11 * 11 }, (_, i) => {
    const x = i % 11,
      y = Math.floor(i / 11);
    const corner = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    return corner || (x * 73 + y * 131 + (x ^ y) * 17) % 7 < 3;
  });
  return (
    <div className="grid h-full w-full grid-cols-11 gap-[1.5px]">
      {cells.map((on, i) => (
        <div key={i} className={`rounded-[2px] ${on ? "bg-zinc-900" : "bg-white"}`} />
      ))}
    </div>
  );
}

// ---------- Auth Modal ----------
type AdvancedMethod = "signer" | "extension" | "key";

function AuthModal({
  open,
  options,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  options: AuthOptions;
  onClose: () => void;
  onSignedIn: () => void;
}) {
  const nostr = useNostr();
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [passkeyReady, setPasskeyReady] = useState(true);
  const [busy, setBusy] = useState<null | string>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [method, setMethod] = useState<AdvancedMethod | null>(null);
  const [signerMode, setSignerMode] = useState<"qr" | "link">("qr");
  const [bunker, setBunker] = useState("");
  const [nsec, setNsec] = useState("");
  const [connectUri, setConnectUri] = useState("");
  const [waitingConnect, setWaitingConnect] = useState(false);
  const connectStarted = useRef(false);

  useEffect(() => {
    if (!open) return;
    setMode(hasPasskey() ? "signin" : "create");
    const supported = hasWebAuthn();
    setPasskeyReady(supported);
    setBusy(null);
    setAdvancedOpen(!supported);
    setMethod(null);
    setSignerMode("qr");
    setBunker("");
    setNsec("");
    setConnectUri("");
    setWaitingConnect(false);
    connectStarted.current = false;
  }, [open]);

  // Start the Nostr Connect handshake the first time the QR is shown.
  useEffect(() => {
    if (!open || method !== "signer" || signerMode !== "qr" || connectStarted.current) return;
    connectStarted.current = true;
    const pending = nostr.startNostrConnect();
    setConnectUri(pending.uri);
    setWaitingConnect(true);
    pending
      .wait()
      .then(() => {
        toast.success("Connected to your signer");
        onSignedIn();
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "The signer didn't approve in time.");
      })
      .finally(() => setWaitingConnect(false));
    // startNostrConnect is stable for the lifetime of the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method, signerMode]);

  const run = async (label: string, action: () => Promise<void>, success = "Signed in") => {
    setBusy(label);
    try {
      await action();
      toast.success(success);
      onSignedIn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const isCreate = mode === "create";
  const intent = options.intent?.trim();
  const intentSentence =
    intent && !/^(sign in|sign in \/ create|switch accounts)$/i.test(intent)
      ? `Sign in to ${intent}.`
      : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-6 sm:max-w-[420px]">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
            <Fingerprint className="size-6" strokeWidth={1.8} />
          </div>
          <DialogTitle className="mt-3 text-[20px] font-semibold tracking-tight text-zinc-900">
            {isCreate ? "Create your Crays account" : "Welcome back"}
          </DialogTitle>
          <DialogDescription className="mt-1 max-w-[300px] text-[13px] leading-relaxed text-zinc-500">
            {intentSentence
              ? intentSentence
              : isCreate
                ? "No password, no seed phrase. Your face, fingerprint or device PIN is all you need."
                : "Unlock your account with your face, fingerprint or device PIN."}
          </DialogDescription>
        </DialogHeader>

        <button
          disabled={!!busy || !passkeyReady}
          onClick={() =>
            void run(
              "Waiting for passkey…",
              () => nostr.signInWithPasskey(mode).then(() => undefined),
              isCreate ? "Account created" : "Signed in with your passkey",
            )
          }
          className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-3.5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-black disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="size-[18px] animate-spin" /> {busy}
            </>
          ) : (
            <>
              <Fingerprint className="size-[18px]" />{" "}
              {isCreate ? "Create account with passkey" : "Continue with passkey"}
            </>
          )}
        </button>

        {!passkeyReady && (
          <p className="mt-2 text-center text-[11.5px] text-amber-700">
            Passkeys aren't available in this browser. Use one of the options below.
          </p>
        )}

        <p className="mt-3 text-center text-[12px] text-zinc-500">
          {isCreate ? "Already have an account?" : "New to Crays?"}{" "}
          <button
            onClick={() => setMode(isCreate ? "signin" : "create")}
            className="font-semibold text-brand hover:underline"
          >
            {isCreate ? "Sign in" : "Create one"}
          </button>
        </p>

        <div className="mt-6 border-t border-zinc-100 pt-4">
          <button
            onClick={() => {
              setAdvancedOpen((v) => !v);
              setMethod(null);
            }}
            className="mx-auto flex items-center gap-1 text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-800"
          >
            {advancedOpen ? "Hide other options" : "Other sign-in options"}
            <ChevronDown
              className={`size-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>

          {advancedOpen && (
            <div className="mt-3">
              {method === null && (
                <div className="space-y-1.5">
                  <AdvancedRow
                    icon={Radio}
                    title="Signer app"
                    subtitle="Amber, nsec.app or Nostrify"
                    onClick={() => setMethod("signer")}
                  />
                  <AdvancedRow
                    icon={Puzzle}
                    title="Browser extension"
                    subtitle="Alby or nos2x"
                    onClick={() => setMethod("extension")}
                  />
                  <AdvancedRow
                    icon={KeyRound}
                    title="Private key"
                    subtitle="Use a key you already have"
                    onClick={() => setMethod("key")}
                  />
                </div>
              )}

              {method && (
                <button
                  onClick={() => setMethod(null)}
                  className="mb-2 flex items-center gap-1 text-[11.5px] font-medium text-zinc-400 hover:text-zinc-700"
                >
                  <ChevronLeft className="size-3.5" /> Back
                </button>
              )}

              {method === "signer" && (
                <div className="space-y-3">
                  <div className="flex gap-1 rounded-full bg-zinc-100 p-1 text-[11.5px] font-medium">
                    {(["qr", "link"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSignerMode(m)}
                        className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${signerMode === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
                      >
                        {m === "qr" ? "Scan QR code" : "Paste a link"}
                      </button>
                    ))}
                  </div>
                  {signerMode === "qr" ? (
                    <>
                      <div className="mx-auto grid size-40 place-items-center rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                        {connectUri ? (
                          <QRCodeSVG value={connectUri} size={136} level="M" />
                        ) : (
                          <Loader2 className="size-6 animate-spin text-zinc-400" />
                        )}
                      </div>
                      <p className="text-center text-[11.5px] text-zinc-500">
                        {waitingConnect
                          ? "Waiting for your signer to approve…"
                          : "Scan with your signer app to connect."}
                      </p>
                      {connectUri && (
                        <button
                          onClick={() => {
                            void navigator.clipboard.writeText(connectUri);
                            toast.success("Connection link copied");
                          }}
                          className="mx-auto flex items-center gap-1.5 text-[11.5px] font-semibold text-brand"
                        >
                          <Copy className="size-3.5" /> Copy link
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <input
                        value={bunker}
                        onChange={(e) => setBunker(e.target.value)}
                        placeholder="bunker://…"
                        className={`${inputCls} font-mono text-[12px]`}
                      />
                      <PrimaryBtn
                        className="w-full"
                        disabled={!bunker.trim() || !!busy}
                        onClick={() =>
                          void run(
                            "Connecting…",
                            () => nostr.signInWithBunker(bunker),
                            "Connected to your signer",
                          )
                        }
                      >
                        {busy ? (
                          <>
                            <Loader2 className="size-4 animate-spin" /> {busy}
                          </>
                        ) : (
                          "Connect"
                        )}
                      </PrimaryBtn>
                    </>
                  )}
                </div>
              )}

              {method === "extension" && (
                <div className="space-y-3">
                  <p className="text-center text-[12px] leading-relaxed text-zinc-500">
                    Your extension keeps the key and signs for you. Crays never sees it.
                  </p>
                  <PrimaryBtn
                    className="w-full"
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        "Connecting…",
                        () => nostr.signInWithNip07(),
                        "Signed in with your extension",
                      )
                    }
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> {busy}
                      </>
                    ) : (
                      "Connect extension"
                    )}
                  </PrimaryBtn>
                </div>
              )}

              {method === "key" && (
                <div className="space-y-3">
                  <input
                    value={nsec}
                    onChange={(e) => setNsec(e.target.value)}
                    type="password"
                    autoComplete="off"
                    placeholder="nsec1…"
                    className={`${inputCls} font-mono text-[12px]`}
                  />
                  <PrimaryBtn
                    className="w-full"
                    disabled={!nsec.trim() || !!busy}
                    onClick={() =>
                      void run(
                        "Verifying key…",
                        () => nostr.signInWithNsec(nsec),
                        "Signed in with your private key",
                      )
                    }
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> {busy}
                      </>
                    ) : (
                      "Sign in with private key"
                    )}
                  </PrimaryBtn>
                  {isCreate && (
                    <button
                      onClick={() =>
                        void run(
                          "Creating your key…",
                          async () => {
                            await nostr.createLocalAccount();
                          },
                          "Account created",
                        )
                      }
                      disabled={!!busy}
                      className="w-full text-center text-[11.5px] font-medium text-zinc-400 hover:text-zinc-700 disabled:opacity-60"
                    >
                      No key yet? Create one on this device instead
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <Lock className="size-3" /> Your keys never leave your device.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function AdvancedRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
    >
      <Icon className="size-4 shrink-0 text-zinc-500" />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-zinc-800">{title}</span>
        <span className="block truncate text-[11px] text-zinc-400">{subtitle}</span>
      </span>
      <ArrowRight className="ml-auto size-3.5 shrink-0 text-zinc-300" />
    </button>
  );
}

// suppress unused
void Sparkles;
void FileText;
void Mic;
void Plus;
void Share2;
void X;
