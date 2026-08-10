import { createFileRoute } from "@tanstack/react-router";
import { LeftSidebar } from "@/components/left-sidebar";
import { RightSidebar } from "@/components/right-sidebar";
import { Composer } from "@/components/composer";
import { FeaturedCreators } from "@/components/featured-creators";
import { PostCard, type Post } from "@/components/post-card";
import { PremiumPost } from "@/components/premium-post";
import { MobileNav } from "@/components/mobile-nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Crays — A premium Nostr social client for Bitcoin creators" },
      {
        name: "description",
        content:
          "Follow creators, unlock premium content with Lightning, and grow a paid audience on the open Nostr protocol.",
      },
      { property: "og:title", content: "Crays — Nostr for Bitcoin creators" },
      {
        property: "og:description",
        content:
          "Follow creators, unlock premium content with Lightning, and grow a paid audience on the open Nostr protocol.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Home,
});

const posts: Post[] = [
  {
    id: "1",
    author: "Erik Wall",
    handle: "@erik",
    verified: true,
    time: "14m",
    content:
      "The transition from custodial to non-custodial ecash mints is going to be the defining moment for Bitcoin UX this year — hiding the complexity while keeping the sovereignty.",
    replies: 12,
    zaps: "128k",
    reposts: 24,
  },
  {
    id: "2",
    author: "Aura Labs",
    handle: "@aura",
    verified: true,
    time: "42m",
    content:
      "Just shipped a small thing I'm proud of: long-form articles with inline Lightning invoices, native to Nostr. Writers keep 100% of what readers send. No middlemen. No platforms. ⚡",
    image: {
      gradient:
        "linear-gradient(135deg, #1e293b 0%, #1e3a8a 35%, #6366f1 70%, #a78bfa 100%)",
      aspect: "aspect-[16/9]",
    },
    replies: 38,
    zaps: "412k",
    reposts: 91,
  },
  {
    id: "3",
    author: "Nova Sen",
    handle: "@nova",
    premium: true,
    time: "1h",
    content:
      "New photo set is up for members. Marked sensitive so it stays blurred in the feed until you choose to see it.",
    image: {
      gradient:
        "linear-gradient(135deg, #fda4af 0%, #f43f5e 45%, #7c3aed 100%)",
      aspect: "aspect-[4/5]",
    },
    sensitive: { reason: "Nudity", note: "Members-only photo set — tap to reveal." },
    replies: 21,
    zaps: "96k",
    reposts: 8,
  },
];

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 sm:px-6 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[224px_minmax(0,1fr)_320px]">
        <LeftSidebar />

        <main className="space-y-6 pb-28 lg:py-6 lg:pb-6">
          <MobileTopBar />

          <header className="hidden items-end justify-between lg:flex">
            <div>
              <h1 className="text-[26px] font-semibold leading-none tracking-tight text-zinc-900">
                Home
              </h1>
              <p className="mt-1.5 text-[13px] text-zinc-500">
                Your feed from the creators you follow.
              </p>
            </div>
            <div className="hidden items-center gap-1 rounded-full bg-white p-1 text-[12px] font-medium shadow-card ring-1 ring-black/5 sm:flex">
              <button className="rounded-full bg-zinc-900 px-3 py-1 text-white">
                For you
              </button>
              <button className="rounded-full px-3 py-1 text-zinc-500 hover:text-zinc-900">
                Following
              </button>
              <button className="rounded-full px-3 py-1 text-zinc-500 hover:text-zinc-900">
                Premium
              </button>
            </div>
          </header>

          <FeaturedCreators />

          <div className="hidden lg:block">
            <Composer />
          </div>

          <div className="space-y-5">
            <PostCard post={posts[0]} />
            <PremiumPost />
            <PostCard post={posts[1]} />
            <PostCard post={posts[2]} />
          </div>
        </main>

        <RightSidebar />
      </div>
      <MobileNav />
    </div>
  );
}

