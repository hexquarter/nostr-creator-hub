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
  EyeOff,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Crays" },
      { name: "description", content: "Manage your account, keys, relays, wallet and privacy on Crays." },
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

const relays = [
  { url: "wss://relay.damus.io", status: "Connected", reads: true, writes: true },
  { url: "wss://nos.lol", status: "Connected", reads: true, writes: true },
  { url: "wss://relay.snort.social", status: "Connected", reads: true, writes: false },
  { url: "wss://relay.nostr.band", status: "Slow", reads: true, writes: true },
];

function Settings() {
  const [showKey, setShowKey] = useState(false);

  return (
    <PageShell title="Settings" subtitle="Tune Crays to your taste — keys, relays, notifications and more.">
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
                <span className={`block text-[11px] ${i === 0 ? "text-brand/70" : "text-zinc-400"}`}>
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
                <AvatarTile seed="Alex Stellar" size={72} rounded="xl" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="rounded-lg bg-zinc-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-black">
                  Upload avatar
                </button>
                <button className="rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200">
                  Remove
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Display name" defaultValue="Alex Stellar" />
              <Field label="Handle" defaultValue="alex" prefix="@" />
              <Field label="Lightning address" defaultValue="alex@crays.net" />
              <Field label="Website" defaultValue="https://stellar.app" />
              <div className="sm:col-span-2">
                <Label>Bio</Label>
                <textarea
                  rows={3}
                  defaultValue="Building the open creator economy. Long-form on macro, Bitcoin and design. Powered by zaps, not ads."
                  className="w-full resize-none rounded-xl bg-white px-3 py-2.5 text-[13.5px] text-zinc-900 ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
            </div>
          </Panel>

          {/* Keys */}
          <Panel title="Keys & identity" desc="Your npub is public. Your nsec is everything — never share it.">
            <div className="space-y-3">
              <KeyRow
                label="Public key (npub)"
                value="npub1q9rk5l9smc3w4hk7xkfny0pl…u7e2x"
              />
              <KeyRow
                label="Private key (nsec)"
                value={showKey ? "nsec1xkqf3w5l8m7…d2e9x4kpd0n8a7" : "nsec1•••••••••••••••••••••••••••••"}
                trailing={
                  <button
                    onClick={() => setShowKey((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200"
                  >
                    {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                    {showKey ? "Hide" : "Reveal"}
                  </button>
                }
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="rounded-lg bg-zinc-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-black">
                Backup keys
              </button>
              <button className="rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200">
                Connect signer (NIP-07)
              </button>
            </div>
          </Panel>

          {/* Relays */}
          <Panel title="Relays" desc="The servers that store and broadcast your posts.">
            <ul className="divide-y divide-zinc-100">
              {relays.map((r) => (
                <li key={r.url} className="flex items-center gap-4 py-3">
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      r.status === "Slow" ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12.5px] font-medium text-zinc-900">
                      {r.url}
                    </p>
                    <p className="text-[11px] text-zinc-500">{r.status}</p>
                  </div>
                  <Toggle label="Read" on={r.reads} />
                  <Toggle label="Write" on={r.writes} />
                  <button className="text-[11px] font-semibold text-zinc-400 hover:text-rose-500">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button className="mt-4 rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200">
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
              {/* <PrefRow title="Weekly digest" desc="A Sunday summary by email" /> */}
            </ul>
          </Panel>

          {/* Danger zone */}
          <Panel title="Logout">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50/60 p-4 ring-1 ring-rose-200/60">
              <div>
                <p className="text-[13px] font-semibold text-rose-700">You can sign-out to change account and return anytime using your Nostr identity keys.</p>
              </div>
              <button className="rounded-lg bg-rose-600 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-rose-700">
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
        <h3 className={`text-[15px] font-semibold ${tone === "danger" ? "text-rose-700" : "text-zinc-900"}`}>
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
  defaultValue,
  prefix,
}: {
  label: string;
  defaultValue: string;
  prefix?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center rounded-xl bg-white ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-brand/40">
        {prefix && <span className="pl-3 text-[13.5px] text-zinc-400">{prefix}</span>}
        <input
          defaultValue={defaultValue}
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
        <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-zinc-700">{value}</code>
        {trailing}
        <button className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200">
          <Copy className="size-3" /> Copy
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, on }: { label: string; on: boolean }) {
  return (
    <label className="hidden items-center gap-1.5 text-[11px] font-medium text-zinc-500 sm:flex">
      <span>{label}</span>
      <span
        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
          on ? "bg-brand" : "bg-zinc-300"
        }`}
      >
        <span
          className={`inline-block size-3 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
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
