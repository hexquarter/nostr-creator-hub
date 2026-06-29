import { Crown, Zap, Clock, Users } from "lucide-react";
import { AvatarTile } from "./avatar-tile";
import { useUI } from "./modals/ui-provider";

export function PremiumPost() {
  const ui = useUI();
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
      </div>

      <div className="relative">
        <div
          className="h-44 w-full"
          style={{
            background:
              "linear-gradient(135deg, #fef3c7 0%, #fde68a 30%, #fcd34d 60%, #f59e0b 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        <div className="flex items-center justify-between text-[11.5px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> 8 min read
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" /> 12,402 unlocked
            </span>
          </div>
          <span className="font-mono text-zinc-400">500 sats</span>
        </div>
        <button
          onClick={() => ui.openUnlock({ title: "The Global Liquidity Inflection", sats: 500 })}
          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-[13.5px] font-semibold text-white shadow-card transition-all hover:shadow-elevated active:scale-[0.99]"
        >
          <Zap className="size-4 transition-transform group-hover:scale-110" strokeWidth={2.4} />
          Unlock for 500 sats
        </button>
      </div>
    </article>
  );
}
