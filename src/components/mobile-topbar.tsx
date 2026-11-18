import { Link } from "@tanstack/react-router";
import { Bell, MessageCircle, LogIn } from "lucide-react";
import logo from "@/assets/crays-logo.svg";
import { useUI } from "@/components/modals/ui-provider";

export function MobileTopBar({ title }: { title?: string }) {
  const ui = useUI();
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
      {title ? (
        <h1 className="truncate text-[19px] font-semibold tracking-tight text-zinc-900">{title}</h1>
      ) : (
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Crays" className="h-7 w-auto" />
        </Link>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {!ui.user ? (
          <button
            onClick={() => ui.openAuth()}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-brand transition-transform active:scale-95"
          >
            <LogIn className="size-3.5" /> Sign in
          </button>
        ) : (
          <>
            <Link
              to="/notifications"
              aria-label="Notifications"
              className="grid size-9 place-items-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <Bell className="size-[21px]" strokeWidth={1.9} />
            </Link>
            <Link
              to="/messages"
              search={{}}
              aria-label="Messages"
              className="grid size-9 place-items-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <MessageCircle className="size-[21px]" strokeWidth={1.9} />
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
