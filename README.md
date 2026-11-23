# Crays

A premium Nostr client for Bitcoin creators: passkey-first sign-in, real Nostr
profiles and feeds, Lightning zaps, and encrypted members-only posts.

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

## Payments

### Fan checkout: Apple Pay / card by default, Lightning in advanced mode

Fans can buy a creator membership or unlock a single post with Apple Pay, Google
Pay or a credit card — no Bitcoin, wallet or seed phrase required. The checkout
modal defaults to **Card · Apple Pay** and uses the
[Breez Spark SDK](https://sdk-doc-spark.breez.technology/guide/buy_bitcoin.html)
plus MoonPay.

The card flow is:

1. Crays records a local order and asks Breez for a MoonPay checkout URL.
2. On mobile the browser redirects to MoonPay; on desktop the modal shows the
   URL as a QR code, so the fan can pay with Apple Pay on their phone.
3. MoonPay tops up the browser's Breez Spark wallet.
4. As soon as the funds arrive, that wallet pays the creator's BOLT-11 invoice
   over Lightning. The creator still receives sats directly — Crays never holds
   the money.
5. Crays grants the membership or post unlock and announces the purchase over
   Nostr.

The order survives the MoonPay redirect in local storage, so a returning fan is
unlocked automatically. Only one Crays tab drives the wallet at a time; a
redirect tab waits for the original tab instead of opening a second wallet.

**Advanced mode** (Settings → Payments, or the toggle in checkout) switches to
Lightning: BOLT-11 invoices with [LUD-21](https://github.com/lnurl/luds/blob/luds/21.md)
verification, Nostr Wallet Connect one-tap payments, and optional zap tips.

Configure card checkout at build time:

| Variable                       | Purpose                                                                                                                      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BREEZ_API_KEY`           | Breez SDK API key ([request one here](https://breez.technology/request-api-key/)). Required to enable MoonPay card checkout. |
| `VITE_BREEZ_MOONPAY_DELIVERY`  | Optional. `crosschain` (default) buys USDC on Solana for faster arrival; `bitcoin` forces MoonPay's on-chain BTC delivery.   |
| `VITE_CRAYS_LIGHTNING_ADDRESS` | Lightning address (or LNURL) that receives Crays premium. Required — the `crays@npub.cash` fallback cannot issue invoices.   |
| `VITE_CRAYS_DEV_PAYMENTS`      | Optional. Set to `true` in a staging build to show the developer payment tools (disable Lightning, simulate premium).        |

Until `VITE_BREEZ_API_KEY` is set, the card tab shows a setup notice and
Lightning remains available.

#### Wallet and fee handling

The first card checkout creates a BIP-39 seed and stores it in this browser's
local storage, then connects to Breez Spark. MoonPay is asked for the purchase
price plus a 2% buffer (and at least 100 sats) so Lightning routing fees don't
shorten the invoice. The wallet pays the creator with
`feePolicy: "feesExcluded"`, so the full invoice amount reaches the creator.

This browser wallet is intended to be transient: it spends the MoonPay deposit
immediately. For a production deployment with larger balances, replace the
local-storage seed with the Breez passkey flow and add a recovery/export path.

MoonPay's on-chain Bitcoin delivery can take several minutes to confirm. The
cross-chain (USDC on Solana) route is much faster and is used first when the
purchase is at least about $20; smaller purchases use on-chain Bitcoin delivery.
If funds are still in flight when the modal closes, the unfinished order is
recorded and resumes the next time the fan returns.

### Creator premium (Lightning)

Creators pay for Crays premium in sats. Checkout resolves the configured
Lightning address (or LNURL) into a real BOLT-11 invoice, shows it as a QR, and
polls the wallet's LUD-21 `verify` endpoint. The badge turns on only after the
payment settles — there is no "I've paid" button. The same verification unlocks
fan memberships and single-post purchases in advanced mode, so scanning with
any wallet works.

For GitHub Pages, add `BREEZ_API_KEY` (and optionally
`BREEZ_MOONPAY_DELIVERY`) plus `CRAYS_LIGHTNING_ADDRESS` as repository variables
under **Settings → Secrets and variables → Actions → Variables**;
`.github/workflows/deploy.yml` maps them to the `VITE_*` build variables.
Leaving the Lightning address unset keeps the placeholder checkout notice. To
create the receiving address, claim a username for the Crays npub at
[npub.cash](https://npub.cash) (or use any LNURL-pay address) and set
`CRAYS_LIGHTNING_ADDRESS`.

The Lightning `verify` endpoint is optional per LUD-21. If a wallet doesn't
expose one, the creator checkout asks the buyer to connect a wallet and pay in
one tap, which confirms locally; fan purchases keep a clearly-labelled manual
unlock for those addresses.

## Members-only content: encrypted, not just hidden

Members-only posts are **encrypted end to end** — relays only ever store
ciphertext, so other Nostr clients (or anyone querying the relays directly)
cannot read the text.

- **Publishing** (`src/lib/nostr/exclusive.ts`): the composer seals the text
  with a random per-post key (AES-256-GCM) and publishes the ciphertext with an
  `encrypted: crays1` tag. The key is delivered as NIP-44-encrypted kind-30078
  app-data events (`crays:key:<postId>:<recipient>`) to the author and to every
  reader holding an active membership receipt at publish time.
- **Reading**: the post card decrypts for the author, members, and single-post
  unlockers using the locally cached key, a relay delivery, or — when the key
  isn't there yet — a signed key request (`crays:keyreq:<postId>`) that the
  creator's client answers.
- **Key server**: while a creator is signed in, Crays polls for key requests
  and only answers readers whose payment is proven. The strongest proof is the
  settled BOLT-11 invoice the buyer paid, verified against the creator's own
  LUD-21 `verify` endpoint; when that isn't available it falls back to the
  reader's signed kind-30078 purchase receipt (the same self-attested trust
  model as before).

Two honest limits of the client-only design: keys cannot be revoked once
delivered (an expired member keeps access to posts they already unlocked —
future posts simply stop being unlocked), and the creator's client must be
online for a purchase made after publication to decrypt.

### Creator offline: the keybox

The `keybox/` folder is a tiny optional Cloudflare Worker (KV + ~250 lines)
that removes the "creator must be online" limitation. The creator's client
deposits each post key there (NIP-98-authenticated); readers redeem their
settled BOLT-11 invoice for the key, verified against the creator's own LUD-21
`verify` endpoint:

- an invoice ≥ the membership price, settled in the last 30 days, unlocks
  **every** post of that creator — subscription buyers get the full history;
- an invoice ≥ the post's single-unlock price unlocks exactly that post (each
  invoice binds to the first post it redeems, so one cheap payment can't
  unlock everything).

The keybox holds no Nostr keys and never signs events; its only power is
releasing content keys against verified payments. Deploy with `npx wrangler
deploy` inside `keybox/` and point the app at it with
`VITE_CRAYS_KEYBOX_URL`. Without it, everything still works through the
creator's own client. See `keybox/README.md` for details and the trust model.

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
