import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import {
  User,
  Key,
  Bell,
  Wallet,
  Globe,
  Shield,
  Palette,
  Server,
  ChevronRight,
  Copy,
  Eye,
  Loader2,
  Camera,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { getCustomRelays, getRelayList, removeRelay } from "@/lib/nostr/relays";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Crays" },
      {
        name: "description",
        content: "Manage your account, keys, relays, wallet and privacy on Crays.",
      },
    ],
  }),
  component: Settings,
});

const sections = [
  { id: "account", icon: User, label: "Account", desc: "Display name, handle, bio" },
  { id: "keys", icon: Key, label: "Keys & identity", desc: "Backup and rotate keys" },
  { id: "relays", icon: Server, label: "Relays", desc: "Where your posts live" },
  { id: "wallet", icon: Wallet, label: "Wallet", desc: "Lightning address & limits" },
  { id: "notifications", icon: Bell, label: "Notifications", desc: "Email and in-app alerts" },
  { id: "privacy", icon: Shield, label: "Privacy & safety", desc: "Mutes, blocks, encryption" },
  { id: "appearance", icon: Palette, label: "Appearance", desc: "Theme and density" },
  { id: "language", icon: Globe, label: "Language & region", desc: "Currency and locale" },
];

function Settings() {
  const ui = useUI();
  const nostr = useNostr();
  const profile = nostr.account?.profile;
  const [relays, setRelays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    about: "",
    lud16: "",
    website: "",
  });

  useEffect(() => {
    setForm({
      name: profile?.name ?? "",
      displayName: profile?.displayName ?? "",
      about: profile?.about ?? "",
      lud16: profile?.lud16 ?? profile?.lud06 ?? "",
      website: profile?.website ?? "",
    });
  }, [
    profile?.name,
    profile?.displayName,
    profile?.about,
    profile?.lud16,
    profile?.lud06,
    profile?.website,
  ]);

  useEffect(() => {
    setRelays(getRelayList());
  }, []);

  const save = async () => {
    if (!nostr.account) {
      ui.openAuth({ intent: "edit your profile" });
      return;
    }
    setSaving(true);
    try {
      await nostr.updateProfile({
        name: form.name.trim(),
        displayName: form.displayName.trim() || form.name.trim(),
        about: form.about.trim(),
        lud16: form.lud16.trim(),
        website: form.website.trim(),
      });
      toast.success("Profile saved to your relays");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const npub = nostr.account?.npub ?? "Sign in to see your public key";
  const canReveal = Boolean(nostr.account?.canExportKey);

  return (
    <PageShell
      title="Settings"
      subtitle="Tune Crays to your taste — keys, relays, notifications and more."
    >
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Side nav */}
        <aside className="space-y-1 rounded-2xl bg-white p-2 shadow-card ring-1 ring-black/5 lg:self-start">
          {sections.map((s, i) => (
            <button
              key={s.id}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                i === 0 ? "bg-brand/10 text-brand" : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <s.icon
                className={`size-4 shrink-0 ${i === 0 ? "text-brand" : "text-zinc-400"}`}
                strokeWidth={2}
              />
              <span className="flex-1">
                <span className="block text-[13px] font-semibold">{s.label}</span>
                <span
                  className={`block text-[11px] ${i === 0 ? "text-brand/70" : "text-zinc-400"}`}
                >
                  {s.desc}
                </span>
              </span>
              <ChevronRight className="size-3.5 text-zinc-300" />
            </button>
          ))}
        </aside>

        <div className="space-y-6">
          {/* Account card */}
          <Panel title="Account" desc="How others see you across the protocol.">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="rounded-2xl bg-white p-1.5 shadow-card ring-1 ring-black/5">
                {profile?.picture ? (
                  <img
                    src={profile.picture}
                    alt=""
                    className="size-[72px] rounded-xl object-cover"
                  />
                ) : (
                  <AvatarTile
                    seed={profile?.displayName || profile?.name || "You"}
                    size={72}
                    rounded="xl"
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => ui.openEditProfile()}
                  className="rounded-lg bg-zinc-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-black"
                >
                  <Camera className="mr-1 inline size-3.5" /> Edit picture
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving || !nostr.account}
                  className="rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save changes"}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                label="Display name"
                value={form.displayName}
                onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
              />
              <Field
                label="Handle"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                prefix="@"
              />
              <Field
                label="Lightning address"
                value={form.lud16}
                onChange={(v) => setForm((f) => ({ ...f, lud16: v }))}
              />
              <Field
                label="Website"
                value={form.website}
                onChange={(v) => setForm((f) => ({ ...f, website: v }))}
              />
              <div className="sm:col-span-2">
                <Label>Bio</Label>
                <textarea
                  rows={3}
                  value={form.about}
                  onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                  placeholder="Tell people what you create…"
                  className="w-full resize-none rounded-xl bg-white px-3 py-2.5 text-[13.5px] text-zinc-900 ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
            </div>
          </Panel>

          {/* Keys */}
          <Panel
            title="Keys & identity"
            desc="Your npub is public. Your nsec is everything — never share it."
          >
            <div className="space-y-3">
              <KeyRow label="Public key (npub)" value={npub} />
              <KeyRow
                label="Private key (nsec)"
                value={canReveal ? "nsec1•••••••••••••••••••••••••••••" : "Managed by your signer"}
                trailing={
                  canReveal ? (
                    <button
                      onClick={ui.openRevealKey}
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200"
                    >
                      <Eye className="size-3" /> Reveal
                    </button>
                  ) : undefined
                }
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={ui.openRevealKey}
                disabled={!canReveal}
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                Backup keys
              </button>
              <button
                onClick={() =>
                  nostr.account
                    ? void nostr.signInWithNip07().catch((e) => toast.error(e.message))
                    : ui.openAuth()
                }
                className="rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200"
              >
                Connect signer (NIP-07)
              </button>
            </div>
          </Panel>

          {/* Relays */}
          <Panel title="Relays" desc="The servers that store and broadcast your posts.">
            <ul className="divide-y divide-zinc-100">
              {relays.map((url) => {
                const custom = getCustomRelays().includes(url);
                return (
                  <li key={url} className="flex items-center gap-4 py-3">
                    <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[12.5px] font-medium text-zinc-900">
                        {url}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {custom ? "Custom relay" : "Default relay"} · read & write
                      </p>
                    </div>
                    {custom && (
                      <button
                        onClick={() => {
                          removeRelay(url);
                          setRelays(getRelayList());
                          toast.success(`Removed ${url}`);
                        }}
                        className="text-[11px] font-semibold text-zinc-400 hover:text-rose-500"
                      >
                        Remove
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              onClick={ui.openAddRelay}
              className="mt-4 rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200"
            >
              Add relay
            </button>
          </Panel>

          {/* Notifications */}
          <Panel title="Notifications" desc="Decide what reaches your inbox.">
            <ul className="divide-y divide-zinc-100">
              <PrefRow title="Zaps" desc="Someone sends you sats" on />
              <PrefRow title="Replies & mentions" desc="People talking to you" on />
              <PrefRow title="New followers" desc="When someone follows you" on />
              <PrefRow title="Premium subscribers" desc="New paid subscribers" on />
            </ul>
          </Panel>

          {/* Danger zone */}
          <Panel title="Logout">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50/60 p-4 ring-1 ring-rose-200/60">
              <div>
                <p className="text-[13px] font-semibold text-rose-700">
                  {nostr.account
                    ? "Sign out to switch accounts. You can return anytime with your Nostr key or passkey."
                    : "You are signed out."}
                </p>
              </div>
              <button
                onClick={ui.openLogoutConfirm}
                disabled={!nostr.account}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}

function Panel({
  title,
  desc,
  children,
  tone,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 sm:p-6">
      <header className="mb-5">
        <h3
          className={`text-[15px] font-semibold ${tone === "danger" ? "text-rose-700" : "text-zinc-900"}`}
        >
          {title}
        </h3>
        {desc && <p className="mt-0.5 text-[12.5px] text-zinc-500">{desc}</p>}
      </header>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center rounded-xl bg-white ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand/40">
        {prefix && <span className="pl-3 text-[13.5px] text-zinc-400">{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-3 py-2.5 text-[13.5px] text-zinc-900 outline-none"
        />
      </div>
    </div>
  );
}

function KeyRow({
  label,
  value,
  trailing,
}: {
  label: string;
  value: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-black/5">
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-zinc-700">
          {value}
        </code>
        {trailing}
        <button
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("Copied");
          }}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200"
        >
          <Copy className="size-3" /> Copy
        </button>
      </div>
    </div>
  );
}

function PrefRow({ title, desc, on }: { title: string; desc: string; on?: boolean }) {
  return (
    <li className="flex items-center justify-between py-3.5">
      <div>
        <p className="text-[13px] font-semibold text-zinc-900">{title}</p>
        <p className="text-[11.5px] text-zinc-500">{desc}</p>
      </div>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          on ? "bg-brand" : "bg-zinc-300"
        }`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </li>
  );
}
