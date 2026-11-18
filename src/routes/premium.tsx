import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { useBtcPrice, formatUsd } from "@/lib/nostr/price";
import { CreatorToolsHero } from "@/components/creator-tools-hero";
import {
  Zap,
  Check,
  Sparkles,
  Users,
  Link as LinkIcon,
  FileText,
  Camera,
  KeyRound,
  MessageCircle,
} from "lucide-react";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Creator tools — Crays" },
      {
        name: "description",
        content:
          "The Crays creator toolkit: passkey identity, long-form publishing, Lightning zaps, Instagram import and encrypted messages on Nostr.",
      },
    ],
  }),
  component: Premium,
});

const features = [
  {
    icon: KeyRound,
    title: "Passkey identity",
    desc: "Create a Nostr key protected by your device's passkey — no seed phrase to lose.",
  },
  {
    icon: FileText,
    title: "Notes & long-form",
    desc: "Publish kind-1 notes and kind-30023 articles to your relays in one step.",
  },
  {
    icon: Zap,
    title: "Lightning zaps",
    desc: "Send and receive sats with any NIP-47 wallet. 100% goes to the creator.",
  },
  {
    icon: Camera,
    title: "Instagram import",
    desc: "Bring your posts and photos across, re-hosted on Blossom.",
  },
  {
    icon: Users,
    title: "Follow graph",
    desc: "Your follow list lives on Nostr, so it travels with your key to any client.",
  },
  {
    icon: MessageCircle,
    title: "Encrypted DMs",
    desc: "Private NIP-04 messages, decrypted only on your device.",
  },
];

function Premium() {
  const ui = useUI();
  const nostr = useNostr();
  const price = useBtcPrice();
  const profile = nostr.account?.profile;
  const lud16 = profile?.lud16 ?? profile?.lud06;

  return (
    <PageShell
      title="Creator tools"
      subtitle="Everything Crays adds on top of the open Nostr protocol — free."
    >
      <CreatorToolsHero />

      {/* Plan card */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="relative flex flex-col overflow-hidden rounded-2xl bg-zinc-900 p-7 text-white shadow-elevated ring-1 ring-zinc-800">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(at 0% 0%, oklch(0.7 0.2 50 / 0.4) 0, transparent 55%), radial-gradient(at 100% 100%, oklch(0.55 0.22 260 / 0.35) 0, transparent 55%)",
            }}
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
              <Sparkles className="size-2.5" /> Free while in beta
            </span>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[48px] font-semibold leading-none tracking-tight">0</span>
              <span className="text-[13px] text-zinc-400">sats / month</span>
            </div>
            <p className="mt-2 text-[13px] text-zinc-300">
              No card, no subscription. You only pay network fees when you move sats.
            </p>

            <button
              onClick={() =>
                nostr.account ? ui.openReceive() : ui.openAuth({ intent: "get paid on Nostr" })
              }
              className="mt-6 w-full rounded-xl bg-white py-3 text-[13.5px] font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              {nostr.account ? "Get paid with Lightning" : "Create your identity"}
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-400">
              {price
                ? `1 sat ≈ ${formatUsd(price.usd / 100_000_000, 4)} · 10k sats ≈ ${formatUsd((10_000 / 100_000_000) * price.usd)}`
                : "Live BTC price via pricestr.xyz over Nostr"}
            </p>

            <ul className="mt-6 space-y-3 border-t border-white/10 pt-5">
              {[
                "Passkey sign-in and encrypted key backup",
                "Notes, replies and long-form articles",
                "Zaps in and out with NIP-47 wallets",
                "Instagram import with Blossom media",
                "Follow lists and bookmarks stored on Nostr",
                "Encrypted direct messages",
                "Open source, no lock-in",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-amber-300" strokeWidth={3} />
                  <span className="text-zinc-200">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated"
            >
              <div className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                <f.icon className="size-[18px]" strokeWidth={2.2} />
              </div>
              <h4 className="mt-3 text-[13.5px] font-semibold text-zinc-900">{f.title}</h4>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Wallet nudge */}
      {!nostr.wallet.connected && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <Zap className="size-5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-zinc-900">Connect a Lightning wallet</p>
              <p className="text-[12px] text-zinc-500">
                Add a Nostr Wallet Connect string to send and receive zaps.
              </p>
            </div>
          </div>
          <button
            onClick={() =>
              nostr.account ? ui.openReceive() : ui.openAuth({ intent: "connect a wallet" })
            }
            className="rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
          >
            Connect wallet
          </button>
        </section>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] text-zinc-400">
        <LinkIcon className="size-3" />
        {nostr.account
          ? `Signed in as ${nostr.account.npub.slice(0, 12)}…`
          : "Powered by Nostr + Lightning"}
      </p>
    </PageShell>
  );
}
