import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Stellar" },
      { name: "description", content: "Settings on Stellar — a premium Nostr client for Bitcoin creators." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Settings"
      blurb="A focused, beautiful settings experience is on the way."
    />
  ),
});
