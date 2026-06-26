import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/following")({
  head: () => ({
    meta: [
      { title: "Following — Stellar" },
      { name: "description", content: "Following on Stellar — a premium Nostr client for Bitcoin creators." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Following"
      blurb="A focused, beautiful following experience is on the way."
    />
  ),
});
