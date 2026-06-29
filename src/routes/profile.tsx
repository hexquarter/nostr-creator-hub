import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { useUI } from "@/components/modals/ui-provider";

import { PostCard, type Post } from "@/components/post-card";
import { PremiumPost } from "@/components/premium-post";
import {
  BadgeCheck,
  Calendar,
  Crown,
  GripVertical,
  Link as LinkIcon,
  MapPin,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  Zap,
  Globe,
  Play,
  Code2,
  AtSign,
  Camera,
  Music2,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Crays" },
      { name: "description", content: "Your Crays profile — posts, premium articles, link-in-bio and free trial." },
    ],
  }),
  component: Profile,
});

const stats = [
  { label: "Posts", value: "1,284" },
  { label: "Followers", value: "12.4k" },
  { label: "Following", value: "318" },
  { label: "Zaps earned", value: "4.2M" },
];

const socials = [
  { id: "x", label: "X (Twitter)", handle: "@alexstellar", icon: AtSign, color: "text-zinc-900", bg: "bg-zinc-100" },
  { id: "yt", label: "YouTube", handle: "Alex Stellar", icon: Play, color: "text-rose-600", bg: "bg-rose-50" },
  { id: "ig", label: "Instagram", handle: "@alex.stellar", icon: Camera, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
  { id: "gh", label: "GitHub", handle: "alexstellar", icon: Code2, color: "text-zinc-900", bg: "bg-zinc-100" },
  { id: "sp", label: "Spotify", handle: "Stellar Sounds", icon: Music2, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "site", label: "Website", handle: "stellar.app", icon: Globe, color: "text-brand", bg: "bg-brand/10" },
];

const linkBlocks = [
  { title: "New essay · The Liquidity Inflection", sub: "Read on Crays Premium", icon: Sparkles, accent: true },
  { title: "Subscribe to the newsletter", sub: "Weekly macro + Bitcoin", icon: Mail },
  { title: "Latest podcast episode", sub: "Lightning UX with Elena Vega", icon: Music2 },
  { title: "Book a 1:1 call", sub: "30 min · 50k sats", icon: Calendar },
];

const posts: Post[] = [
  {
    id: "p1",
    author: "You",
    handle: "@you",
    verified: true,
    time: "2h",
    content:
      "Spent the morning rewriting our publish flow so that posting a long-form article feels as light as posting a tweet. Friction is the only thing standing between Nostr and the next million writers.",
    replies: 24,
    zaps: "142k",
    reposts: 36,
  },
  {
    id: "p2",
    author: "You",
    handle: "@you",
    verified: true,
    time: "Yesterday",
    content:
      "Hot take: the wallet should disappear. Sats become a number that just goes up when good things happen and down when you spend. Everything else is plumbing.",
    image: {
      gradient: "linear-gradient(135deg, #1f2937 0%, #4338ca 35%, #ec4899 75%, #f59e0b 100%)",
      aspect: "aspect-[16/9]",
    },
    replies: 92,
    zaps: "412k",
    reposts: 124,
  },
];

function Profile() {
  const ui = useUI();
  return (
    <PageShell title="Profile" subtitle="Public face of your sovereign identity.">
      {/* Banner + header */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <div
          className="h-44 w-full sm:h-56"
          style={{
            background:
              "radial-gradient(at 20% 30%, #818cf8 0, transparent 50%), radial-gradient(at 80% 70%, #f472b6 0, transparent 50%), linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
          }}
        />
        <div className="-mt-14 px-5 pb-6 sm:px-8">
          <div className="flex items-end justify-between gap-4">
            <div className="rounded-2xl bg-white p-1.5 shadow-card">
              <AvatarTile seed="Alex Stellar" size={96} rounded="2xl" className="!rounded-xl" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => ui.openZap({ recipient: "Alex Stellar" })}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-2 text-[12px] font-semibold text-amber-700 hover:bg-amber-100"
              >
                <Zap className="size-3.5" /> Zap
              </button>
              <button
                onClick={ui.openEditProfile}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-zinc-700 shadow-card ring-1 ring-black/5 hover:bg-zinc-50"
              >
                <SettingsIcon className="size-3.5" /> Edit profile
              </button>
              <button
                onClick={ui.openUpgrade}
                className="group inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
              >
                <Sparkles className="size-3.5 text-amber-300" />
                Start 7-day free trial
              </button>
            </div>
          </div>

          <div className="mt-5">
            <h2 className="flex flex-wrap items-center gap-2 text-[22px] font-semibold tracking-tight text-zinc-900">
              Alex Stellar
              <BadgeCheck className="size-5 fill-brand text-white" />
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                <Crown className="size-3" /> Creator
              </span>
            </h2>
            <p className="text-[13px] text-zinc-500">alex@crays.net</p>
            <p className="mt-3 max-w-xl text-pretty text-[14px] leading-relaxed text-zinc-700">
              Building the open creator economy. Long-form on macro, Bitcoin and design. Powered by zaps, not ads.
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-zinc-500">
              <li className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> Lisbon, PT
              </li>
              <li className="inline-flex items-center gap-1.5">
                <LinkIcon className="size-3.5" />
                <a href="#" className="text-brand hover:underline">crays.net/alex</a>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" /> Joined Mar 2023
              </li>
            </ul>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-zinc-50 px-4 py-3 ring-1 ring-black/5">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
                  {s.label}
                </p>
                <p className="mt-1 text-[18px] font-semibold tracking-tight text-zinc-900">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free trial banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-rose-50 to-violet-50 p-5 ring-1 ring-amber-200/60 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white text-amber-600 shadow-sm ring-1 ring-amber-200/60">
              <Sparkles className="size-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-zinc-900">
                Try every premium post · free for 7 days
              </p>
              <p className="mt-0.5 text-[12px] text-zinc-600">
                Get full access to articles, the link-in-bio editor and the Spaces room. Cancel anytime.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={ui.openUpgrade} className="rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black">
              Start free trial
            </button>
            <button onClick={ui.openUpgrade} className="rounded-full bg-white/70 px-4 py-2 text-[12px] font-semibold text-zinc-700 ring-1 ring-black/5 hover:bg-white">
              Subscribe · $49/mo
            </button>
          </div>
        </div>
      </section>

      {/* Link-in-bio editor */}
      <section className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* Editor */}
        <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 sm:p-6">
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-zinc-900">
                <LinkIcon className="size-4 text-brand" /> Link-in-bio page
              </h3>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                A Linktree-style page hosted at{" "}
                <span className="font-mono text-zinc-700">link.crays.net/alex</span>
              </p>
            </div>
            <button
              onClick={() => ui.openLinkBlock()}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-black"
            >
              <Plus className="size-3.5" /> Add link
            </button>
          </header>

          {/* Socials grid */}
          <div>
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
              Social profiles
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {socials.map((s) => (
                <li
                  key={s.id}
                  className="group flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-black/5 transition-colors hover:bg-white hover:ring-brand/30"
                >
                  <span className={`grid size-8 place-items-center rounded-lg ${s.bg} ${s.color}`}>
                    <s.icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-zinc-900">{s.label}</p>
                    <input
                      defaultValue={s.handle}
                      className="w-full truncate bg-transparent text-[11.5px] text-zinc-500 outline-none focus:text-zinc-900"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Custom link blocks */}
          <div className="mt-6">
            <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
              Featured links
            </p>
            <ul className="space-y-2">
              {linkBlocks.map((b) => (
                <li
                  key={b.title}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 transition-colors ${
                    b.accent
                      ? "bg-gradient-to-r from-brand/10 to-violet-500/10 ring-brand/20"
                      : "bg-zinc-50 ring-black/5 hover:bg-white"
                  }`}
                >
                  <GripVertical className="size-4 shrink-0 text-zinc-300" />
                  <span
                    className={`grid size-8 place-items-center rounded-lg ${
                      b.accent ? "bg-brand text-white" : "bg-white text-zinc-700 ring-1 ring-black/5"
                    }`}
                  >
                    <b.icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-zinc-900">{b.title}</p>
                    <p className="truncate text-[11px] text-zinc-500">{b.sub}</p>
                  </div>
                  <button
                    onClick={() => ui.openLinkBlock({ title: b.title, url: "#" })}
                    className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700"
                  >
                    Edit
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => ui.openLinkBlock()}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-2.5 text-[12px] font-semibold text-zinc-500 hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
            >
              <Plus className="size-3.5" /> Add new block
            </button>
          </div>
        </div>

        {/* Phone preview */}
        <div className="relative rounded-2xl bg-zinc-100 p-6 shadow-card ring-1 ring-black/5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
              Live preview
            </p>
            <a href="#" className="text-[11px] font-semibold text-brand hover:underline">
              stellar.app ↗
            </a>
          </div>
          <div className="mx-auto max-w-[280px] overflow-hidden rounded-[28px] bg-white p-5 shadow-elevated ring-1 ring-black/10">
            <div className="flex flex-col items-center text-center">
              <AvatarTile seed="Alex Stellar" size={72} rounded="2xl" className="!rounded-2xl" />
              <h4 className="mt-3 flex items-center gap-1 text-[14px] font-semibold text-zinc-900">
                Alex Stellar
                <BadgeCheck className="size-4 fill-brand text-white" />
              </h4>
              <p className="text-[11px] text-zinc-500">@alex</p>
              <p className="mt-2 max-w-[220px] text-[11.5px] leading-relaxed text-zinc-600">
                Building the open creator economy. Macro · Bitcoin · Design.
              </p>

              <div className="mt-4 flex gap-2">
                {socials.slice(0, 6).map((s) => (
                  <span
                    key={s.id}
                    className={`grid size-7 place-items-center rounded-full ${s.bg} ${s.color}`}
                  >
                    <s.icon className="size-3.5" strokeWidth={2.4} />
                  </span>
                ))}
              </div>

              <ul className="mt-5 w-full space-y-2">
                {linkBlocks.slice(0, 3).map((b, i) => (
                  <li
                    key={b.title}
                    className={`rounded-xl px-3 py-2.5 text-left text-[11.5px] font-semibold ring-1 ${
                      i === 0
                        ? "bg-gradient-to-r from-brand to-violet-500 text-white ring-transparent"
                        : "bg-zinc-50 text-zinc-800 ring-black/5"
                    }`}
                  >
                    <p className="truncate">{b.title}</p>
                    <p
                      className={`truncate text-[10px] font-medium ${
                        i === 0 ? "text-white/80" : "text-zinc-500"
                      }`}
                    >
                      {b.sub}
                    </p>
                  </li>
                ))}
              </ul>

              <button className="mt-4 w-full rounded-xl bg-zinc-900 py-2 text-[11.5px] font-semibold text-white">
                Subscribe · 7-day free trial
              </button>
              <p className="mt-1 text-[9.5px] text-zinc-400">Powered by Crays · Nostr + Lightning</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-full bg-white p-1 text-[12px] font-medium shadow-card ring-1 ring-black/5 w-fit">
        {["Posts", "Articles", "Media", "Premium", "Zaps"].map((t, i) => (
          <button
            key={t}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              i === 0 ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <PostCard post={posts[0]} />
        <PremiumPost />
        <PostCard post={posts[1]} />
      </div>
    </PageShell>
  );
}
