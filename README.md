# Crays

A premium Nostr client for Bitcoin creators: passkey-first sign-in, real Nostr
profiles and feeds, Lightning zaps, members-only posts, and Instagram import.

## Local development

```bash
yarn install
yarn dev         # http://localhost:8080
```

Useful checks:

```bash
yarn tsc --noEmit   # types
yarn lint           # eslint
yarn build          # production build
```

## Deploying to GitHub Pages

The app is a TanStack Start project, but it only needs a static host: every
route is pre-rendered to HTML at build time and the client router takes over
after hydration.

1. Push this repository to GitHub.
2. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually from
   the **Actions** tab).

The workflow in `.github/workflows/deploy.yml` type-checks, lints, builds and
publishes `dist/client` through the official Pages actions.

### How the static build works

`vite.config.ts` switches to static mode only when `GITHUB_PAGES=true`:

| Setting                          | Effect                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `BASE_PATH`                      | Asset and router prefix. `/<repo>/` for project sites, `/` for `<user>.github.io` sites. The workflow computes it. |
| `VITE_STATIC_HOSTING`            | Turns off features that need a server (fetching an Instagram link). Instagram export uploads keep working.         |
| `nitro: false`                   | Skips the server bundle — GitHub Pages can't run one.                                                              |
| `prerender`                      | Renders `/`, `/discover`, `/profile`, `/premium`, … to `dist/client/<route>/index.html`.                           |
| `scripts/gh-pages-postbuild.mjs` | Adds `.nojekyll` (so `assets/` isn't stripped) and a branded `404.html`.                                           |

Build it locally the same way CI does:

```bash
GITHUB_PAGES=true VITE_STATIC_HOSTING=true BASE_PATH=/<repo>/ yarn build
npx serve dist/client   # or any static server, mounted at /<repo>/
```

Without `GITHUB_PAGES=true`, `yarn build` keeps the default server output
(`.output/`) used by Lovable/Cloudflare.
