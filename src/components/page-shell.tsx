import type { ReactNode } from "react";
import { LogIn } from "lucide-react";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { useUI } from "@/components/modals/ui-provider";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  rightSidebar?: ReactNode | false;
  children: ReactNode;
};

export function PageShell({ title, subtitle, actions, rightSidebar, children }: Props) {
  const ui = useUI();
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 sm:px-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[224px_minmax(0,1fr)_320px]">
        <LeftSidebar />
        <main className="space-y-6 py-6 pb-24 lg:pb-6">
          <header className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-[26px] font-semibold leading-none tracking-tight text-zinc-900">
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 text-[13px] text-zinc-500">{subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!ui.user && (
                <button
                  onClick={() => ui.openAuth()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-white shadow-brand ring-1 ring-brand/80 transition-all hover:bg-brand/90 lg:hidden"
                >
                  <LogIn className="size-3.5" /> Sign in
                </button>
              )}
              {actions}
            </div>
          </header>
          {children}
        </main>
        {rightSidebar === false ? <div className="hidden xl:block" /> : rightSidebar ?? <RightSidebar />}
      </div>
      <MobileNav />
    </div>
  );
}

