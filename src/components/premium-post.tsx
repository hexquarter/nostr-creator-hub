import { Crown, Zap, Clock, Users } from "lucide-react";
import { AvatarTile } from "./avatar-tile";

export function PremiumPost() {
  return (
    <article className="relative overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 transition-shadow hover:shadow-elevated">
      <div className="p-5 sm:p-6">
        <header className="mb-4 flex items-start gap-3">
          <AvatarTile seed="Lyn Alden" size={40} />
          <div className="min-w-0 flex-1">
            <h4 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-zinc-900">
              Lyn Alden
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
                <Crown className="size-2.5" /> Premium
              </span>
            </h4>
            <p className="text-[11.5px] text-zinc-400">@lyn · 2h ago</p>
          </div>
        </header>

        <h3 className="text-balance text-[22px] font-semibold leading-[1.2] tracking-tight text-zinc-900">
          Macro Analysis: The Global Liquidity Inflection
        </h3>
        <p className="mt-2 text-[13.5px] text-zinc-500">
          A look at how cross-border liquidity flows are quietly reshaping Bitcoin's next cycle —
          and why the next 18 months will define the decade.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-zinc-500">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> 12 min read
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" /> 1,284 subscribers
          </span>
        </div>

        {/* Locked preview */}
        <div className="relative mt-5 overflow-hidden rounded-xl">
          <div
            className="aspect-[16/9] w-full blur-md"
            style={{
              background:
                "radial-gradient(at 30% 20%, #93c5fd 0, transparent 50%), radial-gradient(at 70% 80%, #c4b5fd 0, transparent 50%), radial-gradient(at 50% 50%, #fda4af 0, transparent 60%), #f4f4f5",
            }}
          />
          {/* Faint chart hint */}
          <svg
            viewBox="0 0 400 100"
            className="absolute inset-0 h-full w-full text-zinc-900/15"
            preserveAspectRatio="none"
          >
            <path
              d="M0 70 L40 60 L80 75 L120 50 L160 55 L200 30 L240 40 L280 18 L320 25 L360 10 L400 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="w-full max-w-sm rounded-2xl bg-white/85 p-5 shadow-elevated ring-1 ring-black/5 backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand">
                  <Zap className="size-4" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-zinc-900">
                    Unlock for 500 sats
                  </p>
                  <p className="text-[11px] text-zinc-500">≈ $0.32 · Lightning</p>
                </div>
              </div>
              <button className="w-full rounded-xl bg-zinc-900 py-2.5 text-[13px] font-semibold text-white ring-1 ring-zinc-900 transition-all hover:bg-black active:scale-[0.99]">
                Pay with Lightning
              </button>
              <p className="mt-2 text-center text-[10.5px] text-zinc-400">
                One-time payment · or subscribe for $5/mo
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
