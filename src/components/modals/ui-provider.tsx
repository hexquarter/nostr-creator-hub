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
export function UIProvider({ children }: { children: ReactNode }) {
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

  const value = useMemo<UICtx>(
    () => ({
      openZap: (o) => setZap(o ?? {}),
      openCompose: (o) => setCompose(o ?? { mode: "post" }),
      openUnlock: (o) => setUnlock(o ?? {}),
      openShare: (o) => setShare(o ?? {}),
      openUpgrade: () => setUpgrade(true),
      openSend: () => setSend(true),
      openReceive: () => setReceive(true),
      openTopUp: () => setTopup(true),
      openTxDetail: (t) => setTx(t),
      openEditProfile: () => setEditProfile(true),
      openLinkBlock: (e) => setLinkBlock(e ?? null),
      openNewDM: () => setNewDM(true),
      openAddRelay: () => setAddRelay(true),
      openRevealKey: () => setRevealKey(true),
      openLogoutConfirm: () => setLogout(true),
      openCommandPalette: () => setCmd(true),
      openImagePicker: () => setImagePicker(true),
      openPollBuilder: () => setPollBuilder(true),
    }),
    [],
  );

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
      <LogoutConfirm open={logout} onClose={() => setLogout(false)} />
      <CommandPalette open={cmd} onOpenChange={setCmd} />
      <ImagePickerModal open={imagePicker} onClose={() => setImagePicker(false)} />
      <PollBuilderModal open={pollBuilder} onClose={() => setPollBuilder(false)} />
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
function ComposeModal({ open, onClose, options }: { open: boolean; onClose: () => void; options: ComposeOptions }) {
  const [tab, setTab] = useState<"post" | "article" | "poll">(options.mode === "article" ? "article" : options.mode === "poll" ? "poll" : "post");
  const [text, setText] = useState("");
  const [premium, setPremium] = useState(false);
  useEffect(() => {
    if (open) {
      setTab(options.mode === "article" ? "article" : options.mode === "poll" ? "poll" : "post");
      setText("");
      setPremium(false);
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
          <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3.5 py-2.5 ring-1 ring-amber-100">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-amber-600" />
              <span className="text-[12.5px] font-semibold text-amber-900">Paywall (premium)</span>
            </div>
            <button
              onClick={() => setPremium((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${premium ? "bg-amber-500" : "bg-zinc-300"}`}
            >
              <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform ${premium ? "translate-x-4" : ""}`} />
            </button>
          </div>
        </div>
        <DialogFooter>
          <GhostBtn onClick={onClose}>Cancel</GhostBtn>
          <PrimaryBtn
            onClick={() => {
              toast.success(tab === "article" ? "Article published" : tab === "poll" ? "Poll posted" : "Posted to Nostr");
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
function LogoutConfirm({ open, onClose }: { open: boolean; onClose: () => void }) {
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
            onClick={() => { toast.success("Logged out"); onClose(); }}
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

// suppress unused
void Sparkles; void FileText; void Mic; void Plus; void Share2; void X;
