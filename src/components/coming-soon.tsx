import { createFileRoute } from "@tanstack/react-router";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { Sparkles } from "lucide-react";

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 sm:px-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[224px_minmax(0,1fr)_320px]">
        <LeftSidebar />
        <main className="space-y-6 py-6 pb-24 lg:pb-6">
          <h1 className="text-[26px] font-semibold tracking-tight">{title}</h1>
          <p className="text-[13px] text-zinc-500">{blurb}</p>
          <div className="grid place-items-center rounded-2xl bg-white p-16 shadow-card ring-1 ring-black/5">
            <div className="grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
              <Sparkles className="size-5" />
            </div>
            <p className="mt-4 text-[14px] font-semibold text-zinc-900">Coming soon</p>
            <p className="mt-1 max-w-xs text-center text-[12.5px] text-zinc-500">
              We&apos;re polishing this experience. Check back shortly.
            </p>
          </div>
        </main>
        <RightSidebar />
      </div>
      <MobileNav />
    </div>
  );
}

// Re-export as a barrel for tiny route stubs
export const stub = (title: string, blurb: string) =>
  createFileRoute as unknown as never; // placeholder, unused
