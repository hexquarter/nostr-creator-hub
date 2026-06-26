import { AvatarTile } from "./avatar-tile";

const creators = [
  { name: "Satoshi N.", handle: "@satoshi", live: true },
  { name: "Lyn Alden", handle: "@lyn", live: false },
  { name: "Marty Bent", handle: "@marty", live: false },
  { name: "Jack D.", handle: "@jack", live: true },
  { name: "Elena V.", handle: "@elena", live: false },
  { name: "Aura Labs", handle: "@aura", live: false },
  { name: "Erik Wall", handle: "@erik", live: false },
  { name: "Pierre R.", handle: "@pierre", live: false },
];

export function FeaturedCreators() {
  return (
    <section
      aria-label="Featured creators"
      className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2 no-scrollbar"
    >
      {creators.map((c, i) => (
        <button
          key={c.handle}
          className="group shrink-0 text-center transition-transform hover:-translate-y-0.5"
        >
          <div
            className={`relative mb-2 rounded-2xl p-0.5 ${
              i === 0 || c.live
                ? "bg-gradient-to-br from-brand to-violet-500"
                : "bg-zinc-200"
            }`}
          >
            <div className="rounded-[14px] bg-white p-0.5">
              <AvatarTile seed={c.name} size={56} rounded="2xl" className="!rounded-[12px]" />
            </div>
            {c.live && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm">
                Live
              </span>
            )}
          </div>
          <p className="text-[10.5px] font-medium text-zinc-600 group-hover:text-zinc-900">
            {c.handle}
          </p>
        </button>
      ))}
    </section>
  );
}
