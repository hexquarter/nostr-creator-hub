import { Search, TrendingUp, Mic, ArrowUpRight } from "lucide-react";
import { AvatarTile } from "./avatar-tile";

const trending = [
  { topic: "Nostr Protocols", tag: "#NIP17", meta: "1,402 zaps today" },
  { topic: "Bitcoin", tag: "#Halving2024", meta: "8.2k zaps today" },
  { topic: "Lightning", tag: "#Cashu", meta: "612 zaps today" },
];

const recommended = [
  { name: "Lyn Alden", handle: "@lyn", followers: "284k" },
  { name: "Saifedean Ammous", handle: "@saifedean", followers: "192k" },
  { name: "Marty Bent", handle: "@marty", followers: "84k" },
];

export function RightSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen space-y-5 overflow-y-auto py-6 no-scrollbar xl:block">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          placeholder="Search creators, posts, topics…"
          className="w-full rounded-xl bg-white py-2.5 pl-10 pr-3 text-[13px] text-zinc-900 ring-1 ring-black/5 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-brand/40"
        />
      </div>

      {/* BTC price */}
      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Bitcoin Price
          </h3>
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
            +4.2%
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-semibold tracking-tight text-zinc-900">$96,402</p>
            <p className="mt-0.5 text-[11px] font-medium text-zinc-400">USD · past 24h</p>
          </div>
          <svg viewBox="0 0 80 32" className="h-10 w-20 text-emerald-500">
            <path
              d="M0 24 L10 22 L20 26 L30 18 L40 20 L50 12 L60 14 L70 6 L80 8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M0 24 L10 22 L20 26 L30 18 L40 20 L50 12 L60 14 L70 6 L80 8 L80 32 L0 32 Z"
              fill="currentColor"
              opacity="0.1"
            />
          </svg>
        </div>
      </section>

      {/* Trending */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Trending
          </h3>
          <TrendingUp className="size-3.5 text-zinc-400" />
        </header>
        <ul className="divide-y divide-zinc-100">
          {trending.map((t) => (
            <li key={t.tag}>
              <a
                href="#"
                className="block px-5 py-3.5 transition-colors hover:bg-zinc-50/80"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  {t.topic}
                </p>
                <p className="mt-0.5 text-[13.5px] font-semibold text-zinc-900">{t.tag}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">{t.meta}</p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Recommended */}
      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
        <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Recommended creators
        </h3>
        <ul className="space-y-4">
          {recommended.map((r) => (
            <li key={r.handle} className="flex items-center gap-3">
              <AvatarTile seed={r.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-zinc-900">{r.name}</p>
                <p className="truncate text-[11px] text-zinc-400">
                  {r.handle} · {r.followers}
                </p>
              </div>
              <button className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-zinc-700">
                Follow
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Upcoming Spaces */}
      <section className="rounded-2xl bg-brand/5 p-5 ring-1 ring-brand/10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
            <Mic className="size-3.5" />
            Upcoming spaces
          </h3>
          <span className="size-2 animate-pulse rounded-full bg-brand" />
        </div>
        <ul className="space-y-4">
          <SpaceItem date="08" month="Dec" title="The Future of Lightning" host="Jack & Saylor" />
          <SpaceItem date="11" month="Dec" title="Nostr for Creators" host="Lyn Alden" />
        </ul>
        <button className="mt-4 flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-brand hover:underline">
          View all spaces <ArrowUpRight className="size-3" />
        </button>
      </section>
    </aside>
  );
}

function SpaceItem({
  date,
  month,
  title,
  host,
}: {
  date: string;
  month: string;
  title: string;
  host: string;
}) {
  return (
    <li className="flex gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white shadow-sm">
        <span className="text-[13px] font-bold leading-none text-zinc-900">{date}</span>
        <span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400">
          {month}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-zinc-900">{title}</p>
        <p className="truncate text-[11px] text-zinc-500">with {host}</p>
      </div>
    </li>
  );
}
