import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Premium — Stellar" },
      { name: "description", content: "Premium on Stellar — a premium Nostr client for Bitcoin creators." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Premium"
      blurb="A focused, beautiful premium experience is on the way."
    />
  ),
});
