# Quadpad — X profile kit

Everything needed to set the account up, in the fields X asks for. Character
counts were measured, not estimated; X counts Unicode code points, and the em
dash counts as one.

The account is in English and stays in English. Tollpad ships both languages
because it was written for both; mixing them on one profile reads like a bio
somebody else wrote.

## Display name — max 50

**Pick this** (15 characters):

```
Quadpad | $QUAD
```

Alternatives: `Quadpad` (7) · `Quadpad | opens at 1.7 ETH` (26) · `Quadpad — 4% a swap, 80% yours` (30)

## Handle

Nothing here is registered yet, and this file will say so until it is. Check
these in order and write down which one you took, with the date — a handle
somebody else holds can be pointed at anything, and the only defence is that the
real one is written somewhere people can check:

1. `@quadpad`
2. `@getquadpad`
3. `@quadpad_xyz`

`@hoodpad` was taken when Hoodpad went looking, which is the ordinary outcome
rather than the unlucky one. Assume the short one is gone and be glad if it is
not.

## Bio — max 160

**Pick this** (132 characters):

```
Every token opens at 1.7 ETH. 4% of every swap, 80% of it to whoever launched it. Supply all in the pool, liquidity locked for good.
```

It leads with the number no other launchpad has — the opening price is the same
for every token — and still fits the two numbers and the lock into two lines on
a phone, which is all X shows before someone has to tap.

### The rest of them

| Count | Text |
| --- | --- |
| 151 | `Every launch opens at 1.7 ETH: one billion tokens, all of them in the pool, liquidity locked. Every swap after that pays 4%, 80% of it to the launcher.` |
| 149 | `Launch for the price of gas. Keep 80% of a 4% fee on every swap after that. The whole supply opens at 1.7 ETH and the liquidity never comes back out.` |
| 148 | `Launch a token on Uniswap v4. One billion supply, all in the pool, opening at 1.7 ETH. Every swap pays 4% — 80% of that goes to whoever launched it.` |
| 145 | `No presale, no team bag, no price to guess: every launch opens at 1.7 ETH with a billion tokens in a locked pool. 4% a swap, 80% to the launcher.` |
| 145 | `One rate, one supply, one opening price. 4% of every swap, 80% to the launcher, a billion tokens opening at 1.7 ETH in a pool that never reopens.` |
| 131 | `4% of every swap, 80% of it yours. A billion tokens open at 1.7 ETH with the whole supply in a pool nobody can drain — us included.` |

### How to pick

The short ones read better on a phone. The long ones say the opening price *and*
what happens to the liquidity, which is the question every launchpad gets asked
second.

One thing to leave out of all of them: **a number nobody can check yet**. No
"$2M locked", no "1,000 launches", no APR. Everything above is true of a
launchpad on its first day, which is the day the bio gets written.

## The claims in this bio are checkable

Tollpad's bio makes two claims — 5% and 80% — and both are constants with no
setter in `TollHook.sol`, so anyone can go and read them. Every claim in the bios
above is the same kind of thing:

| The bio says | Read it in |
| --- | --- |
| 4% of every swap | `FEE_BPS` in `../contracts/src/QuadHook.sol` |
| 80% of it to the launcher | `CREATOR_BPS`, same file |
| A billion tokens | `FIXED_SUPPLY` in `QuadpadFactory.sol` |
| Opens at 1.7 ETH | `OPENING_TICK`, same file — and `openingMarketCap()`, which derives the figure from it |
| Liquidity locked for good | `QuadLocker.sol`, which has no function that takes any out |

[`numbers.mjs`](numbers.mjs) reads all of them on every render and refuses to
draw art that disagrees with the contracts. There is nothing in this file that
rests on trusting whoever wrote it.

Two things the bio still cannot claim, and does not:

- **Nothing is deployed.** The contracts exist and are tested against Uniswap's
  own pool manager; they are not on Robinhood Chain and they are not audited. A
  bio describing a launchpad in the present tense is describing something people
  can go and use — so say "not deployed yet" in the pinned post rather than
  leaving anyone to find out.
- **No number nobody can check.** No "$2M locked", no launch count, no APR.
  Everything above is true of a launchpad on its first day, which is the day the
  bio gets written.

For the handle and the website field, the rule below is the same one this
repository already broke once: Hoodpad shipped a banner printing `HOODPAD.FUN`
and `@HOODPAD` when neither was registered.

## "Opens at 1.7 ETH" means priced, not funded

1.7 ETH is what one billion tokens come to at the tick the pool opens on. It is
**not** money in the pool. The pool opens single-sided — all token, no ETH — so
there is nothing to withdraw and nothing backing the price until somebody buys.

Every line in this kit says *opens at*, *priced at* or *comes to*. None of them
says *backed by*, *worth* or *raised*, and none of them should start.

## Website

Leave it empty until there is a domain, and then put the domain there. Do not
put a link to an explorer page in this field: it looks like a website, it is not
one, and it goes stale the first time anything is redeployed.

## Images

| Field | File | Size |
| --- | --- | --- |
| Profile picture | `out/avatar-1000.png` | 1000 × 1000 |
| Header | `out/banner-1500x500.png` | 1500 × 500 |

The avatar is full-bleed signal green. X crops a profile picture to a circle, and
a mark centred on a square loses its corners to that crop; the four is compact
and sits on the middle of the grid, so its furthest corner lands 400px from the
centre of a 1000px square — a hundred pixels of clearance inside the circle.

The banner leaves its **bottom-left corner empty on purpose**. X lays the profile
picture over that corner, and whatever is under it is gone. `render.mjs` measures
this rather than trusting it: every element that has to survive is marked `.keep`
and the render fails, naming the element, if one of them lands in the avatar's
zone. Move a chip back into that corner and you will hear about it before the
file is written.

## What the art deliberately does not say

**No domain and no handle on any image.** X already shows both in its own profile
chrome, and an image repeating them is one more thing that can go stale or turn
out to be wrong. The banner carries the ticker, the venue and the rate instead —
none of which can expire.

This is not a style preference. See above: do not put a domain or a handle on an
image before it is yours.

## Ticker

`$QUAD`.

Not `$HOOD` — that is Robinhood's NASDAQ ticker, and a token called `$HOOD`
launching on Robinhood Chain reads as an official Robinhood asset to anyone
skimming. Not `$PAD` either, which is every launchpad on every chain. `$QUAD` is
the name and the rate in one word, which is the whole of what this launchpad has
to say.
