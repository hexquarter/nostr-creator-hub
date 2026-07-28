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
import { useUI } from "@/components/modals/ui-provider";
import { AvatarTile } from "@/components/avatar-tile";

const nav = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/discover", icon: Compass, label: "Discover" },
  { to: "/following", icon: Users, label: "Following" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/bookmarks", icon: Bookmark, label: "Bookmarks" },
  { to: "/premium", icon: Crown, label: "Premium" },
  { to: "/wallet", icon: Wallet, label: "Wallet" },
  { to: "/profile", icon: User, label: "Profile" },
  { to: "/settings", icon: Settings, label: "Settings" },
] as const;

import logo from '../assets/crays-logo.svg'

export function LeftSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ui = useUI();

  return (
    <aside className="sticky top-0 hidden h-screen flex-col py-6 lg:flex">
      {/* Logo */}
      <Link to="/" className="mb-8 flex items-center gap-2.5 px-3">
        <img src={logo} className="h-7"/>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {nav.map(({ to, icon: Icon, label }) => {
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

        {/* Import — always visible, gated for signed-out */}
        <button
          onClick={ui.openImportInstagram}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900"
        >
          <Camera className="size-[18px] shrink-0 text-zinc-400 group-hover:text-zinc-700" strokeWidth={2} />
          Import from Instagram
        </button>
      </nav>

      {/* Auth CTA / Account chip */}
      <div className="mt-6 space-y-3">
        {ui.user ? (
          <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card ring-1 ring-black/5">
            <AvatarTile seed={ui.user.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-zinc-900">{ui.user.name}</p>
              <p className="truncate text-[10.5px] text-zinc-500">{ui.user.handle}</p>
            </div>
            <button
              aria-label="Sign out"
              onClick={ui.openLogoutConfirm}
              className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => ui.openAuth()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-[13px] font-semibold text-white shadow-brand ring-1 ring-brand/80 transition-all hover:bg-brand/90 hover:shadow-elevated"
          >
            <LogIn className="size-4" /> Sign in / Create
          </button>
        )}

        {/* Dashboard + wallet */}
        <div className="rounded-xl bg-surface p-4 shadow-card ring-1 ring-black/5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Creator Dashboard
            </h3>
            <span className="text-[10px] font-medium text-emerald-600">+12%</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="MRR" value="1.2M" suffix="sats" />
            <Stat label="Subs" value="842" />
            <Stat label="Premium" value="184" />
            <Stat label="Earned" value="$2.4k" />
          </div>
          <svg viewBox="0 0 100 20" className="mt-4 h-6 w-full text-brand">
            <path
              d="M0 14 L12 12 L24 15 L36 8 L48 10 L60 6 L72 9 L84 4 L100 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M0 14 L12 12 L24 15 L36 8 L48 10 L60 6 L72 9 L84 4 L100 5 L100 20 L0 20 Z"
              fill="currentColor"
              opacity="0.08"
            />
          </svg>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3 text-white">
          <div className="grid size-9 place-items-center rounded-lg bg-brand/15 text-brand">
            <Zap className="size-4" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Balance
            </p>
            <p className="truncate text-sm font-semibold">42,069 sats</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-[13px] font-semibold text-zinc-900">
        {value}
        {suffix && <span className="ml-0.5 text-[10px] font-medium text-zinc-400">{suffix}</span>}
      </p>
    </div>
  );
}
