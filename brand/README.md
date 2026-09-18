# Quadpad — brand kit

Everything here is generated. Edit the source, re-run, commit the output.

```bash
npm install          # sharp + playwright
npm run render
```

Playwright needs its Chromium: `npx playwright install chromium`, unless the
environment already provides one (this repo's web sessions do, and `render.mjs`
finds it).

| File | Use |
| --- | --- |
| `logo-mark.svg` | The four on its own |
| `logo-wordmark.svg` | QUADPAD, no mark |
| `logo-lockup.svg` | Mark + wordmark, for a light background |
| `logo-lockup-dark.svg` | The same, for a dark one |
| `logo-mark-{256,512,1024}.png` | Raster fallbacks |
| `avatar-1000.png` | Profile picture (crops to a circle safely) |
| `banner-1500x500.png` | X / Twitter header |
| `og-1200x630.png` | Link previews |
| `launch-1600x900.png` | The whole launch, as one card |

## The X account

Display name, handle, bio and what not to print on an image live in
[`X-PROFILE.md`](X-PROFILE.md), with the character counts already measured
against X's limits.

## The ticker

**`$QUAD`**.

Not `$HOOD` — that is Robinhood's NASDAQ ticker, and a token called `$HOOD`
launching on Robinhood Chain reads as an official Robinhood asset to anyone
skimming. Not `$PAD` either, which is every launchpad on every chain.

## The mark is the rate

Every other thing a launchpad could put in a circle — a rocket, a coin, a chart
going up — is already in a thousand profile pictures and says nothing. The rate
is the product here, so the rate is the mark: a numeral four, which is also the
first syllable of the name.

`lib/marks.mjs` draws it, and every letter of QUADPAD, as rectangles. A logo set
in a webfont breaks wherever that font is not loaded — an email signature, a
print sheet, someone else's deck. These render anywhere an SVG renders, with no
font to ship.

An earlier draft notched the crossbar, on the theory that a mark needs a detail
to be a mark. At sixteen pixels the notch read as a rendering fault rather than
a decision, which is the only verdict that matters: a profile picture is seen
small or not at all. What is left is the counter — the triangle the diagonal
leaves open on the left — which is structural, so it survives the size.

## The sheet, not the road

Tollpad is asphalt and hazard stripes, because a toll is a thing you pay at a
barrier. Quadpad is ruled paper, because its claim is that every launch is the
same measured thing: one rate, one supply, one opening price. The grid is the
whole texture, and it is drawn in CSS rather than shipped as an image.

## The banner leaves its bottom-left corner empty

X lays the profile picture over that corner of a header, and whatever is under it
is gone. Rather than remembering that, `render.mjs` measures it: everything that
has to survive is marked `.keep`, and the render fails — naming the element and
by how many pixels — if one of them lands in the avatar's zone.

The first draft of this banner put the `4% PER SWAP` chip and the `$QUAD` ticker
exactly there. The check is what found it.

## The numbers are checked against the contracts

Tollpad's `render.mjs` reads `TOLL_BPS`, `CREATOR_BPS`, `LP_FEE` and
`FIXED_SUPPLY` out of `../contracts/src/` and throws if they are not what the
copy says — a card printing *5%* is a claim about deployed code, and it is worth
exactly as much as the check behind it.

This one does the same, and a little more, because it has one more claim to
make. [`numbers.mjs`](numbers.mjs) holds the figures:

| | |
| --- | --- |
| Fee on every swap | 400 bps — 4% |
| To whoever launched the token | 8000 bps of that — 80% |
| The pool's own LP fee | 0, so the hook's rate is the entire schedule |
| Supply | 1,000,000,000, minted once |
| Opening tick | 201,936 — where the whole supply comes to 1.7 ETH |
| Range and spacing | down to 155,904, both ends on a grid of 336 |

`assertAgainstContracts()` reads every one of those out of `QuadHook.sol` and
`QuadpadFactory.sol` and throws if any disagrees. It also checks that the opening
tick lands on the spacing — if it did not, the position's top edge would not be
the price being advertised, and the first buy would cross the gap and fill
somewhere else — and greps `QuadLocker.sol` for a `withdraw`, a `collect`, a
`rescue` or a negative liquidity delta.

Then there is the rounding. The exact opening market cap is
1.700080239474970520 ETH, and the art says **1.7 ETH**. That is true to four
significant figures, but "close enough" is a judgement, and a judgement nobody
measures is one that quietly stops being true. So it is measured: move the
opening tick far enough that the exact figure leaves a basis point of 1.7 and
the render throws, naming the number it would have printed.

So: change a rate or a tick in the contracts, and the render fails until the
copy is rewritten. That is the intended order.

### It reported `checked: false` for a while

This kit was drawn before the contracts existed. `numbers.mjs` held the figures
as a specification and said so on every render, rather than implying a check it
was not doing. When the contracts landed, none of the art changed — the checking
started.

## "Opens at 1.7 ETH" is a price, not a deposit

1.7 ETH is what the whole supply comes to at the tick the pool opens on. There is
no ETH in the pool: it opens single-sided, so the ETH only arrives if somebody
buys.

Every line in this kit says *opens at*, *priced at* or *comes to*. None of them
says *backed by*, *worth* or *raised*. See
[`X-PROFILE.md`](X-PROFILE.md#opens-at-17-eth-means-priced-not-funded).

## The app's copy of the mark is generated from here

`render.mjs` writes four things into `../site` when that directory exists: the
banner, the OG image and the lockup into `public/brand/`, the favicon into
`src/app/icon.svg`, and the mark's pixel grid into `src/lib/markGrid.ts`.

The last one is the point. The site cannot use an `<img>` for the mark in its
header — an image cannot be tinted, and the mark has to take the colour of
whatever it sits on — so it needs the shape, not a file. Tollpad's app solves
that by keeping a hand-typed duplicate of the grid with a comment asking whoever
edits one to remember the other. This one is written from the same array the
SVGs are drawn from, so there is nothing to remember.

## No domain on the art

Nothing here prints a domain or a handle, on purpose. See
[`X-PROFILE.md`](X-PROFILE.md#what-the-art-deliberately-does-not-say) for why
that is a rule in this repository rather than a preference.
