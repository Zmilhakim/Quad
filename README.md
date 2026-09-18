# Quadpad

A launchpad on Uniswap v4 whose pools charge **4% of every swap**, ticker
**`$QUAD`**, for Robinhood Chain (chain id 4663).

**Only the brand exists so far.** The logo, the banner, the social art and the
profile copy are in [`brand/`](brand/); the contracts and the web app are not
written yet. That order is deliberate — see below.

```
brand/    logo, avatar, banner, OG image and launch card, all generated
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
| Opening market cap | **1.7 ETH** |

The addition is the last row. On Hoodpad and Tollpad, whoever posts a notice
chooses the tick the pool opens at, so two launches on the same day can be priced
an order of magnitude apart and a buyer has to work out which. Quadpad opens every
pool at the same price: one billion tokens, priced so the lot comes to 1.7 ETH.
There is one number to learn, and it is the same on the first launch as on the
thousandth.

**1.7 ETH is a price, not a deposit.** The pool opens single-sided — all token,
no ETH — so nothing is backing that number and there is nothing in the pool to
withdraw until somebody buys. Every piece of copy in `brand/` says *opens at*
rather than *backed by*, and that is not a stylistic choice.

## Why the brand came first

Because it is cheap to change and the contracts are not. A launchpad's rate, its
split and its supply are the whole of what it says about itself, and writing them
as copy first is a fast way to find out whether they say anything.

It does leave the art making claims no deployed code backs yet, which
[`brand/numbers.mjs`](brand/numbers.mjs) is honest about: it holds the four
numbers as a specification, reports `checked: false` on every render, and already
contains the code that will read them out of `../contracts/src/` and fail the
render if they disagree. Nothing about the art changes on the day the contracts
land; the checking just starts.

Until then, do not post the profile bio as a description of something deployed.
[`brand/X-PROFILE.md`](brand/X-PROFILE.md#what-is-not-checkable-yet-and-what-to-do-about-it)
says the same thing at more length.

## What is not here yet

- `contracts/` — `QuadHook.sol`, `QuadpadFactory.sol`, `QuadLocker.sol`. The
  names are already the ones `brand/numbers.mjs` will look for.
- `site/` — the app, when there is something for it to read.

> Not audited, not deployed, and not launched. Nothing in this directory should
> be read as a description of running code.
