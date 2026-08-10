import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";


// ---------- Types ----------
type ZapOptions = { recipient?: string; postTitle?: string };
type UnlockOptions = { title?: string; sats?: number };
type ShareOptions = { url?: string; title?: string };
type ComposeOptions = { mode?: "post" | "article" | "poll" | "reply"; replyTo?: string };
type TxDetail = { id: string; who: string; note: string; amount: string; usd: string; time: string; kind: "in" | "out" };

export type AuthMethod = "passkey" | "bunker" | "nostr-connect" | "nwc" | "keys";
export type AuthUser = { name: string; handle: string; npub: string; method: AuthMethod };
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
const AUTH_STORAGE_KEY = "crays.auth.user";

export function UIProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
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

  // hydrate persisted mock session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {}
  }, []);

  const signIn = useCallback((u: AuthUser) => {
    setUser(u);
    try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u)); } catch {}
  }, []);
  const signOut = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch {}
    toast.success("Signed out");
  }, []);

  const value = useMemo<UICtx>(() => {
    const gate = (intent: string, run: () => void) => {
      if (user) { run(); return true; }
      setAuth({ intent });
      return false;
    };
    return {
      user,
      signOut,
      requireAuth: (intent, cb) => gate(intent, () => cb?.()),
      openAuth: (o) => setAuth(o ?? {}),
      openImportInstagram: () => {
        if (!user) { setAuth({ intent: "import your Instagram content" }); return; }
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
      <ComposeModal open={!!compose} onClose={() => setCompose(null)} options={compose ?? { mode: "post" }} />
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
        onSignIn={(u) => { signIn(u); setAuth(null); setImportIG(true); }}
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
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-zinc-400">{hint}</span>}
    </label>
  );
}
const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

// ---------- Zap ----------
function ZapModal({ open, onClose, options }: { open: boolean; onClose: () => void; options: ZapOptions }) {
  const presets = [21, 100, 500, 1000, 5000, 21000];
  const [amount, setAmount] = useState(500);
  const [note, setNote] = useState("");
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
            {options.recipient ? `To ${options.recipient}` : "Reward great content with sats."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center ring-1 ring-amber-100">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">Amount</p>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="w-32 bg-transparent text-center text-[36px] font-bold tracking-tight text-zinc-900 outline-none"
              />
              <span className="text-[13px] font-medium text-zinc-500">sats</span>
            </div>
            <p className="text-[11.5px] text-zinc-500">≈ ${(amount * 0.00064).toFixed(2)} USD</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={`rounded-lg py-2 text-[12px] font-semibold ring-1 transition-colors ${
                  amount === p ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
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
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            className="!bg-amber-500 hover:!bg-amber-600"
            onClick={() => {
              toast.success(`Zapped ${amount.toLocaleString()} sats ⚡`);
              onClose();
            }}
          >
            <Zap className="size-4" /> Send zap
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
        <span className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
      </button>
    </div>
  );
}

function ComposeModal({ open, onClose, options }: { open: boolean; onClose: () => void; options: ComposeOptions }) {
  const [tab, setTab] = useState<"post" | "article" | "poll">(options.mode === "article" ? "article" : options.mode === "poll" ? "poll" : "post");
  const [text, setText] = useState("");
  const [premium, setPremium] = useState(false);
  const [price, setPrice] = useState(500);
  const [sensitive, setSensitive] = useState(false);
  const [reason, setReason] = useState<SensitiveReason>("Nudity");
  const [warning, setWarning] = useState("");
  useEffect(() => {
    if (open) {
      setTab(options.mode === "article" ? "article" : options.mode === "poll" ? "poll" : "post");
      setText("");
      setPremium(false);
      setPrice(500);
      setSensitive(false);
      setReason("Nudity");
      setWarning("");
    }
  }, [open, options.mode]);

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
            <input className={inputCls} placeholder="Article title…" />
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
              {[1, 2, 3].map((i) => (
                <input key={i} className={inputCls} placeholder={`Option ${i}`} />
              ))}
              <button className="text-[12px] font-semibold text-brand">+ Add option</button>
            </div>
          )}
          <div className="space-y-2">
            <ToggleRow
              icon={<Crown className="size-4 text-amber-600" />}
              title="Members only"
              hint={premium ? "Only paying members can open this post." : "Free for everyone."}
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
                      price === p ? "bg-white text-amber-900 shadow-sm ring-1 ring-amber-200" : "text-amber-800/70"
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
          <PrimaryBtn
            onClick={() => {
              toast.success(tab === "article" ? "Article published" : tab === "poll" ? "Poll posted" : "Posted to Nostr", {
                description: [
                  premium ? `Members only · ${price.toLocaleString()} sats` : null,
                  sensitive ? `Marked sensitive · ${reason}${warning ? ` — ${warning}` : ""}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined,
              });
              onClose();
            }}
          >
            {tab === "article" ? "Publish" : "Post"}
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Unlock ----------
function UnlockModal({ open, onClose, options }: { open: boolean; onClose: () => void; options: UnlockOptions }) {
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
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-700">One-time unlock</p>
          <p className="mt-1 text-[32px] font-bold tracking-tight text-zinc-900">{options.sats ?? 500} sats</p>
          <p className="text-[11.5px] text-zinc-500">≈ ${((options.sats ?? 500) * 0.00064).toFixed(2)} USD · pays the creator directly</p>
        </div>
        <ul className="space-y-1.5 text-[12.5px] text-zinc-600">
          <li className="flex gap-2"><Check className="size-4 text-emerald-500" /> Full article + media</li>
          <li className="flex gap-2"><Check className="size-4 text-emerald-500" /> Saved to your library</li>
          <li className="flex gap-2"><Check className="size-4 text-emerald-500" /> Or subscribe for $49/mo unlimited</li>
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
function ShareModal({ open, onClose, options }: { open: boolean; onClose: () => void; options: ShareOptions }) {
  const url = options.url ?? "https://crays.net/p/abc";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
          <DialogDescription>{options.title ?? "Send this post anywhere."}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2">
          <LinkIcon className="size-4 text-zinc-400" />
          <input readOnly value={url} className="flex-1 bg-transparent text-[12.5px] text-zinc-700 outline-none" />
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
  const [trial, setTrial] = useState(true);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="size-5 text-amber-500" />
            Become a Creator
          </DialogTitle>
          <DialogDescription>Everything you need to publish, monetize and grow.</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-5 text-white">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[40px] font-bold tracking-tight">$49</span>
            <span className="text-[13px] text-zinc-400">/month</span>
          </div>
          <p className="text-[12px] text-zinc-400">Cancel anytime · 7-day free trial</p>
        </div>
        <ul className="space-y-1.5 text-[12.5px] text-zinc-700">
          {["Paid subscribers (Lightning)", "Long-form publishing & paywalls", "Link-in-bio page", "Spaces hosting", "Analytics dashboard"].map((f) => (
            <li key={f} className="flex gap-2"><Check className="size-4 text-emerald-500" /> {f}</li>
          ))}
        </ul>
        <label className="flex items-center justify-between rounded-xl bg-zinc-50 px-3.5 py-2.5">
          <span className="text-[12.5px] font-semibold text-zinc-700">Start with 7-day free trial</span>
          <button
            onClick={() => setTrial((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${trial ? "bg-emerald-500" : "bg-zinc-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform ${trial ? "translate-x-4" : ""}`} />
          </button>
        </label>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Not now</GhostBtn>
          <PrimaryBtn
            onClick={() => {
              toast.success(trial ? "Free trial started — welcome!" : "Welcome to Creator");
              onClose();
            }}
          >
            {trial ? "Start free trial" : "Subscribe · $49/mo"}
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Send / Receive / Top-up ----------
function SendModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowUpRight className="size-5" /> Send sats</DialogTitle>
          <DialogDescription>Paste a Lightning invoice or address.</DialogDescription>
        </DialogHeader>
        <Field label="Destination" hint="lnbc… or you@wallet.com">
          <textarea value={dest} onChange={(e) => setDest(e.target.value)} rows={3} className={`${inputCls} resize-none font-mono text-[12px]`} placeholder="lnbc1…" />
        </Field>
        <Field label="Amount (sats)">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="0" />
        </Field>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            disabled={!dest || !amount}
            onClick={() => {
              toast.success(`Sent ${amount} sats`);
              onClose();
            }}
          >
            <Send className="size-4" /> Send
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function ReceiveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState(1000);
  const addr = "you@crays.net";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ArrowDownLeft className="size-5" /> Receive sats</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl bg-zinc-50 p-5 text-center ring-1 ring-zinc-100">
          <div className="mx-auto grid size-44 place-items-center rounded-xl bg-white p-3 shadow-sm">
            <FauxQR />
          </div>
          <p className="mt-3 font-mono text-[12px] text-zinc-700">{addr}</p>
          <button
            onClick={() => { navigator.clipboard?.writeText(addr); toast.success("Address copied"); }}
            className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:underline"
          ><Copy className="size-3" /> Copy</button>
        </div>
        <Field label="Amount (optional)">
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={inputCls} />
        </Field>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Close</GhostBtn>
          <PrimaryBtn onClick={() => { toast.success("Invoice copied"); onClose(); }}>
            Generate invoice
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function TopUpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [method, setMethod] = useState<"card" | "exchange">("card");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CreditCard className="size-5" /> Top up wallet</DialogTitle>
          <DialogDescription>Buy sats with card or transfer from an exchange.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(["card", "exchange"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-xl px-3 py-3 text-left text-[12.5px] font-semibold ring-1 transition-colors ${
                method === m ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {m === "card" ? "Credit card" : "From exchange"}
              <p className={`mt-1 text-[10.5px] font-medium ${method === m ? "text-zinc-300" : "text-zinc-500"}`}>
                {m === "card" ? "Apple Pay · Google Pay" : "Strike, River, Coinbase"}
              </p>
            </button>
          ))}
        </div>
        <Field label="Amount (USD)">
          <input type="number" defaultValue={20} className={inputCls} />
        </Field>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={() => { toast.success("Top-up in progress"); onClose(); }}>
            Continue
          </PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
              <p className={`text-[14px] font-bold tabular-nums ${tx.kind === "in" ? "text-emerald-600" : "text-zinc-900"}`}>{tx.amount}</p>
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
              <GhostBtn className="flex-1" onClick={() => { navigator.clipboard?.writeText(tx.id); toast.success("Tx ID copied"); }}>
                <Copy className="size-4" /> Copy ID
              </GhostBtn>
              <PrimaryBtn className="flex-1" onClick={onClose}>Done</PrimaryBtn>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------- Edit profile ----------
function EditProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Your public face on Nostr.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <AvatarTile seed="Alex Stellar" size={64} />
            <button className="rounded-lg bg-zinc-100 px-3 py-2 text-[12px] font-semibold hover:bg-zinc-200">Change photo</button>
          </div>
          <Field label="Display name"><input defaultValue="Alex Stellar" className={inputCls} /></Field>
          <Field label="Handle"><input defaultValue="@alex" className={inputCls} /></Field>
          <Field label="Bio"><textarea rows={3} defaultValue="Building the open creator economy." className={`${inputCls} resize-none`} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location"><input defaultValue="Lisbon, PT" className={inputCls} /></Field>
            <Field label="Website"><input defaultValue="stellar.app" className={inputCls} /></Field>
          </div>
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={() => { toast.success("Profile saved"); onClose(); }}>Save</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Link block ----------
function LinkBlockModal({ open, existing, onClose }: { open: boolean; existing: { title: string; url: string } | null; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit link" : "Add link block"}</DialogTitle>
          <DialogDescription>Appears on your link-in-bio page.</DialogDescription>
        </DialogHeader>
        <Field label="Title"><input defaultValue={existing?.title ?? ""} placeholder="My latest essay" className={inputCls} /></Field>
        <Field label="URL"><input defaultValue={existing?.url ?? ""} placeholder="https://…" className={inputCls} /></Field>
        <Field label="Subtitle (optional)"><input className={inputCls} placeholder="Read on Crays" /></Field>
        <DialogFooter>
          {existing && <GhostBtn className="!text-rose-600 mr-auto" onClick={() => { toast.success("Link removed"); onClose(); }}>Delete</GhostBtn>}
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={() => { toast.success(existing ? "Link updated" : "Link added"); onClose(); }}>{existing ? "Save" : "Add"}</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- New DM ----------
function NewDMModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const suggestions = ["Jack Dorsey", "Lyn Alden", "Elena Vega", "Marty Bent", "Pierre Rochard"];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>End-to-end encrypted on Nostr.</DialogDescription>
        </DialogHeader>
        <input placeholder="Search by name or npub…" className={inputCls} />
        <ul className="space-y-1">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                onClick={() => { navigate({ to: "/messages" }); toast.success(`Started chat with ${s}`); onClose(); }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-zinc-50"
              >
                <AvatarTile seed={s} size={36} />
                <div>
                  <p className="text-[13px] font-semibold text-zinc-900">{s}</p>
                  <p className="text-[11px] text-zinc-500">@{s.toLowerCase().replace(/[^a-z]/g, "")}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Add relay ----------
function AddRelayModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Server className="size-5" /> Add relay</DialogTitle>
          <DialogDescription>Relays store and broadcast your Nostr posts.</DialogDescription>
        </DialogHeader>
        <Field label="Relay URL" hint="wss://relay.example.com">
          <input className={`${inputCls} font-mono`} placeholder="wss://" />
        </Field>
        <div className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5">
          <span className="text-[12.5px] font-semibold text-zinc-700">Read & write</span>
          <span className="text-[11px] text-zinc-500">Default</span>
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={() => { toast.success("Relay connected"); onClose(); }}>Add relay</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Reveal key ----------
function RevealKeyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const nsec = "nsec1q9k7m4hc2vplh3yffx8zh2k9j7n4mfqyrqzc83lz5d3vk8w7nxxsv0plkz";
  useEffect(() => { if (!open) setRevealed(false); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-rose-600">⚠ Reveal your secret key</DialogTitle>
          <DialogDescription>
            Your nsec controls your identity. Anyone with it can post as you and drain your funds. Store it in a password manager.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-zinc-900 p-4 font-mono text-[11.5px] break-all text-zinc-100">
          {revealed ? nsec : "•".repeat(60)}
        </div>
        <div className="flex gap-2">
          <GhostBtn className="flex-1" onClick={() => setRevealed((v) => !v)}>
            {revealed ? <><EyeOff className="size-4" /> Hide</> : <><Eye className="size-4" /> Reveal</>}
          </GhostBtn>
          <GhostBtn
            className="flex-1"
            onClick={() => { navigator.clipboard?.writeText(nsec); toast.success("Key copied — store it safely"); }}
          >
            <Copy className="size-4" /> Copy
          </GhostBtn>
        </div>
        <DialogFooter><PrimaryBtn onClick={onClose}>Done</PrimaryBtn></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Logout confirm ----------
function LogoutConfirm({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
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
            onClick={() => { onConfirm(); onClose(); }}
          >
            Log out
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Command palette ----------
function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const go = (to: string) => { onOpenChange(false); navigate({ to }); };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search posts, creators, commands…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}><Home className="size-4" /> Home</CommandItem>
          <CommandItem onSelect={() => go("/discover")}><Compass className="size-4" /> Discover</CommandItem>
          <CommandItem onSelect={() => go("/following")}><Users className="size-4" /> Following</CommandItem>
          <CommandItem onSelect={() => go("/messages")}><MessageCircle className="size-4" /> Messages</CommandItem>
          <CommandItem onSelect={() => go("/notifications")}><Bell className="size-4" /> Notifications</CommandItem>
          <CommandItem onSelect={() => go("/bookmarks")}><Bookmark className="size-4" /> Bookmarks</CommandItem>
          <CommandItem onSelect={() => go("/premium")}><Crown className="size-4" /> Premium</CommandItem>
          <CommandItem onSelect={() => go("/wallet")}><Wallet className="size-4" /> Wallet</CommandItem>
          <CommandItem onSelect={() => go("/profile")}><User className="size-4" /> Profile</CommandItem>
          <CommandItem onSelect={() => go("/settings")}><Cog className="size-4" /> Settings</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Creators">
          {["Lyn Alden", "Jack Dorsey", "Marty Bent", "Elena Vega"].map((n) => (
            <CommandItem key={n} onSelect={() => { onOpenChange(false); toast.success(`Opening ${n}`); }}>
              <span className="grid size-5 place-items-center rounded-full bg-zinc-200 text-[9px] font-bold text-zinc-700">{n[0]}</span>
              {n}
            </CommandItem>
          ))}
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
          <DialogTitle className="flex items-center gap-2"><ImageIcon className="size-5" /> Attach media</DialogTitle>
        </DialogHeader>
        <div className="grid place-items-center rounded-xl border-2 border-dashed border-zinc-200 px-6 py-10 text-center hover:border-brand/40 hover:bg-brand/5">
          <ImageIcon className="size-8 text-zinc-300" />
          <p className="mt-2 text-[13px] font-semibold text-zinc-700">Drag & drop or click to upload</p>
          <p className="text-[11px] text-zinc-500">JPG · PNG · GIF · MP4 up to 25 MB</p>
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={() => { toast.success("Image attached"); onClose(); }}>Use sample</PrimaryBtn>
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
          <DialogTitle className="flex items-center gap-2"><BarChart3 className="size-5" /> Create a poll</DialogTitle>
        </DialogHeader>
        <Field label="Question"><input className={inputCls} placeholder="Will BTC close above $X?" /></Field>
        {[1, 2, 3, 4].map((i) => (
          <input key={i} className={inputCls} placeholder={`Option ${i}${i > 2 ? " (optional)" : ""}`} />
        ))}
        <Field label="Duration">
          <select className={inputCls}>
            <option>1 day</option><option>3 days</option><option>1 week</option>
          </select>
        </Field>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn onClick={() => { toast.success("Poll posted"); onClose(); }}>Post poll</PrimaryBtn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Decorative QR ----------
function FauxQR() {
  const cells = Array.from({ length: 11 * 11 }, (_, i) => {
    const x = i % 11, y = Math.floor(i / 11);
    const corner = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
    return corner || ((x * 73 + y * 131 + (x ^ y) * 17) % 7 < 3);
  });
  return (
    <div className="grid h-full w-full grid-cols-11 gap-[1.5px]">
      {cells.map((on, i) => <div key={i} className={`rounded-[2px] ${on ? "bg-zinc-900" : "bg-white"}`} />)}
    </div>
  );
}

// ---------- Auth Modal ----------
type AuthTab = "passkey" | "nostr" | "keys";
type NostrSub = "bunker" | "nostr-connect" | "nwc";

function AuthModal({
  open,
  options,
  onClose,
  onSignIn,
}: {
  open: boolean;
  options: AuthOptions;
  onClose: () => void;
  onSignIn: (u: AuthUser) => void;
}) {
  const [tab, setTab] = useState<AuthTab>("passkey");
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [busy, setBusy] = useState<null | string>(null);
  const [nostrSub, setNostrSub] = useState<NostrSub>("bunker");
  const [bunker, setBunker] = useState("");
  const [nsec, setNsec] = useState("");
  const [npub, setNpub] = useState("");

  useEffect(() => {
    if (open) {
      setTab("passkey");
      setMode("signin");
      setBusy(null);
      setNostrSub("bunker");
      setBunker("");
      setNsec("");
      setNpub("");
    }
  }, [open]);

  const finish = (method: AuthMethod, name = "You Stellar", handle = "@you") => {
    setBusy(null);
    onSignIn({
      name,
      handle,
      method,
      npub: "npub1q9rk5l9smc3w4hk7xkfny0pl" + Math.random().toString(36).slice(2, 6) + "u7e2x",
    });
    toast.success(`Signed in with ${labelFor(method)}`);
  };

  const runWithSpinner = (label: string, method: AuthMethod) => {
    setBusy(label);
    setTimeout(() => finish(method), 900);
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
          <TabCard active={tab === "passkey"} onClick={() => setTab("passkey")} icon={Fingerprint} title="Passkey" badge="Recommended" />
          <TabCard active={tab === "nostr"} onClick={() => setTab("nostr")} icon={Radio} title="Nostr signer" />
          <TabCard active={tab === "keys"} onClick={() => setTab("keys")} icon={KeyRound} title="npub / nsec" />
        </div>

        <div className="mt-1 min-h-[180px]">
          {tab === "passkey" && (
            <div className="space-y-3">
              <p className="text-[12.5px] text-zinc-600">
                {mode === "create"
                  ? "Create an account secured by your device — Face ID, Touch ID or Windows Hello. No password, no seed to lose. Your Nostr key is generated on-device and wrapped by the passkey."
                  : "Use the passkey stored on this device or a hardware key to sign in instantly."}
              </p>
              <ul className="space-y-1.5 text-[12px] text-zinc-500">
                <li className="flex gap-2"><Check className="size-4 text-emerald-500" /> Phishing-resistant</li>
                <li className="flex gap-2"><Check className="size-4 text-emerald-500" /> Syncs across your Apple / Google devices</li>
                <li className="flex gap-2"><Check className="size-4 text-emerald-500" /> Export your nsec anytime</li>
              </ul>
              <PrimaryBtn
                className="w-full"
                disabled={!!busy}
                onClick={() => runWithSpinner("Waiting for passkey…", "passkey")}
              >
                {busy ? <><Loader2 className="size-4 animate-spin" /> {busy}</> : (<><Fingerprint className="size-4" /> {mode === "create" ? "Create with passkey" : "Continue with passkey"}</>)}
              </PrimaryBtn>
            </div>
          )}

          {tab === "nostr" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { id: "bunker", label: "Bunker" },
                  { id: "nostr-connect", label: "Nostr Connect" },
                  { id: "nwc", label: "NWC" },
                ] as const).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setNostrSub(o.id)}
                    className={`rounded-lg px-2 py-2 text-[11.5px] font-semibold ring-1 transition-colors ${
                      nostrSub === o.id ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {nostrSub === "bunker" && (
                <>
                  <p className="text-[12.5px] text-zinc-600">Paste a <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">bunker://</code> URI from your remote signer.</p>
                  <Field label="Bunker URI">
                    <input value={bunker} onChange={(e) => setBunker(e.target.value)} placeholder="bunker://npub…?relay=wss://…" className={`${inputCls} font-mono text-[12px]`} />
                  </Field>
                  <PrimaryBtn className="w-full" disabled={!bunker || !!busy} onClick={() => runWithSpinner("Connecting to signer…", "bunker")}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> {busy}</> : "Connect signer"}
                  </PrimaryBtn>
                </>
              )}
              {nostrSub === "nostr-connect" && (
                <>
                  <p className="text-[12.5px] text-zinc-600">Scan this QR from Amber, Nostrify, Alby or any NIP-46 signer.</p>
                  <div className="mx-auto grid size-40 place-items-center rounded-xl bg-white p-3 ring-1 ring-zinc-200"><FauxQR /></div>
                  <PrimaryBtn className="w-full" disabled={!!busy} onClick={() => runWithSpinner("Waiting for signer approval…", "nostr-connect")}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> {busy}</> : "I've scanned it"}
                  </PrimaryBtn>
                </>
              )}
              {nostrSub === "nwc" && (
                <>
                  <p className="text-[12.5px] text-zinc-600">Connect a Nostr Wallet Connect string to sign & zap in one place.</p>
                  <Field label="NWC connection">
                    <input value={bunker} onChange={(e) => setBunker(e.target.value)} placeholder="nostr+walletconnect://…" className={`${inputCls} font-mono text-[12px]`} />
                  </Field>
                  <PrimaryBtn className="w-full" disabled={!bunker || !!busy} onClick={() => runWithSpinner("Pairing wallet…", "nwc")}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> {busy}</> : "Pair wallet"}
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
                    <p className="text-[12px] font-semibold text-amber-800">A fresh Nostr key will be generated for you.</p>
                    <p className="mt-0.5 text-[11.5px] text-amber-700">You'll be prompted to back up your nsec after signing in. Lose it and you lose the account.</p>
                  </div>
                  <PrimaryBtn className="w-full" disabled={!!busy} onClick={() => runWithSpinner("Generating keys…", "keys")}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> {busy}</> : "Generate my keys"}
                  </PrimaryBtn>
                </>
              ) : (
                <>
                  <Field label="Public key (npub) — optional">
                    <input value={npub} onChange={(e) => setNpub(e.target.value)} placeholder="npub1…" className={`${inputCls} font-mono text-[12px]`} />
                  </Field>
                  <Field label="Private key (nsec)" hint="Stored locally in your browser only. Prefer passkey or a signer.">
                    <input value={nsec} onChange={(e) => setNsec(e.target.value)} type="password" placeholder="nsec1…" className={`${inputCls} font-mono text-[12px]`} />
                  </Field>
                  <PrimaryBtn className="w-full" disabled={!nsec || !!busy} onClick={() => runWithSpinner("Verifying key…", "keys")}>
                    {busy ? <><Loader2 className="size-4 animate-spin" /> {busy}</> : "Sign in with nsec"}
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

function labelFor(m: AuthMethod) {
  return {
    passkey: "Passkey",
    bunker: "Bunker",
    "nostr-connect": "Nostr Connect",
    nwc: "Nostr Wallet Connect",
    keys: "nsec",
  }[m];
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
        active ? "bg-zinc-900 text-white ring-1 ring-zinc-900" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
      }`}
    >
      <Icon className={`size-4 ${active ? "text-white" : "text-zinc-500"}`} />
      <p className="mt-1.5 text-[12.5px] font-semibold">{title}</p>
      {badge && (
        <span className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${active ? "bg-white/15 text-white" : "bg-brand/10 text-brand"}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ---------- Import from Instagram (onboarding + sidebar) ----------
function ImportInstagramModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"connect" | "select" | "done">("connect");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [posts, setPosts] = useState<Array<{ id: number; caption: string; on: boolean }>>([]);

  useEffect(() => {
    if (open) { setStep("connect"); setHandle(""); setBusy(false); setPosts([]); }
  }, [open]);

  const connect = () => {
    setBusy(true);
    setTimeout(() => {
      setPosts(
        Array.from({ length: 8 }, (_, i) => ({
          id: i,
          caption: [
            "Sunset over Lisbon",
            "Studio setup 2026",
            "New essay: The open creator economy",
            "Behind the scenes",
            "Chart of the day",
            "Podcast with Elena Vega",
            "Trip to Prague",
            "Coffee & Bitcoin",
          ][i],
          on: true,
        })),
      );
      setBusy(false);
      setStep("select");
    }, 900);
  };

  const importSel = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setStep("done");
      toast.success(`${posts.filter((p) => p.on).length} posts imported to Nostr`);
    }, 900);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-fuchsia-500" />
            Import from Instagram
          </DialogTitle>
          <DialogDescription>
            Bring your existing audience & content into Nostr. This is a preview — no data is fetched yet.
          </DialogDescription>
        </DialogHeader>

        {step === "connect" && (
          <div className="space-y-3">
            <Field label="Instagram handle" hint="We'll fetch your public posts. Private accounts can upload an export.">
              <input value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))} placeholder="yourhandle" className={inputCls} />
            </Field>
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-100">
              <div>
                <p className="text-[12.5px] font-semibold text-zinc-800">Or upload IG data export</p>
                <p className="text-[11px] text-zinc-500">Settings → Your activity → Download your information</p>
              </div>
              <GhostBtn onClick={() => toast("Upload coming soon")}>Upload .zip</GhostBtn>
            </div>
            <div className="flex gap-2">
              <GhostBtn className="flex-1" onClick={onClose}>Skip for now</GhostBtn>
              <PrimaryBtn className="flex-1" disabled={!handle || busy} onClick={connect}>
                {busy ? <><Loader2 className="size-4 animate-spin" /> Connecting…</> : (<>Connect <ArrowRight className="size-4" /></>)}
              </PrimaryBtn>
            </div>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-semibold text-zinc-800">Select posts to import</p>
              <div className="flex gap-2 text-[11.5px] font-semibold text-brand">
                <button onClick={() => setPosts((p) => p.map((x) => ({ ...x, on: true })))}>All</button>
                <span className="text-zinc-300">·</span>
                <button onClick={() => setPosts((p) => p.map((x) => ({ ...x, on: false })))}>None</button>
              </div>
            </div>
            <ul className="max-h-[280px] space-y-1.5 overflow-auto pr-1">
              {posts.map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-2.5 ring-1 ring-zinc-100 hover:bg-zinc-50">
                    <input
                      type="checkbox"
                      checked={p.on}
                      onChange={(e) => setPosts((all) => all.map((x) => x.id === p.id ? { ...x, on: e.target.checked } : x))}
                      className="size-4 accent-brand"
                    />
                    <div className="size-10 shrink-0 rounded-lg bg-gradient-to-br from-fuchsia-400 via-orange-300 to-amber-300" />
                    <p className="flex-1 truncate text-[12.5px] text-zinc-800">{p.caption}</p>
                    <span className="text-[10.5px] text-zinc-400">IG</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-2.5 text-[11.5px] text-blue-800 ring-1 ring-blue-100">
              <ShieldCheck className="size-3.5" />
              Original captions & media are re-published as Nostr events signed by your key.
            </div>
            <div className="flex gap-2">
              <GhostBtn className="flex-1" onClick={() => setStep("connect")}>Back</GhostBtn>
              <PrimaryBtn className="flex-1" disabled={busy || !posts.some((p) => p.on)} onClick={importSel}>
                {busy ? <><Loader2 className="size-4 animate-spin" /> Importing…</> : `Import ${posts.filter((p) => p.on).length}`}
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
              Your posts have been published to your relays. Followers can now discover them on Nostr.
            </p>
            <PrimaryBtn className="w-full" onClick={onClose}>Done</PrimaryBtn>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// suppress unused
void Sparkles; void FileText; void Mic; void Plus; void Share2; void X;

