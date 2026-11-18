// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * GitHub Pages is a plain static host, so it needs a different build than the
 * Lovable/Cloudflare one: no server bundle, every route rendered to HTML, and
 * an asset prefix for project sites (`https://<user>.github.io/<repo>/`).
 *
 * The deploy workflow sets `GITHUB_PAGES=true` and `BASE_PATH=/<repo>/`.
 * Local and Lovable builds keep the default server output.
 */
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const base = process.env.BASE_PATH ?? "/";

const ROUTES = [
  "/",
  "/bookmarks",
  "/discover",
  "/following",
  "/messages",
  "/notifications",
  "/premium",
  "/profile",
  "/settings",
  "/wallet",
];

export default defineConfig({
  vite: isGitHubPages ? { base } : undefined,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Pre-render each route so GitHub Pages can answer the URL with a real HTML
    // file (it has no server to run SSR). Client-side routing takes over after
    // hydration.
    prerender: isGitHubPages
      ? { enabled: true, crawlLinks: false, failOnError: true, pages: ROUTES }
      : undefined,
  },
  // Static hosting has nothing to run a server bundle on. TanStack Start still
  // writes the prerendered HTML plus client assets to `dist/client`.
  nitro: isGitHubPages ? false : undefined,
});
