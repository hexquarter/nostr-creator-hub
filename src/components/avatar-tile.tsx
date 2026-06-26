type Props = {
  seed: string;
  size?: number;
  className?: string;
  rounded?: "full" | "xl" | "2xl";
};

// Deterministic gradient avatar based on a seed string.
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const palettes = [
  ["#60a5fa", "#a78bfa"],
  ["#34d399", "#22d3ee"],
  ["#fb7185", "#f59e0b"],
  ["#a78bfa", "#ec4899"],
  ["#38bdf8", "#818cf8"],
  ["#f472b6", "#fb923c"],
  ["#10b981", "#3b82f6"],
  ["#facc15", "#f97316"],
];

export function AvatarTile({ seed, size = 40, className = "", rounded = "full" }: Props) {
  const h = hash(seed);
  const [a, b] = palettes[h % palettes.length];
  const angle = h % 360;
  const initials = seed
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const radius =
    rounded === "full" ? "rounded-full" : rounded === "xl" ? "rounded-xl" : "rounded-2xl";

  return (
    <div
      className={`${radius} flex items-center justify-center text-white font-semibold shrink-0 outline-1 -outline-offset-1 outline-black/5 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${angle}deg, ${a}, ${b})`,
        fontSize: Math.max(10, size * 0.34),
        letterSpacing: "-0.02em",
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
