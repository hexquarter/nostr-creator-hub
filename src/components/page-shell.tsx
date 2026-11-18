import type { ReactNode } from "react";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { MobileTopBar } from "@/components/mobile-topbar";
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
