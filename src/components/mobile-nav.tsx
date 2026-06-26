import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Bell, MessageCircle, Wallet } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/discover", icon: Compass, label: "Discover" },
  { to: "/notifications", icon: Bell, label: "Alerts" },
  { to: "/messages", icon: MessageCircle, label: "Chats" },
  { to: "/wallet", icon: Wallet, label: "Wallet" },
] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/85 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-between px-3 py-1.5">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-brand" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
