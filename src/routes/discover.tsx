import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Discover — Stellar" },
      { name: "description", content: "Discover on Stellar — a premium Nostr client for Bitcoin creators." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Discover"
      blurb="A focused, beautiful discover experience is on the way."
    />
  ),
});
