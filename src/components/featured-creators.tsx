import { AvatarTile } from "./avatar-tile";
import type { Profile } from "@/lib/nostr/profiles";

export function FeaturedCreators({ profiles }: { profiles: Profile[] }) {
  if (profiles.length === 0) return null;
  return (
    <section
      aria-label="Featured creators"
      className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2 no-scrollbar"
    >
      {profiles.map((profile, i) => {
        const name = profile.displayName || profile.name || profile.handle;
        return (
          <button
            key={profile.pubkey}
            className="group shrink-0 text-center transition-transform hover:-translate-y-0.5"
            title={name}
          >
            <div
              className={`relative mb-2 rounded-2xl p-0.5 ${
                i === 0 ? "bg-gradient-to-br from-brand to-violet-500" : "bg-zinc-200"
              }`}
            >
              <div className="rounded-[14px] bg-white p-0.5">
                {profile.picture ? (
                  <img
                    src={profile.picture}
                    alt=""
                    className="size-14 rounded-[12px] object-cover"
                  />
                ) : (
                  <AvatarTile seed={name} size={56} rounded="2xl" className="!rounded-[12px]" />
                )}
              </div>
            </div>
            <p className="max-w-[64px] truncate text-[10.5px] font-medium text-zinc-600 group-hover:text-zinc-900">
              {profile.handle || name}
            </p>
          </button>
        );
      })}
    </section>
  );
}
