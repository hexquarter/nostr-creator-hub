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
import { fetchProfile, normalizePubkey, pubkeyToNpub } from "@/lib/nostr/profiles";
import { addRelay, getCustomRelays, removeRelay } from "@/lib/nostr/relays";
import { useBtcPrice, satsToUsd, formatUsd } from "@/lib/nostr/price";
import { requestPaymentInvoice, isLightningInvoice } from "@/lib/nostr/zaps";
import {
  fetchInstagramPost,
  fetchRemoteImage,
  parseInstagramUrl,
  type ImportedPost,
} from "@/lib/instagram";
import { readInstagramExportFile, type InstagramExport } from "@/lib/instagram-export";
import { base64ToBytes } from "@/lib/crypto";
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
  Camera,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  Lock,
  Loader2,
  Pencil,
  LogIn,
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
type UnlockOptions = { title?: string; sats?: number };
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
  openImportInstagram: () => void;

  openZap: (o?: ZapOptions) => void;
  openCompose: (o?: ComposeOptions) => void;
  openUnlock: (o?: UnlockOptions) => void;
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
  const [importIG, setImportIG] = useState(false);

  const [zap, setZap] = useState<ZapOptions | null>(null);
  const [compose, setCompose] = useState<ComposeOptions | null>(null);
  const [unlock, setUnlock] = useState<UnlockOptions | null>(null);
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
      openImportInstagram: () => {
        if (!user) {
          setAuth({ intent: "import your Instagram content" });
          return;
        }
        setImportIG(true);
      },

      openZap: (o) => gate("send a zap", () => setZap(o ?? {})),
      openCompose: (o) => gate("post to Nostr", () => setCompose(o ?? { mode: "post" })),
      openUnlock: (o) => gate("unlock premium content", () => setUnlock(o ?? {})),
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
      <UnlockModal open={!!unlock} onClose={() => setUnlock(null)} options={unlock ?? {}} />
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
      <ImportInstagramModal open={importIG} onClose={() => setImportIG(false)} />
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
  const [tab, setTab] = useState<"post" | "article" | "poll">(
    options.mode === "article" ? "article" : options.mode === "poll" ? "poll" : "post",
  );
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pollOptions, setPollOptions] = useState(["", "", ""]);
  const [premium, setPremium] = useState(false);
  const [price, setPrice] = useState(500);
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
      if (premium) tags.push(["premium", String(price)]);
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
            <ToggleRow
              icon={<Crown className="size-4 text-amber-600" />}
              title="Members only"
              hint={
                premium
                  ? `Only paying members can open this post (${price.toLocaleString()} sats).`
                  : "Free for everyone."
              }
              tone="amber"
              on={premium}
              onToggle={() => setPremium((v) => !v)}
            />
            {premium && (
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-amber-50/60 p-2 ring-1 ring-amber-100">
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

// ---------- Unlock ----------
function UnlockModal({
  open,
  onClose,
  options,
}: {
  open: boolean;
  onClose: () => void;
  options: UnlockOptions;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-amber-500" />
            Unlock premium content
          </DialogTitle>
          <DialogDescription>{options.title ?? "This post is behind a paywall."}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center ring-1 ring-amber-100">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">
            One-time unlock
          </p>
          <p className="mt-1 text-[32px] font-bold tracking-tight text-zinc-900">
            {options.sats ?? 500} sats
          </p>
          <p className="text-[11.5px] text-zinc-500">
            ≈ ${((options.sats ?? 500) * 0.00064).toFixed(2)} USD · pays the creator directly
          </p>
        </div>
        <ul className="space-y-1.5 text-[12.5px] text-zinc-600">
          <li className="flex gap-2">
            <Check className="size-4 text-emerald-500" /> Full article + media
          </li>
          <li className="flex gap-2">
            <Check className="size-4 text-emerald-500" /> Saved to your library
          </li>
          <li className="flex gap-2">
            <Check className="size-4 text-emerald-500" /> Or subscribe for $49/mo unlimited
          </li>
        </ul>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Maybe later</GhostBtn>
          <PrimaryBtn
            className="!bg-amber-500 hover:!bg-amber-600"
            onClick={() => {
              toast.success("Unlocked — enjoy the read");
              onClose();
            }}
          >
            <Zap className="size-4" /> Pay {options.sats ?? 500} sats
          </PrimaryBtn>
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
function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ui = useUI();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-amber-500" />
            Creator toolkit
          </DialogTitle>
          <DialogDescription>
            Everything Crays adds on top of the open Nostr protocol. No subscription, no platform
            cut.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-5 text-white">
          <p className="text-[28px] font-bold tracking-tight">Free</p>
          <p className="text-[12px] text-zinc-400">
            You pay only Lightning network fees when you zap or get paid.
          </p>
        </div>
        <ul className="space-y-1.5 text-[12.5px] text-zinc-700">
          {[
            "Passkey sign-in — no seed phrase to remember",
            "Publish notes and long-form articles to Nostr",
            "Receive zaps straight to your Lightning wallet",
            "Import your Instagram posts in a few clicks",
            "Media hosted on Blossom, embedded in your events",
            "Encrypted direct messages over NIP-04",
          ].map((f) => (
            <li key={f} className="flex gap-2">
              <Check className="size-4 text-emerald-500" /> {f}
            </li>
          ))}
        </ul>
        <DialogFooter className="gap-2 sm:justify-between">
          <GhostBtn onClick={onClose}>Close</GhostBtn>
          <div className="flex gap-2">
            <GhostBtn
              onClick={() => {
                onClose();
                ui.openImportInstagram();
              }}
            >
              Import Instagram
            </GhostBtn>
            <PrimaryBtn
              onClick={() => {
                onClose();
                ui.openCompose({ mode: "post" });
              }}
            >
              Write a post
            </PrimaryBtn>
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
              : "Connect a Lightning wallet to receive payments."}
          </DialogDescription>
        </DialogHeader>
        {!nostr.wallet.connected ? (
          <WalletConnectBlock />
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
          {nostr.wallet.connected && (
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
          )}
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
  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search posts, creators, commands…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>
            <Home className="size-4" /> Home
          </CommandItem>
          <CommandItem onSelect={() => go("/discover")}>
            <Compass className="size-4" /> Discover
          </CommandItem>
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
              ui.openImportInstagram();
            }}
          >
            <Camera className="size-4" /> Import from Instagram
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
type AuthTab = "passkey" | "nostr" | "keys";
type NostrSub = "bunker" | "nostr-connect" | "nip07";

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
  const [tab, setTab] = useState<AuthTab>("passkey");
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [busy, setBusy] = useState<null | string>(null);
  const [nostrSub, setNostrSub] = useState<NostrSub>("bunker");
  const [bunker, setBunker] = useState("");
  const [nsec, setNsec] = useState("");
  const [connectUri, setConnectUri] = useState("");
  const [waitingConnect, setWaitingConnect] = useState(false);
  const connectStarted = useRef(false);

  useEffect(() => {
    if (open) {
      setTab("passkey");
      setMode("signin");
      setBusy(null);
      setNostrSub("bunker");
      setBunker("");
      setNsec("");
      setConnectUri("");
      setWaitingConnect(false);
      connectStarted.current = false;
    }
  }, [open]);

  // Kick off the NIP-46 nostr-connect handshake the first time that pane opens.
  useEffect(() => {
    if (!open || nostrSub !== "nostr-connect" || connectStarted.current) return;
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
  }, [open, nostrSub]);

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

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-brand" />
            {mode === "create" ? "Create your account" : "Connect to Crays"}
          </DialogTitle>
          <DialogDescription>
            {options.intent
              ? `Sign in to ${options.intent}. Your identity is yours — you can leave anytime.`
              : "Passkey-first. Nostr-native. Your keys, your account, your audience."}
          </DialogDescription>
        </DialogHeader>

        {/* Sign in / Create toggle */}
        <div className="flex gap-1 rounded-full bg-zinc-100 p-1 text-[12px] font-medium w-fit self-center">
          {(["signin", "create"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 transition-colors ${mode === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        {/* Method tabs */}
        <div className="mt-1 grid grid-cols-3 gap-2">
          <TabCard
            active={tab === "passkey"}
            onClick={() => setTab("passkey")}
            icon={Fingerprint}
            title="Passkey"
            badge="Recommended"
          />
          <TabCard
            active={tab === "nostr"}
            onClick={() => setTab("nostr")}
            icon={Radio}
            title="Nostr signer"
          />
          <TabCard
            active={tab === "keys"}
            onClick={() => setTab("keys")}
            icon={KeyRound}
            title="nsec"
          />
        </div>

        <div className="mt-1 min-h-[200px]">
          {tab === "passkey" && (
            <div className="space-y-3">
              <p className="text-[12.5px] text-zinc-600">
                {mode === "create"
                  ? "Create an account secured by your device — Face ID, Touch ID or Windows Hello. No password, no seed to lose. Your Nostr key is generated on-device and wrapped by the passkey."
                  : "Use the passkey stored on this device or a hardware key to sign in instantly."}
              </p>
              <ul className="space-y-1.5 text-[12px] text-zinc-500">
                <li className="flex gap-2">
                  <Check className="size-4 text-emerald-500" /> Phishing-resistant
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 text-emerald-500" /> Syncs across your Apple / Google
                  devices
                </li>
                <li className="flex gap-2">
                  <Check className="size-4 text-emerald-500" /> Export your nsec anytime
                </li>
              </ul>
              <PrimaryBtn
                className="w-full"
                disabled={!!busy}
                onClick={() =>
                  void run(
                    "Waiting for passkey…",
                    () => nostr.signInWithPasskey(mode).then(() => undefined),
                    mode === "create" ? "Account created" : "Signed in with your passkey",
                  )
                }
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {busy}
                  </>
                ) : (
                  <>
                    <Fingerprint className="size-4" />{" "}
                    {mode === "create" ? "Create with passkey" : "Continue with passkey"}
                  </>
                )}
              </PrimaryBtn>
              <p className="text-center text-[11px] text-zinc-400">
                Works with iCloud Keychain, Google Password Manager and security keys.
              </p>
            </div>
          )}

          {tab === "nostr" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: "bunker", label: "Bunker" },
                    { id: "nostr-connect", label: "Nostr Connect" },
                    { id: "nip07", label: "Extension" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setNostrSub(o.id)}
                    className={`rounded-lg px-2 py-2 text-[11.5px] font-semibold ring-1 transition-colors ${
                      nostrSub === o.id
                        ? "bg-zinc-900 text-white ring-zinc-900"
                        : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {nostrSub === "bunker" && (
                <>
                  <p className="text-[12.5px] text-zinc-600">
                    Paste a{" "}
                    <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">bunker://</code>{" "}
                    URI from your remote signer (nsec.app, Amber, Nostrify…).
                  </p>
                  <Field label="Bunker URI">
                    <input
                      value={bunker}
                      onChange={(e) => setBunker(e.target.value)}
                      placeholder="bunker://npub…?relay=wss://…"
                      className={`${inputCls} font-mono text-[12px]`}
                    />
                  </Field>
                  <PrimaryBtn
                    className="w-full"
                    disabled={!bunker.trim() || !!busy}
                    onClick={() =>
                      void run(
                        "Connecting to signer…",
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
                      "Connect signer"
                    )}
                  </PrimaryBtn>
                </>
              )}
              {nostrSub === "nostr-connect" && (
                <>
                  <p className="text-[12.5px] text-zinc-600">
                    Scan this with Amber, Nostrify, nsec.app or any NIP-46 signer.
                  </p>
                  <div className="mx-auto grid size-44 place-items-center rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                    {connectUri ? (
                      <QRCodeSVG value={connectUri} size={152} level="M" />
                    ) : (
                      <Loader2 className="size-6 animate-spin text-zinc-400" />
                    )}
                  </div>
                  {connectUri && (
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(connectUri);
                        toast.success("Connection link copied");
                      }}
                      className="mx-auto flex items-center gap-1.5 text-[11.5px] font-semibold text-brand"
                    >
                      <Copy className="size-3.5" /> Copy connection link
                    </button>
                  )}
                  <p className="text-center text-[11.5px] text-zinc-500">
                    {waitingConnect
                      ? "Waiting for your signer to approve…"
                      : "Open the link in your signer app if the QR doesn't work."}
                  </p>
                </>
              )}
              {nostrSub === "nip07" && (
                <>
                  <p className="text-[12.5px] text-zinc-600">
                    Use a browser extension like Alby or nos2x. Crays never touches your key — the
                    extension signs each event.
                  </p>
                  <PrimaryBtn
                    className="w-full"
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        "Talking to your extension…",
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
                </>
              )}
            </div>
          )}

          {tab === "keys" && (
            <div className="space-y-3">
              {mode === "create" ? (
                <>
                  <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-100">
                    <p className="text-[12px] font-semibold text-amber-800">
                      A fresh Nostr key will be generated on this device.
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-amber-700">
                      Back up your nsec after signing in. Lose it and you lose the account.
                    </p>
                  </div>
                  <PrimaryBtn
                    className="w-full"
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        "Generating keys…",
                        async () => {
                          await nostr.createLocalAccount();
                        },
                        "Account created",
                      )
                    }
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> {busy}
                      </>
                    ) : (
                      "Generate my keys"
                    )}
                  </PrimaryBtn>
                </>
              ) : (
                <>
                  <Field
                    label="Private key (nsec)"
                    hint="Stored encrypted in this browser only. Prefer a passkey or signer."
                  >
                    <input
                      value={nsec}
                      onChange={(e) => setNsec(e.target.value)}
                      type="password"
                      autoComplete="off"
                      placeholder="nsec1…"
                      className={`${inputCls} font-mono text-[12px]`}
                    />
                  </Field>
                  <PrimaryBtn
                    className="w-full"
                    disabled={!nsec.trim() || !!busy}
                    onClick={() =>
                      void run(
                        "Verifying key…",
                        () => nostr.signInWithNsec(nsec),
                        "Signed in with your nsec",
                      )
                    }
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> {busy}
                      </>
                    ) : (
                      "Sign in with nsec"
                    )}
                  </PrimaryBtn>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-lg bg-zinc-50 p-2.5 text-[11.5px] text-zinc-500 ring-1 ring-zinc-100">
          <ShieldCheck className="size-3.5 text-zinc-400" />
          Crays never sees your private key. Signing happens on your device or your signer.
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TabCard({
  active,
  onClick,
  icon: Icon,
  title,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl px-3 py-3 text-left transition-colors ${
        active
          ? "bg-zinc-900 text-white ring-1 ring-zinc-900"
          : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      <Icon className={`size-4 ${active ? "text-white" : "text-zinc-500"}`} />
      <p className="mt-1.5 text-[12.5px] font-semibold">{title}</p>
      {badge && (
        <span
          className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${active ? "bg-white/15 text-white" : "bg-brand/10 text-brand"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ---------- Import from Instagram (onboarding + sidebar) ----------
function ImportInstagramModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nostr = useNostr();
  const [step, setStep] = useState<"connect" | "select" | "done">("connect");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [posts, setPosts] = useState<ImportedPost[]>([]);
  const [exported, setExported] = useState<InstagramExport | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep("connect");
      setLink("");
      setBusy(null);
      setPosts([]);
      setExported(null);
      setError("");
    }
  }, [open]);

  const fetchLink = async () => {
    setBusy("Fetching the post…");
    setError("");
    try {
      const parsed = parseInstagramUrl(link);
      if (!parsed) throw new Error("Paste a public Instagram post link, like instagram.com/p/…");
      const post = await fetchInstagramPost({ data: { url: link } });
      setPosts([{ ...post, id: post.shortcode, imageUrl: post.thumbnail, selected: true }]);
      setStep("select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that post.");
    } finally {
      setBusy(null);
    }
  };

  const loadExport = async (file: File) => {
    setBusy("Reading your export…");
    setError("");
    try {
      const result = await readInstagramExportFile(file);
      setExported(result);
      setPosts(result.posts);
      setStep("select");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(null);
    }
  };

  const importSelected = async () => {
    const chosen = posts.filter((post) => post.selected !== false);
    if (chosen.length === 0) return;
    setBusy(`Importing 0/${chosen.length}…`);
    setError("");
    let imported = 0;
    const failures: string[] = [];

    for (const [index, post] of chosen.entries()) {
      setBusy(`Importing ${index + 1}/${chosen.length}…`);
      try {
        let images: string[] = [];
        if (post.imagePath && exported) {
          const media = exported.readMedia(post.imagePath);
          if (media) images = [await nostr.uploadMedia(media.bytes, media.mime)];
        } else if (post.imageUrl) {
          try {
            const remote = await fetchRemoteImage({ data: { url: post.imageUrl } });
            images = [await nostr.uploadMedia(base64ToBytes(remote.base64), remote.mime)];
          } catch {
            // Instagram may block the media fetch; publish the caption anyway.
          }
        }

        const content = [
          post.caption.trim(),
          post.permalink ? `Originally posted on Instagram: ${post.permalink}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");
        if (!content.trim()) continue;

        const tags: string[][] = [["t", "instagram-import"]];
        if (post.permalink) tags.push(["r", post.permalink]);
        await nostr.publish({ content, images, tags, createdAt: post.createdAt });
        imported += 1;
      } catch (err) {
        failures.push(err instanceof Error ? err.message : "unknown error");
      }
    }

    setBusy(null);
    if (imported === 0) {
      setError(failures[0] ?? "Nothing could be imported.");
      return;
    }
    if (failures.length) {
      toast.error(`${imported} imported, ${failures.length} failed.`);
    } else {
      toast.success(`${imported} posts imported to Nostr`);
    }
    setStep("done");
  };

  const selectedCount = posts.filter((post) => post.selected !== false).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-fuchsia-500" />
            Import from Instagram
          </DialogTitle>
          <DialogDescription>
            Bring your posts over to Nostr. Captions are re-published as events signed by your key,
            and images are re-hosted on Blossom.
          </DialogDescription>
        </DialogHeader>

        {step === "connect" && (
          <div className="space-y-3">
            <Field label="Link to a public post" hint="We fetch the caption and cover image.">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://www.instagram.com/p/…"
                className={inputCls}
              />
            </Field>
            <GhostBtn
              className="w-full"
              disabled={!link.trim() || !!busy}
              onClick={() => void fetchLink()}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {busy}
                </>
              ) : (
                <>
                  Fetch post <ArrowRight className="size-4" />
                </>
              )}
            </GhostBtn>

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-zinc-400">
              <span className="h-px flex-1 bg-zinc-200" /> or{" "}
              <span className="h-px flex-1 bg-zinc-200" />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
              <div>
                <p className="text-[12.5px] font-semibold text-zinc-800">
                  Upload your Instagram export
                </p>
                <p className="text-[11px] text-zinc-500">
                  Settings → Your activity → Download your information (JSON)
                </p>
              </div>
              <GhostBtn disabled={!!busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Upload .zip"}
              </GhostBtn>
              <input
                ref={fileRef}
                type="file"
                accept=".zip,.json,application/zip,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void loadExport(file);
                }}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 p-2.5 text-[11.5px] text-rose-700 ring-1 ring-rose-100">
                {error}
              </p>
            )}

            <GhostBtn className="w-full" onClick={onClose}>
              Skip for now
            </GhostBtn>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-zinc-800">Select posts to import</p>
              <div className="flex gap-2 text-[11.5px] font-semibold text-brand">
                <button onClick={() => setPosts((p) => p.map((x) => ({ ...x, selected: true })))}>
                  All
                </button>
                <span className="text-zinc-300">·</span>
                <button onClick={() => setPosts((p) => p.map((x) => ({ ...x, selected: false })))}>
                  None
                </button>
              </div>
            </div>
            <ul className="max-h-[300px] space-y-1.5 overflow-auto pr-1">
              {posts.map((post) => {
                const on = post.selected !== false;
                const preview = post.imageUrl;
                return (
                  <li key={post.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-zinc-100 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setPosts((all) =>
                            all.map((x) =>
                              x.id === post.id ? { ...x, selected: e.target.checked } : x,
                            ),
                          )
                        }
                        className="size-4 accent-brand"
                      />
                      {preview ? (
                        <img
                          src={preview}
                          alt=""
                          className="size-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-400 via-orange-300 to-amber-300 text-white">
                          <Camera className="size-4" />
                        </div>
                      )}
                      <p className="flex-1 truncate text-[12.5px] text-zinc-800">
                        {post.caption || "Untitled post"}
                      </p>
                      <span className="text-[10.5px] text-zinc-400">IG</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-2.5 text-[11.5px] text-blue-800 ring-1 ring-blue-100">
              <ShieldCheck className="size-3.5" />
              Original captions & media are re-published as Nostr events signed by your key.
            </div>
            {error && <p className="text-[11.5px] text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <GhostBtn className="flex-1" disabled={!!busy} onClick={() => setStep("connect")}>
                Back
              </GhostBtn>
              <PrimaryBtn
                className="flex-1"
                disabled={!!busy || selectedCount === 0}
                onClick={() => void importSelected()}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {busy}
                  </>
                ) : (
                  `Import ${selectedCount}`
                )}
              </PrimaryBtn>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-3 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600">
              <Check className="size-7" />
            </div>
            <p className="text-[14px] font-semibold text-zinc-900">All set</p>
            <p className="text-[12.5px] text-zinc-500">
              Your posts have been published to your relays. Followers can now discover them on
              Nostr.
            </p>
            <PrimaryBtn className="w-full" onClick={onClose}>
              Done
            </PrimaryBtn>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// suppress unused
void Sparkles;
void FileText;
void Mic;
void Plus;
void Share2;
void X;
