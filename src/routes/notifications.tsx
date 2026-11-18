import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { useNostr } from "@/components/nostr-provider";
import { useUI } from "@/components/modals/ui-provider";
import { fetchNotifications, type NotificationItem } from "@/lib/nostr/social";
import { compactNumber, timeAgo } from "@/lib/format";
import { Zap, Repeat2, MessageCircle, AtSign, Loader2, Heart, BellOff } from "lucide-react";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Crays" },
      {
        name: "description",
        content: "Zaps, replies, follows and mentions across your Crays feed.",
      },
    ],
  }),
  component: Notifications,
});

const meta = {
  zap: { icon: Zap, color: "text-amber-500", bg: "bg-amber-50", label: "Zaps" },
  reply: { icon: MessageCircle, color: "text-brand", bg: "bg-brand/10", label: "Replies" },
  reaction: { icon: Heart, color: "text-rose-500", bg: "bg-rose-50", label: "Reactions" },
  repost: { icon: Repeat2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Reposts" },
  mention: { icon: AtSign, color: "text-violet-600", bg: "bg-violet-50", label: "Mentions" },
} as const;

const tabs = ["All", "Mentions", "Zaps", "Replies", "Reactions"] as const;
type Tab = (typeof tabs)[number];

function Notifications() {
  const nostr = useNostr();
  const ui = useUI();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("All");

  const pubkey = nostr.account?.pubkey;

  useEffect(() => {
    if (!pubkey) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchNotifications(pubkey)
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  const visible = useMemo(() => {
    if (tab === "All") return items;
    if (tab === "Mentions") return items.filter((i) => i.kind === "mention" || i.kind === "reply");
    if (tab === "Zaps") return items.filter((i) => i.kind === "zap");
    if (tab === "Replies") return items.filter((i) => i.kind === "reply");
    return items.filter((i) => i.kind === "reaction");
  }, [items, tab]);

  return (
    <PageShell
      title="Notifications"
      subtitle="Zaps, replies, reactions and mentions — all in one place."
      actions={
        <button
          onClick={() => {
            if (!pubkey) {
              ui.openAuth({ intent: "see your notifications" });
              return;
            }
            setLoading(true);
            fetchNotifications(pubkey)
              .then(setItems)
              .catch(() => undefined)
              .finally(() => setLoading(false));
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[12px] font-semibold text-zinc-700 shadow-card ring-1 ring-black/5 hover:bg-zinc-50"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : null} Refresh
        </button>
      }
    >
      <div className="flex items-center gap-1 rounded-full bg-white p-1 text-[12px] font-medium shadow-card ring-1 ring-black/5 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              tab === t ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!pubkey ? (
        <Gate
          title="Sign in to see notifications"
          body="Zaps, replies and mentions are tied to your Nostr key."
          action="Sign in"
          onAction={() => ui.openAuth({ intent: "see your notifications" })}
        />
      ) : loading && items.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-zinc-400">
          <Loader2 className="size-4 animate-spin" /> Reading relays…
        </p>
      ) : visible.length === 0 ? (
        <Gate
          title="Nothing here yet"
          body="When people zap, reply to or react to your notes, it shows up here."
          action="Write a post"
          onAction={() => ui.openCompose({ mode: "post" })}
          icon={BellOff}
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 divide-y divide-zinc-100">
          {visible.map((n) => {
            const m = meta[n.kind];
            const name = n.actor.displayName || n.actor.name || n.actor.handle;
            const mention = `nostr:${n.actor.npub}`;
            return (
              <li
                key={n.id}
                className="relative flex items-start gap-4 px-5 py-4 transition-colors hover:bg-zinc-50/80"
              >
                <div className="relative">
                  {n.actor.picture ? (
                    <img
                      src={n.actor.picture}
                      alt=""
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid size-10 place-items-center rounded-full bg-zinc-100 text-[13px] font-semibold text-zinc-500">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-white ${m.bg}`}
                  >
                    <m.icon className={`size-3 ${m.color}`} strokeWidth={2.4} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-zinc-700">
                    <span className="font-semibold text-zinc-900">{name}</span>{" "}
                    <span className="text-zinc-400">{n.actor.handle}</span>{" "}
                    {n.kind === "zap" && (
                      <>
                        zapped you{" "}
                        {n.amountSats ? (
                          <span className="font-semibold text-amber-600">
                            {compactNumber(n.amountSats)} sats
                          </span>
                        ) : null}
                      </>
                    )}
                    {n.kind === "reply" && "replied to your note"}
                    {n.kind === "reaction" && "reacted to your note"}
                    {n.kind === "repost" && "reposted your note"}
                    {n.kind === "mention" && "mentioned you"}
                  </p>
                  {n.text && (
                    <p className="mt-1 line-clamp-2 max-w-[60ch] text-[12.5px] text-zinc-500">
                      {n.text.replace(mention, `@${n.actor.handle}`)}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-400">{timeAgo(n.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}

function Gate({
  title,
  body,
  action,
  onAction,
  icon: Icon,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-black/5">
      {Icon && (
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400">
          <Icon className="size-6" />
        </div>
      )}
      <p className="mt-3 text-[14px] font-semibold text-zinc-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">{body}</p>
      <button
        onClick={onAction}
        className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
      >
        {action}
      </button>
    </div>
  );
}
