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

## It worked before anything was deployed, and the wiring stayed

`DEPLOYED_FACTORY` in `src/lib/contracts.ts` now holds the factory, so every
page reads the chain. Before it did, the site built and ran and said on every
page that nothing was deployed — deliberately, because a board of zeros looks
exactly like a board nobody has used, and the difference matters.

That branch is still there and still correct: empty the constant and the banner
comes back. `NEXT_PUBLIC_FACTORY_ADDRESS` overrides the constant, for pointing a
preview somewhere else.

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
Toollpad the form prices a range before sending the transaction, because the
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

## Deployed

Live at **https://quadpad-phi.vercel.app**, from `main`.

| | |
| --- | --- |
| Vercel project | `quadpad`, in `zmilhakim-4557` |
| Repository | [`Zmilhakim/Quad`](https://github.com/Zmilhakim/Quad) |
| Root directory | `site` |
| Production branch | `main` — every push deploys |
| Protection | Vercel Authentication on previews only; production is public |

The host is `quadpad-phi`, not `quadpad`, because `quadpad.vercel.app` was
already taken by somebody else. Vercel picks a suffix rather than failing, and
this file records what it picked — a URL nobody wrote down is a URL that gets
guessed wrong later.

**`NEXT_PUBLIC_FACTORY_ADDRESS`** is unset, and stays that way: the factory is
in `src/lib/contracts.ts` instead, so a deployment cannot forget it. A variable
that goes missing does not fail the build — it quietly serves a page telling
visitors the launchpad does not exist.

Set **`NEXT_PUBLIC_RPC_URL`** before this sees any real traffic. The default
endpoint is Robinhood's public one and is rate-limited for wallets, not for a
site.

There is no custom domain. `SITE_URL` follows `VERCEL_PROJECT_PRODUCTION_URL` by
itself, so the OG tags already point at `quadpad-phi.vercel.app` and will follow
a domain the moment one is attached — set `NEXT_PUBLIC_SITE_URL` only if it ever
needs to differ from the production URL Vercel knows about.
