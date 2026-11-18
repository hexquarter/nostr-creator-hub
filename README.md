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

## Crays premium payments

Creators pay for Crays premium in sats. Checkout resolves the configured
Lightning address (or LNURL) into a real BOLT-11 invoice, shows it as a QR, and
polls the wallet's [LUD-21](https://github.com/lnurl/luds/blob/luds/21.md)
`verify` endpoint. The badge turns on only after the payment settles — there is
no "I've paid" button. The same verification unlocks fan memberships and
single-post purchases, so scanning with any wallet works.

Card on-ramp buttons (Cash App, MoonPay, Spark) sit next to the QR for people
who don't hold sats yet. Cash App deep-links straight into the invoice; MoonPay
and Spark open a hosted buy flow and the buyer pays the invoice afterwards.

| Variable                       | Purpose                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CRAYS_LIGHTNING_ADDRESS` | Lightning address (or LNURL) that receives Crays premium. Required — the `crays@npub.cash` fallback cannot issue invoices. |
| `VITE_CRAYS_MOONPAY_URL`       | Optional MoonPay merchant URL. Defaults to MoonPay's public buy page.                                                      |
| `VITE_CRAYS_SPARK_URL`         | Optional Spark checkout URL. Defaults to `spark.money`.                                                                    |
| `VITE_CRAYS_CASHAPP_URL`       | Optional Cash App override. Otherwise the modal deep-links `cash.app/launch/lightning/<invoice>` once an invoice exists.   |

Set these at build time (for GitHub Pages, add them to the workflow `env:` block
or as repository variables). To create the receiving address, claim a username
for the Crays npub at [npub.cash](https://npub.cash) (or use any LNURL-pay
address) and put it in `VITE_CRAYS_LIGHTNING_ADDRESS`. Until then the modal
shows a "checkout is almost ready" notice instead of a QR.

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
