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

Card and stablecoin payments live in a **Card** tab next to the QR. The flow
follows the
[Breez Spark SDK buy-bitcoin guide](https://sdk-doc-spark.breez.technology/guide/buy_bitcoin.html):

- **MoonPay** opens its hosted checkout with the USD amount prefilled. Set
  `VITE_CRAYS_MOONPAY_URL` to an SDK-generated `buy_bitcoin` URL to enable the
  signed Apple Pay / Google Pay checkout for the Crays account. The buyer pays
  the Lightning invoice afterwards, so the same LUD-21 check confirms it.
- **USDC / USDT** sends the stablecoin directly to the Crays address, shown as a
  QR with a copy button. Set `VITE_CRAYS_USDC_ADDRESS` and
  `VITE_CRAYS_USDT_ADDRESS` (plus their network labels) to turn these rows on.
  The amount is simply `$50`, since stablecoins are 1:1 with the dollar.
  Transfers can't be verified from the browser, so this path has a clearly
  labelled "I've sent it — activate" confirmation. Only confirm after the
  transfer is sent.

The full Spark SDK widget needs a Breez API key and a native or server runtime,
so this static build deep-links the providers instead. Apple Pay requires
Safari and Google Pay requires Chrome; both fail inside an iframe or plain web
view.

| Variable                       | Purpose                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `VITE_CRAYS_LIGHTNING_ADDRESS` | Lightning address (or LNURL) that receives Crays premium. Required — the `crays@npub.cash` fallback cannot issue invoices. |
| `VITE_CRAYS_MOONPAY_URL`       | Optional MoonPay merchant URL. Defaults to MoonPay's public buy page with the USD amount prefilled.                        |
| `VITE_CRAYS_USDC_ADDRESS`      | USDC deposit address. Unset hides the USDC row.                                                                            |
| `VITE_CRAYS_USDC_NETWORK`      | Network label shown with the USDC address. Defaults to `Solana`.                                                           |
| `VITE_CRAYS_USDT_ADDRESS`      | USDT deposit address. Unset hides the USDT row.                                                                            |
| `VITE_CRAYS_USDT_NETWORK`      | Network label shown with the USDT address. Defaults to `Tron`.                                                             |

Set these at build time. For GitHub Pages, add repository variables
`CRAYS_LIGHTNING_ADDRESS`, `CRAYS_MOONPAY_URL`, `CRAYS_USDC_ADDRESS`,
`CRAYS_USDC_NETWORK`, `CRAYS_USDT_ADDRESS` and `CRAYS_USDT_NETWORK` under
**Settings → Secrets and variables → Actions → Variables**;
`.github/workflows/deploy.yml` maps them to the `VITE_*` names
above. Leaving them unset keeps the placeholder checkout. To create the
receiving address, claim a username for the Crays npub at
[npub.cash](https://npub.cash) (or use any LNURL-pay address) and set
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
