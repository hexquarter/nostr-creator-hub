import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { Search, Zap, Paperclip, Smile, Send, ShieldCheck, Plus } from "lucide-react";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Crays" },
      { name: "description", content: "End-to-end encrypted DMs over Nostr, with Lightning built in." },
    ],
  }),
  component: Messages,
});

const threads = [
  { name: "Lyn Alden", handle: "@lyn", preview: "That essay you sent — chef's kiss. Mind if I quote a piece?", time: "2m", unread: 2, active: true },
  { name: "Jack D.", handle: "@jack", preview: "Sent you 5,000 sats ⚡", time: "18m", unread: 0 },
  { name: "Aura Labs", handle: "@aura", preview: "Beta invites going out tomorrow morning.", time: "1h", unread: 1 },
  { name: "Pierre R.", handle: "@pierre", preview: "Yeah, NIP-44 should land before EOY.", time: "3h", unread: 0 },
  { name: "Marty Bent", handle: "@marty", preview: "Recording is up — let me know what you think.", time: "Yesterday", unread: 0 },
  { name: "Elena Vega", handle: "@elena", preview: "We should sync on the onboarding flow.", time: "Mon", unread: 0 },
];

const conversation = [
  { from: "them", text: "Hey — caught your post on liquidity cycles. Really sharp framing.", time: "10:22" },
  { from: "me", text: "Appreciate that. Took two weeks of revisions to land the through-line.", time: "10:24" },
  { from: "them", text: "That essay you sent — chef's kiss. Mind if I quote a piece?", time: "10:31" },
  { from: "them", kind: "zap", amount: "2,100 sats", note: "for the macro essay 🙏", time: "10:32" },
];

function Messages() {
  return (
    <PageShell title="Messages" subtitle="End-to-end encrypted over Nostr." rightSidebar={false}>
      <div className="grid h-[calc(100vh-200px)] min-h-[560px] grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Threads */}
        <aside className="flex flex-col border-r border-zinc-100">
          <div className="border-b border-zinc-100 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                placeholder="Search messages…"
                className="w-full rounded-lg bg-zinc-100/80 py-2 pl-9 pr-3 text-[12.5px] outline-none placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-brand/40"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {threads.map((t) => (
              <li key={t.handle}>
                <button
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                    t.active ? "bg-brand/5" : "hover:bg-zinc-50"
                  }`}
                >
                  <AvatarTile seed={t.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-zinc-900">{t.name}</p>
                      <span className="shrink-0 text-[10.5px] text-zinc-400">{t.time}</span>
                    </div>
                    <p className="line-clamp-1 text-[12px] text-zinc-500">{t.preview}</p>
                  </div>
                  {t.unread > 0 && (
                    <span className="mt-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                      {t.unread}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button className="m-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2.5 text-[12.5px] font-semibold text-white hover:bg-black">
            <Plus className="size-3.5" /> New message
          </button>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <AvatarTile seed="Lyn Alden" size={36} />
              <div>
                <p className="text-[13.5px] font-semibold text-zinc-900">Lyn Alden</p>
                <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                  <ShieldCheck className="size-3 text-emerald-500" /> Encrypted · @lyn
                </p>
              </div>
            </div>
            <button className="rounded-lg bg-amber-50 px-3 py-1.5 text-[11.5px] font-semibold text-amber-700 hover:bg-amber-100 inline-flex items-center gap-1">
              <Zap className="size-3.5" /> Zap
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-zinc-50/50 px-5 py-6">
            <div className="flex justify-center">
              <span className="rounded-full bg-white px-3 py-1 text-[10.5px] text-zinc-400 ring-1 ring-black/5">
                Today
              </span>
            </div>
            {conversation.map((m, i) => {
              if (m.kind === "zap") {
                return (
                  <div key={i} className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-gradient-to-br from-amber-50 to-orange-50 p-4 ring-1 ring-amber-200/60">
                      <div className="flex items-center gap-2">
                        <div className="grid size-8 place-items-center rounded-lg bg-amber-500 text-white">
                          <Zap className="size-4" strokeWidth={2.5} />
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-zinc-900">{m.amount}</p>
                          <p className="text-[11px] text-zinc-500">{m.note}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              const mine = m.from === "me";
              return (
                <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                      mine
                        ? "rounded-br-md bg-brand text-white"
                        : "rounded-bl-md bg-white text-zinc-800 ring-1 ring-black/5"
                    }`}
                  >
                    {m.text}
                    <span className={`ml-2 text-[10px] ${mine ? "text-white/70" : "text-zinc-400"}`}>
                      {m.time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-zinc-100 p-3">
            <div className="flex items-end gap-2 rounded-xl bg-zinc-100/80 p-2">
              <button className="grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-white hover:text-zinc-700">
                <Paperclip className="size-4" />
              </button>
              <textarea
                rows={1}
                placeholder="Write an encrypted message…"
                className="min-h-9 flex-1 resize-none bg-transparent py-2 text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400"
              />
              <button className="grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-white hover:text-zinc-700">
                <Smile className="size-4" />
              </button>
              <button className="grid size-9 place-items-center rounded-lg text-amber-500 hover:bg-amber-50">
                <Zap className="size-4" strokeWidth={2.4} />
              </button>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand/90">
                <Send className="size-3.5" /> Send
              </button>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
