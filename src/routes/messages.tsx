import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Stellar" },
      { name: "description", content: "Messages on Stellar — a premium Nostr client for Bitcoin creators." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Messages"
      blurb="A focused, beautiful messages experience is on the way."
    />
  ),
});
