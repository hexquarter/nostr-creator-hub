import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { AvatarTile } from "@/components/avatar-tile";
import { Search, Zap, Send, ShieldCheck, Plus, Loader2, LogIn } from "lucide-react";
import { useUI } from "@/components/modals/ui-provider";
import { useNostr } from "@/components/nostr-provider";
import { emptyProfile, fetchProfiles, normalizePubkey, type Profile } from "@/lib/nostr/profiles";
import { groupThreads, type DirectMessage } from "@/lib/nostr/dm";
import { timeAgo } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>): { to?: string } => ({
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — Crays" },
      {
        name: "description",
        content: "End-to-end encrypted DMs over Nostr, with Lightning built in.",
      },
    ],
  }),
  component: Messages,
});

function Messages() {
  const ui = useUI();
  const nostr = useNostr();
  const search = Route.useSearch();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const pubkey = nostr.account?.pubkey;

  const load = useCallback(async () => {
    if (!pubkey) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await nostr.fetchDMs();
      setMessages(list);
      const counterparties = Array.from(new Set(list.map((m) => (m.mine ? m.to : m.from))));
      if (counterparties.length > 0) {
        const fetched = await fetchProfiles(counterparties);
        const map: Record<string, Profile> = {};
        for (const [key, profile] of fetched) map[key] = profile;
        setProfiles(map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your messages.");
    } finally {
      setLoading(false);
    }
  }, [pubkey, nostr]);

  useEffect(() => {
    void load();
  }, [load]);

  const threads = useMemo(() => groupThreads(messages), [messages]);

  useEffect(() => {
    const requested = search.to ? normalizePubkey(search.to) : null;
    if (requested) setSelected(requested);
  }, [search.to]);

  useEffect(() => {
    if (!selected && threads.length > 0) setSelected(threads[0].counterparty);
  }, [selected, threads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [selected, messages.length]);

  const profileFor = (id: string) => profiles[id] ?? emptyProfile(id);
  const nameFor = (id: string) => {
    const profile = profileFor(id);
    return profile.displayName || profile.name || profile.handle;
  };

  const visibleThreads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => {
      const profile = profileFor(thread.counterparty);
      return (
        nameFor(thread.counterparty).toLowerCase().includes(needle) ||
        profile.handle.toLowerCase().includes(needle) ||
        thread.last.content.toLowerCase().includes(needle)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, query, profiles]);

  const conversation = useMemo(
    () => (selected ? messages.filter((m) => (m.mine ? m.to : m.from) === selected) : []),
    [messages, selected],
  );

  const send = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      await nostr.sendDM(selected, draft.trim());
      setDraft("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that message.");
    } finally {
      setSending(false);
    }
  };

  if (!nostr.account) {
    return (
      <PageShell title="Messages" subtitle="End-to-end encrypted over Nostr." rightSidebar={false}>
        <div className="rounded-2xl bg-white p-10 text-center shadow-card ring-1 ring-black/5">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand/10 text-brand">
            <LogIn className="size-6" />
          </div>
          <p className="mt-3 text-[15px] font-semibold text-zinc-900">
            Sign in to read your messages
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-zinc-500">
            DMs are encrypted to your Nostr key. Crays can only read them while you're signed in.
          </p>
          <button
            onClick={() => ui.openAuth({ intent: "read your messages" })}
            className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
          >
            Sign in / Create
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Messages" subtitle="End-to-end encrypted over Nostr." rightSidebar={false}>
      <div className="grid h-[calc(100vh-200px)] min-h-[560px] grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Threads */}
        <aside className="flex flex-col border-r border-zinc-100">
          <div className="border-b border-zinc-100 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages…"
                className="w-full rounded-lg bg-zinc-100/80 py-2 pl-9 pr-3 text-[12.5px] outline-none placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-brand/40"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {loading && threads.length === 0 ? (
              <li className="flex items-center justify-center gap-2 py-8 text-[12px] text-zinc-400">
                <Loader2 className="size-4 animate-spin" /> Decrypting…
              </li>
            ) : visibleThreads.length === 0 ? (
              <li className="px-4 py-8 text-center text-[12.5px] text-zinc-400">
                {error || "No conversations yet. Start one with the button below."}
              </li>
            ) : (
              visibleThreads.map((thread) => {
                const profile = profileFor(thread.counterparty);
                const name = nameFor(thread.counterparty);
                const active = selected === thread.counterparty;
                return (
                  <li key={thread.counterparty}>
                    <button
                      onClick={() => setSelected(thread.counterparty)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        active ? "bg-brand/5" : "hover:bg-zinc-50"
                      }`}
                    >
                      {profile.picture ? (
                        <img
                          src={profile.picture}
                          alt=""
                          className="size-10 rounded-full object-cover"
                        />
                      ) : (
                        <AvatarTile seed={name} size={40} />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-zinc-900">{name}</p>
                          <span className="shrink-0 text-[10.5px] text-zinc-400">
                            {timeAgo(thread.last.createdAt)}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-[12px] text-zinc-500">
                          {thread.last.mine ? "You: " : ""}
                          {thread.last.content}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <button
            onClick={ui.openNewDM}
            className="m-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2.5 text-[12.5px] font-semibold text-white hover:bg-black"
          >
            <Plus className="size-3.5" /> New message
          </button>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-0 flex-col">
          {selected ? (
            <>
              <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  {profileFor(selected).picture ? (
                    <img
                      src={profileFor(selected).picture}
                      alt=""
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <AvatarTile seed={nameFor(selected)} size={36} />
                  )}
                  <div>
                    <p className="text-[13.5px] font-semibold text-zinc-900">{nameFor(selected)}</p>
                    <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <ShieldCheck className="size-3 text-emerald-500" /> Encrypted ·{" "}
                      {profileFor(selected).handle}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => ui.openZap({ recipient: nameFor(selected), pubkey: selected })}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-[11.5px] font-semibold text-amber-700 hover:bg-amber-100"
                >
                  <Zap className="size-3.5" /> Zap
                </button>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto bg-zinc-50/50 px-5 py-6">
                {conversation.length === 0 ? (
                  <p className="py-10 text-center text-[12.5px] text-zinc-400">
                    No messages yet. Say hello 👋
                  </p>
                ) : (
                  conversation.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${
                          message.mine
                            ? "rounded-br-md bg-brand text-white"
                            : "rounded-bl-md bg-white text-zinc-800 ring-1 ring-black/5"
                        }`}
                      >
                        {message.content}
                        <span
                          className={`ml-2 text-[10px] ${
                            message.mine ? "text-white/70" : "text-zinc-400"
                          }`}
                        >
                          {new Date(message.createdAt * 1000).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-zinc-100 p-3">
                <div className="flex items-end gap-2 rounded-xl bg-zinc-100/80 p-2">
                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Write an encrypted message…"
                    className="min-h-9 flex-1 resize-none bg-transparent py-2 text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={sending || !draft.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-zinc-100 text-zinc-400">
                  <ShieldCheck className="size-6" />
                </div>
                <p className="mt-3 text-[14px] font-semibold text-zinc-900">
                  Select a conversation
                </p>
                <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-zinc-500">
                  Or start a new encrypted chat with anyone on Nostr.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
