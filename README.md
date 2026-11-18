# Crays

A premium Nostr client for Bitcoin creators: passkey-first sign-in, real Nostr
profiles and feeds, Lightning zaps, and members-only posts.

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

## Crays premium payments

Creators pay for Crays premium in sats. Checkout resolves the configured
Lightning address (or LNURL) into a real BOLT-11 invoice, shows it as a QR, and
polls the wallet's [LUD-21](https://github.com/lnurl/luds/blob/luds/21.md)
`verify` endpoint. The badge turns on only after the payment settles — there is
no "I've paid" button. The same verification unlocks fan memberships and
single-post purchases, so scanning with any wallet works.

Checkout is Lightning-only — there is no card or stablecoin tab. Buyers who
don't hold sats can use any wallet or on-ramp that funds a Lightning payment,
then scan the same invoice.

| Variable                       | Purpose                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CRAYS_LIGHTNING_ADDRESS` | Lightning address (or LNURL) that receives Crays premium. Required — the `crays@npub.cash` fallback cannot issue invoices. |

Set this at build time. For GitHub Pages, add the `CRAYS_LIGHTNING_ADDRESS`
repository variable under **Settings → Secrets and variables → Actions →
Variables**; `.github/workflows/deploy.yml` maps it to
`VITE_CRAYS_LIGHTNING_ADDRESS`. Leaving it unset keeps the placeholder
checkout. To create the receiving address, claim a username for the Crays npub
at [npub.cash](https://npub.cash) (or use any LNURL-pay address) and set
`CRAYS_LIGHTNING_ADDRESS`. Until then the modal shows a "checkout is almost
ready" notice instead of a QR.

The `verify` endpoint is optional per LUD-21. If a wallet doesn't expose one,
the creator checkout asks the buyer to connect a wallet and pay in one tap,
which confirms locally; fan purchases keep a clearly-labelled manual unlock for
those addresses.

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
