import { Search, TrendingUp, Mic, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AvatarTile } from "./avatar-tile";
import { useUI } from "./modals/ui-provider";

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
  const ui = useUI();
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  return (
    <aside className="sticky top-0 hidden h-screen space-y-5 overflow-y-auto py-6 no-scrollbar xl:block">
      {/* Search → cmd palette */}
      <button
        onClick={ui.openCommandPalette}
        className="relative flex w-full items-center gap-2 rounded-xl bg-white py-2.5 pl-10 pr-3 text-left text-[13px] text-zinc-400 ring-1 ring-black/5 hover:bg-zinc-50"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
        <span className="flex-1">Search creators, posts, topics…</span>
        <kbd className="hidden rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline">⌘K</kbd>
      </button>

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
            <path d="M0 24 L10 22 L20 26 L30 18 L40 20 L50 12 L60 14 L70 6 L80 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0 24 L10 22 L20 26 L30 18 L40 20 L50 12 L60 14 L70 6 L80 8 L80 32 L0 32 Z" fill="currentColor" opacity="0.1" />
          </svg>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5">
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Trending</h3>
          <TrendingUp className="size-3.5 text-zinc-400" />
        </header>
        <ul className="divide-y divide-zinc-100">
          {trending.map((t) => (
            <li key={t.tag}>
              <button
                onClick={() => toast(`Filtering by ${t.tag}`)}
                className="block w-full text-left px-5 py-3.5 transition-colors hover:bg-zinc-50/80"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{t.topic}</p>
                <p className="mt-0.5 text-[13.5px] font-semibold text-zinc-900">{t.tag}</p>
                <p className="mt-0.5 text-[11px] text-zinc-400">{t.meta}</p>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5">
        <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Recommended creators</h3>
        <ul className="space-y-4">
          {recommended.map((r) => {
            const isFollowed = !!followed[r.handle];
            return (
              <li key={r.handle} className="flex items-center gap-3">
                <AvatarTile seed={r.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-zinc-900">{r.name}</p>
                  <p className="truncate text-[11px] text-zinc-400">{r.handle} · {r.followers}</p>
                </div>
                <button
                  onClick={() => {
                    setFollowed((f) => ({ ...f, [r.handle]: !f[r.handle] }));
                    toast.success(isFollowed ? `Unfollowed ${r.name}` : `Following ${r.name}`);
                  }}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                    isFollowed
                      ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      : "bg-zinc-900 text-white hover:bg-zinc-700"
                  }`}
                >
                  {isFollowed ? "Following" : "Follow"}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-brand/5 p-5 ring-1 ring-brand/10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
            <Mic className="size-3.5" /> Upcoming spaces
          </h3>
          <span className="size-2 animate-pulse rounded-full bg-brand" />
        </div>
        <ul className="space-y-4">
          <SpaceItem date="08" month="Dec" title="The Future of Lightning" host="Jack & Saylor" onClick={() => toast("RSVP confirmed")} />
          <SpaceItem date="11" month="Dec" title="Nostr for Creators" host="Lyn Alden" onClick={() => toast("RSVP confirmed")} />
        </ul>
        <button onClick={() => toast("All spaces")} className="mt-4 flex w-full items-center justify-center gap-1 text-[11px] font-semibold text-brand hover:underline">
          View all spaces <ArrowUpRight className="size-3" />
        </button>
      </section>
    </aside>
  );
}

function SpaceItem({ date, month, title, host, onClick }: { date: string; month: string; title: string; host: string; onClick?: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex w-full gap-3 text-left hover:opacity-80">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-white shadow-sm">
          <span className="text-[13px] font-bold leading-none text-zinc-900">{date}</span>
          <span className="text-[8px] font-semibold uppercase tracking-wider text-zinc-400">{month}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-zinc-900">{title}</p>
          <p className="truncate text-[11px] text-zinc-500">with {host}</p>
        </div>
      </button>
    </li>
  );
}
