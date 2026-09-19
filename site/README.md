# Quadpad — the web app

Next.js 15, wagmi and viem. Four routes, no database, no API: every figure on
every page is read from the factory or straight out of the Uniswap v4 pool
manager's storage.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
npm run build
```

| Route | What it is |
| --- | --- |
| `/` | The pitch: what it does, what it costs, what it does not promise |
| `/board` | Every launch, newest first, priced from the chain |
| `/launch` | Launch a token — the whole form is five fields, and none of them is a price |
| `/dashboard` | What this address launched, and the fee it is owed |
| `/learn` | The mechanism, and the parts worth being clear-eyed about |

## It works before anything is deployed

`NEXT_PUBLIC_FACTORY_ADDRESS` is empty, so the site builds and runs and says on
every page that nothing is deployed yet. That is deliberate: a board of zeros
looks exactly like a board nobody has used, and the difference matters. Set the
address — after `npm run deploy` in `../contracts` — and every page turns on.

```bash
cp .env.example .env.local
```

## The ABIs are generated, not copied

`../contracts/compile.mjs` writes `src/lib/abi/*.ts` on every compile. Do not
edit them by hand: the point is that the frontend cannot drift from the contracts
it is calling. Re-run `npm run compile` in `../contracts` after any change to a
contract and the types follow.

## Reading a v4 pool from a browser

There is no pool contract to call in v4 — one manager holds every pool — so
`src/lib/pool.ts` computes a pool's id from its key and pulls slot0 out of the
manager's storage with `extsload`. The slot number and the bit layout are
Uniswap's, from `PoolIdLibrary` and `StateLibrary`. The same code exists in
`../contracts/lib/pool.mjs`, where a test checks it against a real pool manager.

`src/lib/ticks.ts` is v4's `TickMath`, transliterated rather than approximated.
The board uses it to turn a position's liquidity into the two figures worth
showing: the ETH locked in and the supply still unsold.

The launch form does not use it at all, and that is the interesting part. On
Tollpad the form prices a range before sending the transaction, because the
range is an argument. Here `OPENING_TICK`, `TICK_LOWER` and `TICK_SPACING` are
constants in the factory and `launch` takes no price argument, so there is
nothing for the browser to compute — and no version of this form, or any other
caller, that could open a pool somewhere else.

## What the pages do not do

**There is no trading here.** v4 pools are reached through a router, and Robinhood
Chain has Uniswap's own Universal Router, which handles pools with hooks. Adding
a second one to this repository would mean asking people to approve a contract
that has no reason to exist.

**Nothing is vetted.** The board shows what the chain holds, including names,
pictures and links that whoever launched a token put there. A picture is only
ever rendered as an image and a creator's link carries `nofollow`, which is as
far as a launchpad can honestly go.

## Not deployed

There is no Vercel project, no URL and no custom domain for Quadpad yet, and
this file will say so until there is. Tollpad's equivalent section names a live
deployment because there is one; copying that text across would have been the
same mistake as printing a domain on a banner before it is registered, which
Hoodpad did once already.

`SITE_URL` already follows `VERCEL_PROJECT_PRODUCTION_URL`, so the OG tags will
point at whatever host the first deployment lands on without an edit. Set
`NEXT_PUBLIC_SITE_URL` only if it ever needs to differ from that.

Two things to do before it sees real traffic:

- **`NEXT_PUBLIC_FACTORY_ADDRESS`**, once `npm run deploy` in `../contracts` has
  printed one. Until then the site runs and says on every page that nothing is
  deployed, which is the truth today.
- **`NEXT_PUBLIC_RPC_URL`**. The default endpoint is Robinhood's public one and
  is rate-limited for wallets, not for a site.
