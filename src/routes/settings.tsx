import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import {
  User,
  Key,
  Bell,
  Wallet,
  Shield,
  Server,
  ChevronRight,
  Copy,
  Eye,
  Loader2,
  Camera,
  CreditCard,
  FlaskConical,
  Zap,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { getCustomRelays, getRelayList, invalidateQueries, removeRelay } from "@/lib/nostr/relays";
import { usePreferences, setPreferences } from "@/lib/preferences";
import {
  DEV_PAYMENTS_ENABLED,
  clearSimulatedPremiumAccess,
  setDevPaymentSettings,
  simulatePremiumAccess,
  useDevPaymentSettings,
} from "@/lib/payments/dev-payments";
import { creatorPassDaysLeft, isCreatorPassActive, useCreatorPass } from "@/lib/nostr/creator-pass";
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
  { id: "payments", icon: CreditCard, label: "Payments", desc: "Card or Lightning checkout" },
  { id: "keys", icon: Key, label: "Keys & identity", desc: "Backup and rotate keys" },
  { id: "relays", icon: Server, label: "Relays", desc: "Where your posts live" },
  { id: "wallet", icon: Wallet, label: "Wallet", desc: "Lightning address & payouts" },
  { id: "notifications", icon: Bell, label: "Notifications", desc: "Choose what reaches you" },
  { id: "privacy", icon: Shield, label: "Privacy & safety", desc: "Sensitive media and spam" },
];

