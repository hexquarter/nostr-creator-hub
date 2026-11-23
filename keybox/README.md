# Crays keybox

A tiny companion service that lets **members-only posts unlock while the
creator is offline** — for single-post purchases made after publication, and
for subscribers who want access to the full post history.

## Why it exists

Members-only posts are encrypted end-to-end (see `src/lib/nostr/exclusive.ts`):
relays store only ciphertext, and the per-post content key is delivered as
NIP-44-encrypted events. The default key server is the creator's own client —
it runs whenever they use Crays. The keybox removes the "creator must be
online" requirement.

## How it works

- **Deposit** — when a creator publishes a members-only post (and once per
  session, for any older posts missing), their client uploads the content key
  here, authenticated with a [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md)
  event (kind 27235), together with the membership price and the post's
  unlock price.
- **Redeem** — a reader who paid sends their settled BOLT-11 invoice; the
  keybox verifies settlement against the **creator's own LUD-21 `verify`
  endpoint**, then checks the amount:
  - ≥ membership price and settled within the last 30 days → key for **any**
    post of that creator (subscription route — full history);
  - ≥ the post's unlock price → key for **that one post**; an invoice binds to
    the first post it redeems, so one cheap payment can't unlock everything.
- The keybox holds **no Nostr keys** and never signs events. Its only power is
  releasing content keys against verified payments, exactly like the creator's
  own client would.

## Deploy

```sh
npm install            # nostr-tools is bundled
cd keybox
npx wrangler kv namespace create KEYBOX   # copy the id into wrangler.toml
npx wrangler deploy
```

Then point the app at it at build time:

| Variable                  | Purpose                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `VITE_CRAYS_KEYBOX_URL`   | Base URL of your deployed keybox (e.g. `https://crays-keybox.your-name.workers.dev`).       |

Without it, the app behaves exactly as before: relay-delivered keys while the
creator is online, plus their signed key requests.

## Trust model

The keybox operator could, in principle, serve keys without payment checks —
the same trust you extend to any Nostr relay or LNURL service. Run your own
instance (or your creators run theirs) if that matters; the code is ~250 lines
of worker and a KV namespace on the free tier.

KV reads are cached aggressively on Cloudflare's edge (60s minimum TTL), so a
just-uploaded key can take up to a minute to become visible to redeemers.
