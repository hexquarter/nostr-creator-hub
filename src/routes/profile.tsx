import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { PostCard, type Post } from "@/components/post-card";
import { PremiumPost } from "@/components/premium-post";
import {
  BadgeCheck,
  Calendar,
  Link as LinkIcon,
  MapPin,
  Settings as SettingsIcon,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Stellar" },
      { name: "description", content: "Your Stellar profile — posts, premium articles, zaps and stats." },
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
              <button className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3.5 py-2 text-[12px] font-semibold text-amber-700 hover:bg-amber-100">
                <Zap className="size-3.5" /> Zap
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-zinc-700 shadow-card ring-1 ring-black/5 hover:bg-zinc-50">
                <SettingsIcon className="size-3.5" /> Edit profile
              </button>
              <button className="rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black">
                Subscribe · 5k sats/mo
              </button>
            </div>
          </div>

          <div className="mt-5">
            <h2 className="flex items-center gap-1.5 text-[22px] font-semibold tracking-tight text-zinc-900">
              Alex Stellar
              <BadgeCheck className="size-5 fill-brand text-white" />
            </h2>
            <p className="text-[13px] text-zinc-500">@alex · alex@stellar.app</p>
            <p className="mt-3 max-w-xl text-pretty text-[14px] leading-relaxed text-zinc-700">
              Building the open creator economy. Long-form on macro, Bitcoin and design. Powered by zaps, not ads.
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-zinc-500">
              <li className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> Lisbon, PT
              </li>
              <li className="inline-flex items-center gap-1.5">
                <LinkIcon className="size-3.5" />
                <a href="#" className="text-brand hover:underline">stellar.app/alex</a>
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
