# Quadpad

A launchpad on Uniswap v4 whose pools charge **4% of every swap** and open
**every launch at the same price**, ticker **`$QUAD`**, for Robinhood Chain
(chain id 4663).

```
contracts/  the four contracts, their tests and the scripts that deploy them
site/       the web app: landing, board, launch form, dashboard
brand/      logo, avatar, banner, OG image and launch card, all generated
```

## The shape

Quadpad is Tollpad's shape with different numbers and one addition. The supply
and the lock work the way they do everywhere else in this repository: the whole
supply is minted at launch, all of it opens a single-sided pool, and the position
goes into a contract with no way to take it back. Trading fees stay claimable by
whoever launched the token; the liquidity does not.

| | |
| --- | --- |
| Fee on every swap | **4%**, in either direction, charged by the hook |
| To whoever launched the token | **80%** of that |
| To the treasury | the remaining 20% |
| The pool's own LP fee | **zero** — the hook's rate is the entire schedule |
| Supply | **1,000,000,000**, minted once, none held back |
| Opening market cap | **1.7 ETH**, every launch |

## The addition is the last row

On Hoodpad and Tollpad, whoever posts a notice chooses the tick the pool opens
at. Two launches on the same afternoon can be priced an order of magnitude apart,
and a buyer has to work out which is which before they can read either chart.

Quadpad opens every pool at the same tick: 201,936, where one billion tokens come
to 1.7 ETH. There is one number to learn and it is the same on the first launch
as on the thousandth.

It is a guarantee rather than a convention because **`launch` takes no price
argument**. Not a default, not a validated range — the field does not exist.
`OPENING_TICK`, `TICK_LOWER` and `TICK_SPACING` are constants in
[`QuadpadFactory`](contracts/src/QuadpadFactory.sol), and there is no calldata
anybody can craft, from any address, that opens a Quadpad pool anywhere else on
the curve. A test asserts that of the ABI itself, so putting a price field back
breaks a test rather than a promise.

**1.7 ETH is a price, not a deposit.** The pool opens single-sided — all token,
no ETH — so nothing is backing that number and there is nothing in the pool to
withdraw until somebody buys. Every piece of copy in `brand/` and `site/` says
*opens at* rather than *backed by*, and that is not a stylistic choice.

It is also 1.700080239474970520 ETH exactly. Ticks are discrete — each is 1.0001
of the last — so 201,936 is as near 1.7 as this curve comes, 0.005% over.
`openingMarketCap()` derives that from the tick rather than storing it, the test
suite checks it against the same arithmetic done off-chain to the wei, and
`brand/numbers.mjs` refuses to render art saying "1.7" if the tick ever moves far
enough to make that untrue.

## Where to start

- [`contracts/README.md`](contracts/README.md) — the mechanism, the four
  contracts, and how to deploy and launch.
- [`site/README.md`](site/README.md) — running the app.
- [`brand/README.md`](brand/README.md) — the logo, the social art and the
  profile copy.

## The brand came first

Unusually for this repository, `brand/` was written before `contracts/`, because
it is cheap to change and the contracts are not. A launchpad's rate, its split
and its supply are the whole of what it says about itself, and writing them as
copy first is a fast way to find out whether they say anything.

That left the art making claims no code backed, which
[`brand/numbers.mjs`](brand/numbers.mjs) was honest about: it held the four
numbers as a specification, reported `checked: false` on every render, and
carried the code that would read them out of the contracts once there were any.
The contracts have since landed and **none of the art changed** — the checking
simply started, which is the order it was meant to happen in.

## Before it can be deployed

`contracts/quadpad.config.json` has no `treasury` and no `deployer`, and it will
not get them from here. Both are Quadpad's own — not Tollpad's — and both have
to be generated on the machine their owner sits in front of:

```bash
cd contracts && node new-wallets.mjs
```

That script refuses to run on a hosted or shared machine, and so does this
session: a private key is only secret while it has existed in exactly one place,
and a container someone else can read is not that place.

An earlier commit carried Tollpad's two addresses over with a note asking
whoever deployed to change them. `configAddress` now refuses both by name, in
any spelling, and `contracts/test/config.test.mjs` asserts it — because the
treasury becomes an `immutable` in the hook the moment `npm run deploy` runs,
and there is no function anywhere that moves it afterwards.

> Not audited and not deployed. `contracts/quadpad.config.json` has nothing under
> `deployed`, the site has no `NEXT_PUBLIC_FACTORY_ADDRESS`, and both say so
> rather than rendering a board of zeros that looks like a board nobody has used.
