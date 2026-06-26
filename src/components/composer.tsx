import { Image, BarChart3, FileText, Calendar, Crown, Zap } from "lucide-react";
import { AvatarTile } from "./avatar-tile";

export function Composer() {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 transition-shadow focus-within:shadow-elevated">
      <div className="flex gap-4">
        <AvatarTile seed="You Stellar" size={40} />
        <div className="flex-1 space-y-3">
          <textarea
            rows={2}
            placeholder="What are you thinking?"
            className="w-full resize-none border-none bg-transparent text-[15.5px] leading-snug text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
            <div className="flex gap-0.5 text-zinc-400">
              <ComposerIcon icon={Image} label="Image" />
              <ComposerIcon icon={BarChart3} label="Poll" />
              <ComposerIcon icon={FileText} label="Article" />
              <ComposerIcon icon={Zap} label="Lightning invoice" />
            </div>
            <div className="flex items-center gap-1.5">
              <button className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-zinc-600 transition-colors hover:bg-zinc-100 sm:inline-flex">
                <Calendar className="size-3.5" />
                Schedule
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-amber-700 transition-colors hover:bg-amber-50">
                <Crown className="size-3.5" />
                Premium
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-[12.5px] font-semibold text-white shadow-brand ring-1 ring-brand/80 transition-all hover:bg-brand/90 hover:shadow-elevated active:scale-[0.98]">
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComposerIcon({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-9 place-items-center rounded-lg transition-colors hover:bg-zinc-100 hover:text-brand"
    >
      <Icon className="size-[18px]" strokeWidth={2} />
    </button>
  );
}
