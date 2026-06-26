import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { Zap, Repeat2, MessageCircle, UserPlus, AtSign, Check } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Crays" },
      { name: "description", content: "Zaps, replies, follows and mentions across your Crays feed." },
    ],
  }),
  component: Notifications,
});

type Item = {
  id: string;
  kind: "zap" | "reply" | "follow" | "repost" | "mention";
  who: string;
  handle: string;
  amount?: string;
  text?: string;
  time: string;
  unread?: boolean;
};

const items: Item[] = [
  { id: "1", kind: "zap", who: "Jack Dorsey", handle: "@jack", amount: "21,000 sats", text: "Loved your take on Lightning UX.", time: "2m", unread: true },
  { id: "2", kind: "reply", who: "Lyn Alden", handle: "@lyn", text: "Strong framing — the macro overlay maps almost 1:1 with what I'm seeing in EM flows.", time: "12m", unread: true },
  { id: "3", kind: "follow", who: "Pierre Rochard", handle: "@pierre", time: "32m", unread: true },
  { id: "4", kind: "zap", who: "Aura Labs", handle: "@aura", amount: "5,000 sats", text: "for the article ⚡", time: "1h" },
  { id: "5", kind: "repost", who: "Marty Bent", handle: "@marty", text: "Reposted your thread on fee markets.", time: "2h" },
  { id: "6", kind: "mention", who: "Elena Vega", handle: "@elena", text: "Want to bring you on the Spaces panel — DM me.", time: "3h" },
  { id: "7", kind: "follow", who: "Saifedean Ammous", handle: "@saif", time: "5h" },
  { id: "8", kind: "zap", who: "Erik Wall", handle: "@erik", amount: "1,000 sats", time: "Yesterday" },
];

const meta = {
  zap: { icon: Zap, color: "text-amber-500", bg: "bg-amber-50" },
  reply: { icon: MessageCircle, color: "text-brand", bg: "bg-brand/10" },
  follow: { icon: UserPlus, color: "text-emerald-600", bg: "bg-emerald-50" },
  repost: { icon: Repeat2, color: "text-emerald-600", bg: "bg-emerald-50" },
  mention: { icon: AtSign, color: "text-violet-600", bg: "bg-violet-50" },
} as const;

const tabs = ["All", "Mentions", "Zaps", "Follows", "Replies"] as const;

function Notifications() {
  return (
    <PageShell
      title="Notifications"
      subtitle="Zaps, replies, follows and mentions — all in one place."
      actions={
        <button className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-zinc-700 shadow-card ring-1 ring-black/5 hover:bg-zinc-50">
          <Check className="size-3.5" /> Mark all read
        </button>
      }
    >
      <div className="flex items-center gap-1 rounded-full bg-white p-1 text-[12px] font-medium shadow-card ring-1 ring-black/5 w-fit">
        {tabs.map((t, i) => (
          <button
            key={t}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              i === 0 ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 divide-y divide-zinc-100">
        {items.map((n) => {
          const m = meta[n.kind];
          return (
            <li
              key={n.id}
              className={`relative flex items-start gap-4 px-5 py-4 transition-colors hover:bg-zinc-50/80 ${
                n.unread ? "bg-brand/[0.025]" : ""
              }`}
            >
              {n.unread && <span className="absolute left-2 top-6 size-1.5 rounded-full bg-brand" />}
              <div className="relative">
                <AvatarTile seed={n.who} size={40} />
                <span
                  className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-white ${m.bg}`}
                >
                  <m.icon className={`size-3 ${m.color}`} strokeWidth={2.4} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-zinc-700">
                  <span className="font-semibold text-zinc-900">{n.who}</span>{" "}
                  <span className="text-zinc-400">{n.handle}</span>{" "}
                  {n.kind === "zap" && (
                    <>
                      sent you{" "}
                      <span className="font-semibold text-amber-600">{n.amount}</span>
                    </>
                  )}
                  {n.kind === "reply" && "replied to your post"}
                  {n.kind === "follow" && "started following you"}
                  {n.kind === "repost" && "reposted your post"}
                  {n.kind === "mention" && "mentioned you"}
                </p>
                {n.text && (
                  <p className="mt-1 line-clamp-2 max-w-[60ch] text-[12.5px] text-zinc-500">
                    {n.text}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-zinc-400">{n.time}</p>
              </div>
              {n.kind === "follow" && (
                <button className="rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-zinc-700">
                  Follow back
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </PageShell>
  );
}
