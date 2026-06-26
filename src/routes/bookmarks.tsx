import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/bookmarks")({
  head: () => ({
    meta: [
      { title: "Bookmarks — Stellar" },
      { name: "description", content: "Bookmarks on Stellar — a premium Nostr client for Bitcoin creators." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Bookmarks"
      blurb="A focused, beautiful bookmarks experience is on the way."
    />
  ),
});
