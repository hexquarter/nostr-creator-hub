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
  Zap,
  Camera,
  LogIn,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { AvatarTile } from "@/components/avatar-tile";
import { formatSats } from "@/lib/nostr/price";
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

  const balance = nostr.wallet.balanceSats;

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
            <Link
              key={to}
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
          );
        })}

        {/* Import — only meaningful once you have a key to sign the posts */}
        {nostr.account && (
          <button
            onClick={ui.openImportInstagram}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900"
          >
            <Camera
              className="size-[18px] shrink-0 text-zinc-400 group-hover:text-zinc-700"
              strokeWidth={2}
            />
            Import from Instagram
          </button>
        )}
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
        ) : (
          <button
            onClick={() => ui.openAuth()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-[13px] font-semibold text-white shadow-brand ring-1 ring-brand/80 transition-all hover:bg-brand/90 hover:shadow-elevated"
          >
            <LogIn className="size-4" /> Sign in / Create
          </button>
        )}

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

        {nostr.account && (
          <Link
            to="/wallet"
            className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3 text-white hover:bg-black"
          >
            <div className="grid size-9 place-items-center rounded-lg bg-brand/15 text-brand">
              <Zap className="size-4" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Balance
              </p>
              <p className="truncate text-sm font-semibold">
                {nostr.wallet.connected
                  ? balance == null
                    ? "Loading…"
                    : `${formatSats(balance)} sats`
                  : "Connect wallet"}
              </p>
            </div>
          </Link>
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
