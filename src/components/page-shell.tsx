import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { MobileTopBar } from "@/components/mobile-topbar";
import { useUI } from "@/components/modals/ui-provider";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  rightSidebar?: ReactNode | false;
  /** Drop the desktop right column so the page gets the full content width. */
  wide?: boolean;
  children: ReactNode;
};

export function PageShell({
  title,
  subtitle,
  actions,
  rightSidebar,
  wide = false,
  children,
}: Props) {
  const ui = useUI();
  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          "mx-auto grid w-full max-w-[1400px] gap-6 px-4 sm:px-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8",
          !wide && "xl:grid-cols-[224px_minmax(0,1fr)_320px]",
        )}
      >
        <LeftSidebar />
        <main className="min-w-0 space-y-6 pb-28 lg:py-6 lg:pb-6">
          <MobileTopBar title={title} />
          <div className="hidden lg:block">
            <button
              onClick={ui.openCommandPalette}
              className="relative flex w-full items-center gap-2 rounded-xl bg-white py-2.5 pl-10 pr-3 text-left text-[13px] text-zinc-400 shadow-card ring-1 ring-black/5 transition-colors hover:bg-zinc-50"
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <span className="flex-1">Search creators, posts, topics…</span>
              <kbd className="hidden rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>
          <header className="hidden items-end justify-between gap-4 lg:flex">
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-none tracking-tight text-zinc-900">
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 text-[13px] text-zinc-500">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </header>
          {actions && <div className="flex items-center gap-2 lg:hidden">{actions}</div>}
          {children}
        </main>
        {wide ? null : rightSidebar === false ? (
          <div className="hidden xl:block" />
        ) : (
          (rightSidebar ?? <RightSidebar />)
        )}
      </div>
      <MobileNav />
    </div>
  );
}