function Settings() {
  const ui = useUI();
  const nostr = useNostr();
  const preferences = usePreferences();
  const devSettings = useDevPaymentSettings();
  const creatorPass = useCreatorPass();
  const profile = nostr.account?.profile;
  const [relays, setRelays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [nwcUri, setNwcUri] = useState("");
  const [active, setActive] = useState("account");
  const [form, setForm] = useState({
    name: "",
    displayName: "",
    about: "",
    lud16: "",
    website: "",
  });

  const address = nostr.wallet.address;
  const addressSource = nostr.wallet.addressSource;

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

  // Keep the side nav in sync with the section that is on screen.
  useEffect(() => {
    const elements = sections
      .map((section) => document.getElementById(`settings-${section.id}`))
      .filter((element): element is HTMLElement => Boolean(element));
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id.replace("settings-", ""));
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "auto", block: "start" });
  };

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

  const saveDerivedAddress = async () => {
    if (!nostr.account || !address) return;
    setSavingAddress(true);
    try {
      await nostr.updateProfile({ lud16: address });
      toast.success("Lightning address saved to your profile");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const connectWallet = async () => {
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

  const npub = nostr.account?.npub ?? "Sign in to see your public key";
  const canReveal = Boolean(nostr.account?.canExportKey);

  return (
    <PageShell
      title="Settings"
      subtitle="Tune Crays to your taste — keys, relays, notifications and more."
    >
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Side nav */}
        <aside className="space-y-1 rounded-2xl bg-white p-2 shadow-card ring-1 ring-black/5 lg:sticky lg:top-6 lg:self-start">
          {sections.map((section) => {
            const current = active === section.id;
            return (
              <button
                key={section.id}
                onClick={() => jump(section.id)}
                aria-current={current ? "true" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  current ? "bg-brand/10 text-brand" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                <section.icon
                  className={`size-4 shrink-0 ${current ? "text-brand" : "text-zinc-400"}`}
                  strokeWidth={2}
                />
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold">{section.label}</span>
                  <span
                    className={`block text-[11px] ${current ? "text-brand/70" : "text-zinc-400"}`}
                  >
                    {section.desc}
                  </span>
                </span>
                <ChevronRight className="size-3.5 text-zinc-300" />
              </button>
            );
          })}
        </aside>

        <div className="space-y-6">
          {/* Account card */}
          <Panel id="account" title="Account" desc="How others see you across the protocol.">
            {!nostr.account && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-black/5">
                <p className="text-[12.5px] text-zinc-600">
                  Sign in to edit the profile stored on your relays.
                </p>
                <button
                  onClick={() => ui.openAuth({ intent: "edit your profile" })}
                  className="rounded-lg bg-zinc-900 px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-black"
                >
                  Sign in
                </button>
              </div>
            )}
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
                  <Camera className="mr-1 inline size-3.5" /> Edit photo
                </button>
                <button
                  onClick={() => ui.openEditProfile()}
                  className="rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200"
                >
                  Change banner
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="mr-1 inline size-3.5 animate-spin" /> : null}
                  {saving ? "Saving…" : "Save changes"}
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
                hint="Leave blank to use the npub.cash address derived from your key."
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

          {/* Payments */}
          <Panel
            id="payments"
            title="Payments"
            desc="Choose how checkout looks when you buy memberships or unlock posts."
          >
            <ul className="divide-y divide-zinc-100">
              <PrefRow
                title="Advanced Lightning mode"
                desc="Use Lightning invoices, Nostr Wallet Connect and zaps instead of the default Apple Pay / card checkout."
                on={preferences.payments.advanced}
                onToggle={() =>
                  setPreferences({
                    payments: {
                      ...preferences.payments,
                      advanced: !preferences.payments.advanced,
                    },
                  })
                }
              />
            </ul>
            <div className="mt-4 rounded-xl bg-gradient-to-br from-zinc-50 to-amber-50/60 p-4 ring-1 ring-black/5">
              <p className="text-[12.5px] font-semibold text-zinc-900">
                Apple Pay or credit card for everyone
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-500">
                Fans don't need Bitcoin or a wallet: MoonPay takes Apple Pay, Google Pay or a card,
                then the creator is paid over Lightning. Advanced mode keeps Lightning and zaps
                available for Bitcoin-native fans.
              </p>
            </div>

            {DEV_PAYMENTS_ENABLED && (
              <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-800">
                  <FlaskConical className="size-3.5" /> Developer tools
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-600">
                  These controls only appear in <code>vite dev</code>, or in a build made with{" "}
                  <code>VITE_CRAYS_DEV_PAYMENTS=true</code>.
                </p>

                <div className="mt-3 divide-y divide-emerald-100 rounded-lg bg-white/70 px-3">
                  <PrefRow
                    title="Disable Lightning payments"
                    desc="Hide invoices, NWC and zaps in checkout so you can test the card-first flow only."
                    on={devSettings.disableLightning}
                    onToggle={() =>
                      setDevPaymentSettings({ disableLightning: !devSettings.disableLightning })
                    }
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {nostr.account ? (
                    <>
                      <button
                        onClick={() => {
                          try {
                            const pass = simulatePremiumAccess();
                            toast.success(
                              `Premium activated locally — ${creatorPassDaysLeft(pass)} days (dev)`,
                            );
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Couldn't simulate premium access.",
                            );
                          }
                        }}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-[12px] font-semibold text-white hover:bg-emerald-800"
                      >
                        Simulate premium access
                      </button>
                      <button
                        onClick={() => {
                          try {
                            clearSimulatedPremiumAccess();
                            toast.success("Local premium access cleared (dev)");
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Couldn't clear simulated premium access.",
                            );
                          }
                        }}
                        disabled={!creatorPass}
                        className="rounded-lg bg-white px-3 py-2 text-[12px] font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Clear simulated access
                      </button>
                      <span className="text-[11px] text-emerald-800">
                        {creatorPass && isCreatorPassActive(creatorPass)
                          ? `Active · ${creatorPassDaysLeft(creatorPass)} days left`
                          : "No local premium access"}
                      </span>
                    </>
                  ) : (
                    <span className="text-[11.5px] text-zinc-600">
                      Sign in to simulate premium access for your account.
                    </span>
                  )}
                </div>
              </div>
            )}
          </Panel>

          {/* Keys */}
          <Panel
            id="keys"
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
          <Panel id="relays" title="Relays" desc="The servers that store and broadcast your posts.">
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
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={ui.openAddRelay}
                className="rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200"
              >
                Add relay
              </button>
              <button
                onClick={() => {
                  invalidateQueries();
                  toast.success("Relay cache cleared");
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-3.5 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-200"
              >
                <RefreshCw className="size-3.5" /> Refresh from relays
              </button>
            </div>
          </Panel>

          {/* Wallet */}
          <Panel
            id="wallet"
            title="Wallet"
            desc="Your Lightning wallet is derived from your Nostr identity — no separate sign-up."
          >
            <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-black/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    Lightning address
                  </p>
                  <p className="mt-1 break-all font-mono text-[12.5px] text-zinc-800">
                    {address ?? "Sign in to derive your wallet"}
                  </p>
                </div>
                {address && (
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(address);
                      toast.success("Lightning address copied");
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 ring-1 ring-black/5 hover:bg-zinc-100"
                  >
                    <Copy className="size-3" /> Copy
                  </button>
                )}
              </div>
              {address && (
                <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
                  {addressSource === "profile"
                    ? "Read from your Nostr profile. Receiving works right away."
                    : "Derived from your Nostr key via npub.cash. Sats are held for you until you claim them with your Nostr key at npub.cash."}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {address && (
                  <button
                    onClick={() => ui.openReceive()}
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-black"
                  >
                    <Zap className="size-3" /> Receive sats
                  </button>
                )}
                {addressSource === "hosted" && nostr.account && (
                  <button
                    onClick={() => void saveDerivedAddress()}
                    disabled={savingAddress}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-[11.5px] font-semibold text-zinc-700 ring-1 ring-black/5 hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {savingAddress ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    Use on my profile
                  </button>
                )}
              </div>
            </div>

            {nostr.account ? (
              <div className="mt-4 rounded-xl border border-zinc-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[12.5px] font-semibold text-zinc-900">
                      {nostr.wallet.connected
                        ? "Sending wallet connected"
                        : "Add a wallet to send sats"}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-zinc-500">
                      {nostr.wallet.connected
                        ? `${nostr.wallet.alias ?? "NIP-47 wallet"}${nostr.wallet.network ? ` · ${nostr.wallet.network}` : ""}`
                        : "Connect a Nostr Wallet Connect (NIP-47) wallet for sending, invoices and zaps."}
                    </p>
                  </div>
                  {nostr.wallet.connected && (
                    <button
                      onClick={() => void nostr.disconnectWallet()}
                      className="rounded-lg bg-zinc-100 px-3 py-1.5 text-[11.5px] font-semibold text-zinc-700 hover:bg-zinc-200"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
                {!nostr.wallet.connected && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={nwcUri}
                      onChange={(e) => setNwcUri(e.target.value)}
                      placeholder="nostr+walletconnect://…"
                      className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-[11px] text-zinc-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <button
                      onClick={() => void connectWallet()}
                      disabled={!nwcUri.trim() || connecting}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black disabled:opacity-50"
                    >
                      {connecting ? <Loader2 className="size-4 animate-spin" /> : "Connect"}
                    </button>
                  </div>
                )}
                {nostr.wallet.error && (
                  <p className="mt-2 text-[11px] text-rose-600">{nostr.wallet.error}</p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-[11.5px] text-zinc-500">
                Sign in to connect a sending wallet. Receiving works from your derived address after
                you sign in.
              </p>
            )}
          </Panel>

          {/* Notifications */}
          <Panel
            id="notifications"
            title="Notifications"
            desc="Choose which activity shows up in your inbox."
          >
            <ul className="divide-y divide-zinc-100">
              <PrefRow
                title="Zaps"
                desc="Someone sends you sats"
                on={preferences.notifications.zaps}
                onToggle={() =>
                  setPreferences({
                    notifications: {
                      ...preferences.notifications,
                      zaps: !preferences.notifications.zaps,
                    },
                  })
                }
              />
              <PrefRow
                title="Replies & mentions"
                desc="People talking to you"
                on={preferences.notifications.replies}
                onToggle={() =>
                  setPreferences({
                    notifications: {
                      ...preferences.notifications,
                      replies: !preferences.notifications.replies,
                    },
                  })
                }
              />
              <PrefRow
                title="Reactions"
                desc="Hearts and emoji on your posts"
                on={preferences.notifications.reactions}
                onToggle={() =>
                  setPreferences({
                    notifications: {
                      ...preferences.notifications,
                      reactions: !preferences.notifications.reactions,
                    },
                  })
                }
              />
              <PrefRow
                title="Reposts"
                desc="When someone shares your post"
                on={preferences.notifications.reposts}
                onToggle={() =>
                  setPreferences({
                    notifications: {
                      ...preferences.notifications,
                      reposts: !preferences.notifications.reposts,
                    },
                  })
                }
              />
            </ul>
            <p className="mt-3 text-[11.5px] text-zinc-500">
              These filters apply instantly to the Notifications page in this browser.
            </p>
          </Panel>

          {/* Privacy */}
          <Panel
            id="privacy"
            title="Privacy & safety"
            desc="Control what Crays renders and which events reach your feed."
          >
            <ul className="divide-y divide-zinc-100">
              <PrefRow
                title="Show sensitive media"
                desc="Reveal posts marked sensitive without an extra tap"
                on={preferences.privacy.showSensitive}
                onToggle={() =>
                  setPreferences({
                    privacy: {
                      ...preferences.privacy,
                      showSensitive: !preferences.privacy.showSensitive,
                    },
                  })
                }
              />
              <PrefRow
                title="Hide spam from feeds"
                desc="Skip JSON blobs and relay spam"
                on={preferences.privacy.hideSpam}
                onToggle={() =>
                  setPreferences({
                    privacy: {
                      ...preferences.privacy,
                      hideSpam: !preferences.privacy.hideSpam,
                    },
                  })
                }
              />
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
  id,
  title,
  desc,
  children,
  tone,
}: {
  id?: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section
      id={id ? `settings-${id}` : undefined}
      className="scroll-mt-6 rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 sm:p-6"
    >
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
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  hint?: string;
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
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
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

function PrefRow({
  title,
  desc,
  on,
  onToggle,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-zinc-900">{title}</p>
        <p className="text-[11.5px] text-zinc-500">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        onClick={onToggle}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          on ? "bg-brand" : "bg-zinc-300"
        }`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </li>
  );
}
