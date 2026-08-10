import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Plus, Heart, User } from "lucide-react";
import { useUI } from "@/components/modals/ui-provider";
import { AvatarTile } from "@/components/avatar-tile";

const left = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/discover", icon: Search, label: "Search" },
] as const;

const right = [{ to: "/notifications", icon: Heart, label: "Activity" }] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ui = useUI();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
        {left.map(({ to, icon: Icon, label }) => (
          <NavItem key={to} to={to} icon={Icon} label={label} active={pathname === to} />
        ))}

        <li>
          <button
            onClick={() => ui.openCompose({ mode: "post" })}
            aria-label="Create"
            className="grid size-12 place-items-center rounded-2xl bg-brand text-white shadow-brand transition-transform active:scale-90"
          >
            <Plus className="size-6" strokeWidth={2.4} />
          </button>
        </li>

        {right.map(({ to, icon: Icon, label }) => (
          <NavItem key={to} to={to} icon={Icon} label={label} active={pathname === to} />
        ))}

        <li>
          <Link
            to="/profile"
            aria-label="Profile"
            className="grid size-11 place-items-center rounded-full"
          >
            <span
              className={`grid place-items-center rounded-full p-[2px] ${
                pathname === "/profile" ? "bg-brand" : "bg-transparent"
              }`}
            >
              {ui.user ? (
                <AvatarTile seed={ui.user.name} size={28} />
              ) : (
                <span className="grid size-7 place-items-center rounded-full bg-zinc-100 text-zinc-500">
                  <User className="size-4" />
                </span>
              )}
            </span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        aria-label={label}
        className={`grid size-11 place-items-center rounded-xl transition-colors ${
          active ? "text-zinc-900" : "text-zinc-400"
        }`}
      >
        <Icon className="size-[25px]" strokeWidth={active ? 2.4 : 1.9} />
      </Link>
    </li>
  );
}
