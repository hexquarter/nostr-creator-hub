/** Small presentation helpers shared across the app. */
export function timeAgo(unixSeconds: number) {
  if (!unixSeconds) return "";
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - unixSeconds);
  if (delta < 45) return "now";
  if (delta < 3600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h`;
  if (delta < 604_800) return `${Math.floor(delta / 86_400)}d`;
  const date = new Date(unixSeconds * 1000);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function compactNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

export function displayHandle(profile: { handle?: string; npub?: string }) {
  return profile.handle || (profile.npub ? `${profile.npub.slice(0, 10)}…` : "");
}
