import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Compass,
  Users,
  MessageCircle,
  Bell,
  Bookmark,
  Crown,
  Wallet,
  User,
  Settings,
  LogIn,
  LogOut,
  ArrowRight,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { AvatarTile } from "@/components/avatar-tile";
import { compactNumber } from "@/lib/format";
import { fetchProfileStats } from "@/lib/nostr/social";

const nav = [
  { to: "/", icon: Home, label: "Home", authOnly: false },
  { to: "/discover", icon: Compass, label: "Discover", authOnly: false },
  { to: "/following", icon: Users, label: "Following", authOnly: true },
  { to: "/messages", icon: MessageCircle, label: "Messages", authOnly: true },
  { to: "/notifications", icon: Bell, label: "Notifications", authOnly: true },
  { to: "/bookmarks", icon: Bookmark, label: "Bookmarks", authOnly: true },
  { to: "/premium", icon: Crown, label: "Creator tools", authOnly: true },
  { to: "/wallet", icon: Wallet, label: "Wallet", authOnly: true },
  { to: "/profile", icon: User, label: "Profile", authOnly: true },
  { to: "/settings", icon: Settings, label: "Settings", authOnly: true },
] as const;

import logo from "../assets/crays-logo.svg";

export function LeftSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ui = useUI();
  const nostr = useNostr();
  const [stats, setStats] = useState<{
    posts: number;
    following: number;
    followers: number;
  } | null>(null);

  const pubkey = nostr.account?.pubkey;

  useEffect(() => {
    if (!pubkey) {
      setStats(null);
      return;
    }
    let cancelled = false;
    fetchProfileStats(pubkey)
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  return (
    <aside className="sticky top-0 hidden h-screen flex-col py-6 lg:flex">
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center gap-2.5 px-3">
        <img src={logo} className="h-7" alt="Crays" />
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {nav.map(({ to, icon: Icon, label, authOnly }) => {
          if (authOnly && !nostr.account) return null;
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <Fragment key={to}>
              <Link
                to={to}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900"
                }`}
              >
                <Icon
                  className={`size-[18px] shrink-0 ${active ? "text-brand" : "text-zinc-400 group-hover:text-zinc-700"}`}
                  strokeWidth={2}
                />
                {label}
              </Link>
              {to === "/discover" && !nostr.account && <JoinCraysSidebarCard />}
            </Fragment>
          );
        })}
      </nav>

      {/* Auth CTA / Account chip */}
      <div className="mt-6 space-y-3">
        {ui.user ? (
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card ring-1 ring-black/5 hover:bg-zinc-50"
          >
            {ui.user.picture ? (
              <img src={ui.user.picture} alt="" className="size-9 rounded-full object-cover" />
            ) : (
              <AvatarTile seed={ui.user.name} size={36} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-zinc-900">{ui.user.name}</p>
              <p className="truncate text-[10.5px] text-zinc-500">{ui.user.handle}</p>
            </div>
            <button
              aria-label="Sign out"
              onClick={(e) => {
                e.preventDefault();
                ui.openLogoutConfirm();
              }}
              className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
            >
              <LogOut className="size-4" />
            </button>
          </Link>
        ) : null}

        {/* Creator stats */}
        {nostr.account && (
          <div className="rounded-xl bg-surface p-4 shadow-card ring-1 ring-black/5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Your activity
              </h3>
              <Link to="/profile" className="text-[10px] font-medium text-brand hover:underline">
                View
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Notes" value={stats ? compactNumber(stats.posts) : "—"} />
              <Stat label="Followers" value={stats ? compactNumber(stats.followers) : "—"} />
              <Stat label="Following" value={stats ? compactNumber(stats.following) : "—"} />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-[13px] font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function JoinCraysSidebarCard() {
  const ui = useUI();

  return (
    <div className="px-1 pb-1 pt-2">
      <div className="rounded-2xl p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Join Crays</p>
        <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-zinc-900">
          Join the creators live on Nostr
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-zinc-600">
          Follow and support your favorite creators as a subscriber — or start your own page and
          keep 100% of what you earn.
        </p>
        <button
          onClick={() => ui.openAuth({ intent: "join the creators live on Nostr" })}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2.5 text-[12.5px] font-semibold text-white shadow-brand transition-colors hover:bg-brand/90"
        >
          <LogIn className="size-4" /> Sign in / Create
        </button>
      </div>
    </div>
  );
}
