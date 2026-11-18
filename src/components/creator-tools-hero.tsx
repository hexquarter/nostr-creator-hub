import { useNostr } from "@/components/nostr-provider";
import { useUI } from "@/components/modals/ui-provider";
import { Crown, Users, Zap } from "lucide-react";

/**
 * Shared marketing hero for the creator toolkit. Shown on the Creator tools
 * page for everyone, and at the top of the home page when nobody is signed in.
 */
export function CreatorToolsHero({ compact = false }: { compact?: boolean }) {
  const ui = useUI();
  const nostr = useNostr();
  const lud16 = nostr.wallet.address;
  const signedIn = !!nostr.account;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-zinc-900 p-6 text-white shadow-elevated sm:p-10">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(at 20% 10%, oklch(0.7 0.2 50 / 0.45) 0, transparent 50%), radial-gradient(at 90% 100%, oklch(0.55 0.22 260 / 0.4) 0, transparent 50%)",
        }}
      />
      <div
        className={`relative grid gap-8 ${compact ? "" : "lg:grid-cols-[1.4fr_1fr] lg:items-end"}`}
      >
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm">
            <Crown className="size-3 text-amber-300" /> Creator toolkit
          </span>
          <h2 className="mt-4 text-balance text-[28px] font-semibold leading-[1.1] tracking-tight sm:text-[36px]">
            Publish, get paid and grow — on your own keys.
          </h2>
          <p className="mt-3 max-w-lg text-[14px] text-zinc-300">
            Crays is a Nostr client, not a platform. Your identity, follows and earnings live on the
            protocol, so no one can switch you off.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {signedIn ? (
              <>
                <button
                  onClick={() => ui.openCompose({ mode: "post" })}
                  className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100"
                >
                  Write a post
                </button>
                <button
                  onClick={ui.openImportInstagram}
                  className="rounded-full bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
                >
                  Import from Instagram
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => ui.openAuth({ intent: "start publishing" })}
                  className="rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-zinc-900 hover:bg-zinc-100"
                >
                  Create your account
                </button>
                <button
                  onClick={() => ui.openAuth({ intent: "sign in" })}
                  className="rounded-full bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
        {!compact && (
          <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Metric
              icon={Zap}
              label="Lightning address"
              value={signedIn ? (lud16 ?? "Not set") : "Set after sign-up"}
            />
            <Metric
              icon={Users}
              label="Followers"
              value={signedIn ? "On your relays" : "Your audience, on Nostr"}
            />
          </dl>
        )}
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur-sm">
      <Icon className="size-3.5 text-zinc-400" />
      <p className="mt-2 truncate text-[15px] font-semibold tracking-tight">{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
    </div>
  );
}
