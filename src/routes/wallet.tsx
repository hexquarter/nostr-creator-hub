import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet — Stellar" },
      { name: "description", content: "Wallet on Stellar — a premium Nostr client for Bitcoin creators." },
    ],
  }),
  component: () => (
    <ComingSoon
      title="Wallet"
      blurb="A focused, beautiful wallet experience is on the way."
    />
  ),
});
