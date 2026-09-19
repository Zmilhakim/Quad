# Launch day

Everything on chain is done and checkable. What is left is the part that
decides whether any of it gets read.

Account: **@Quadpadxyz** · Site: **quadpad.fun** · Followers at the time of
writing: **0**

That last number is the whole problem. The launch transaction takes thirty
seconds and costs 0.00008 ETH; whether anybody sees it is decided before it is
sent. An account that posts a contract address as its first ever post reads
exactly like the accounts that do nothing else, and no amount of verified
source changes that first impression.

So the token goes last, not first.

## What is already true, and checkable

Every claim below can be opened and read. That is unusual enough to be the
whole pitch, and it is worth spending the first posts on it rather than on the
token.

| | |
| --- | --- |
| Every launch opens at 1.7 ETH | `launch()` has no price argument |
| 4% of every swap | `FEE_BPS = 400`, constant, no setter |
| 80% to the launcher | `CREATOR_BPS = 8000`, same |
| Whole supply in the pool | no allocation argument exists |
| Liquidity locked | the locker has no function that returns it |
| All four contracts | verified on Blockscout, exact match |

## The order

Space these out. Five posts in five minutes is one post.

### 1 — what it is

Image: `out/banner-1500x500.png` or `out/og-1200x630.png`

```
Quadpad is live on Robinhood Chain.

Every token opens at the same price: 1.7 ETH for a billion tokens, all of it in the pool.

launch() has no price argument. There is nothing to choose.

quadpad.fun
```

### 2 — why one price

No image. This is the argument, and it is the only thing here nobody else is
saying.

```
Most launchpads let the creator pick the opening price. Two tokens posted the same afternoon can open an order of magnitude apart, and a buyer has to work out which is which before they can read either chart.

Quadpad removed the argument. Every chart starts in the same place.
```

### 3 — the contracts (pin this one)

Image: `out/live-1600x900.png`

```
All four contracts are verified on Blockscout — exact match, so the source shown there is provably the source that was deployed.

Don't take the card's word for it. Open the locker and search it for a withdraw, a collect, or a negative liquidity delta. There is none.

Not audited.
```

### 4 — the lock

No image.

```
The whole supply goes into the pool at launch. None to the creator, none to us — there is no allocation field in the contract to put one in.

The LP position goes to a contract with no function that gives it back. That is what locked means here. Not a timer that expires.
```

### 5 — the token

Image: `out/launch-1600x900.png`

Sent on 19 September 2026. `$QUAD` is
`0x2564a46B9b5B3f9b55fd6f3F862b37d54BEac047`, notice #1 on the board, and the
address matched what the dry run predicted.

```
$QUAD is live.

0x2564a46B9b5B3f9b55fd6f3F862b37d54BEac047

It opened at 1.7 ETH, like everything else on the board, because the contract cannot open it anywhere else. 4% of every swap, 80% of that to whoever launched it.

quadpad.fun/board
```

### 6 — the thing that is now demonstrable

This one could not be posted before tonight, because it needed two tokens.

`$QZERO` and `$QUAD` were launched hours apart, by different transactions, and
the pool manager recorded the same opening price for both — to the last digit:

```
0.000000001700080239 ETH per token
```

```
Two tokens, launched hours apart, in two different transactions.

The pool manager recorded the same opening price for both, to the last digit:

0.000000001700080239 ETH per token

Not a convention, not a default anyone followed. There is no argument in launch() that could have made them differ.

quadpad.fun/board
```

## What not to post

- **No number nobody can check.** No market cap projection, no "$X locked", no
  holder count, no APR. Everything in the posts above is true on the first day
  and stays true.
- **No promise about price.** The opening price is a fact about the contract.
  Anything about where it goes afterwards is not.
- **No "audited".** It is not.
- **No urgency.** No countdown, no "last chance", no limited anything. The
  supply is fixed and the price opens where it opens; there is nothing to be
  early for that the contract does not give everyone equally.

## After the launch

`npm run status` reads the board off the pool manager, and
`quadpad.fun/dashboard` shows what the fee has earned and collects it. Neither
needs a key for reading.

The first real buy from somebody who is not you is the number worth watching.
Until then the board is two tokens you launched yourself, and it is honest to
treat it that way.
