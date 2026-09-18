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

## The numbers are a spec until there are contracts

Tollpad's `render.mjs` reads `TOLL_BPS`, `CREATOR_BPS`, `LP_FEE` and
`FIXED_SUPPLY` out of `../contracts/src/` and throws if they are not what the
copy says — a card printing *5%* is a claim about deployed code, and it is worth
exactly as much as the check behind it.

Quadpad was drawn before its contracts, so there is nothing to read yet. The four
numbers live in [`numbers.mjs`](numbers.mjs) instead:

| | |
| --- | --- |
| Fee on every swap | 400 bps — 4% |
| To whoever launched the token | 8000 bps of that — 80% |
| The pool's own LP fee | 0, so the hook's rate is the entire schedule |
| Supply | 1,000,000,000, minted once |
| Opening market cap | 1.7 ETH |

`assertAgainstContracts()` in that file already knows how to read `FEE_BPS`,
`CREATOR_BPS`, `FIXED_SUPPLY` and `LP_FEE` out of `QuadHook.sol` and
`QuadpadFactory.sol`, and to grep `QuadLocker.sol` for a `withdraw`, a `collect`,
a `rescue` or a negative liquidity delta. It reports `checked: false` until those
files exist, and the render prints that line rather than hiding it — an unchecked
number should look unchecked to whoever runs this. The day the contracts land,
the checking starts on its own and nothing about the art has to change.

## "Opens at 1.7 ETH" is a price, not a deposit

1.7 ETH is what the whole supply comes to at the tick the pool opens on. There is
no ETH in the pool: it opens single-sided, so the ETH only arrives if somebody
buys.

Every line in this kit says *opens at*, *priced at* or *comes to*. None of them
says *backed by*, *worth* or *raised*. See
[`X-PROFILE.md`](X-PROFILE.md#opens-at-17-eth-means-priced-not-funded).

## No domain on the art

Nothing here prints a domain or a handle, on purpose. See
[`X-PROFILE.md`](X-PROFILE.md#what-the-art-deliberately-does-not-say) for why
that is a rule in this repository rather than a preference.
