import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Stellar" },
      { name: "description", content: "Profile on Stellar — a premium Nostr client for Bitcoin creators." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Profile"
      blurb="A focused, beautiful profile experience is on the way."
    />
  ),
});
