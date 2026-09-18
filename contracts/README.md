# Quadpad — contracts

Four contracts on **Uniswap v4**, compiled with solc-js and tested on a local EVM
against Uniswap's own `PoolManager`, deployed as it ships. No Hardhat, no
Foundry, no network access needed to run the tests.

| Contract | Job |
| --- | --- |
| `QuadpadFactory` | The board. Launches a token, opens its pool, locks the supply in — one transaction. |
| `QuadHook` | 4% of every swap, 80% to the creator, 20% to the treasury. |
| `QuadLocker` | Holds every launch's liquidity, and has no function that gives any back. |
| `QuadToken` | Fixed-supply ERC20. No mint, no owner, no pause. |

Compile first, always. `out/` is built rather than committed, so a fresh checkout
has nothing for the scripts to read.

```bash
npm install
npm run compile   # writes out/, PoolManager included, and the site's ABIs
npm test          # compiles, then launches a token and trades against it
npm run wallets   # makes the two keys — on your machine, not a server
npm run whoami    # which address does the key I stored control?
npm run mine      # the salt the hook needs, printed before anything is spent
npm run deploy    # puts the factory, the hook and the locker on chain
npm run launch    # posts one token to the board — prints the plan first
npm run status    # what the pool manager says about the board, right now
npm run collect   # take the fee you are owed
```

## What a launch does

`launch` is a single transaction, and it costs nothing but gas:

1. Deploys the token and mints the entire fixed supply — 1,000,000,000 — straight
   to the locker.
2. Opens a v4 pool of **native ETH against the token**, with `QuadHook` in the
   key and an **LP fee of zero**, priced at `OPENING_TICK` — the same tick as
   every other launch.
3. Puts the whole supply in as one position the locker cannot take back.

The creator ends the transaction holding no tokens. The supply never passed
through their hands or the factory's, so *nothing was held back* is not a promise
anybody has to keep — there is no moment at which anyone holds anything to keep.

## The fee

**4% of everything paid into the pool, in either direction.** Buy with ETH and
the fee is 4% of the ETH. Sell the token back and it is 4% of the token. Of
that, 80% goes to whoever launched the token and 20% to the treasury.

There is no second fee. The pool's own LP fee is zero, which is not a setting —
`LP_FEE` is a constant in the factory. That matters for a reason beyond
simplicity: an LP fee would accrue to a position held by a contract with no way
to withdraw, so it would be money paid by traders that nobody can ever collect.

### Why the fee is charged on the way in

It costs a trader the same either way, but it decides what a creator earns.
Charging the input means a buy pays its fee in ETH; charging the output would
pay it in the token being bought, which is the one asset a creator already has
plenty of.

### Exact input and exact output are two different calls

v4 hands a hook a *specified* and an *unspecified* currency, and which one is the
input depends on the direction of the swap:

* **Exact input** (`amountSpecified < 0`) — the specified currency is the input.
  `beforeSwap` returns a positive specified delta, which the pool manager
  subtracts from the amount reaching the curve. The trader pays exactly what they
  asked to pay and 96% of it is swapped.
* **Exact output** (`amountSpecified > 0`) — the specified currency is the
  output, and the input is not known until the curve has run. So the fee is
  charged in `afterSwap`, whose return lands on the unspecified currency — the
  input — at 4/96 of what the swap cost, rounded up. Still 4% of the total.

There is a test for each, and one for a swap so small the fee rounds to zero.

### The fee is banked as a claim, not taken as cash

`take` would move real assets out of the pool manager at a point in the swap
where the trader has not paid yet. On a young pool with no ETH in it, that is a
buy that reverts — the pool manager would be fronting ETH it does not hold.

So the hook `mint`s ERC-6909 claims against the pool manager instead. No asset
moves during the swap, the trader settles as normal, and the claim is redeemed
for the real thing in `withdraw`, in a transaction of its own. One of the tests
asserts the obvious invariant: what the hook's ledger says it owes equals the
claims it holds, after every kind of trade.

### Withdrawing

`withdraw(currency)` and `withdrawMany(currencies)` pay **the caller** — there is
no recipient argument, so no shape of call pays one account out of another's
balance. The ledger is keyed by address rather than by pool, so a creator with
three launches takes their ETH in one transaction.

## The hook's address is not a detail

A v4 pool works out which callbacks to make by reading the **low 14 bits of the
hook's own address**. The permissions *are* the address. So the hook cannot be
deployed wherever it lands: the address has to be mined for.

The factory deploys the hook with CREATE2 in its own constructor, from a salt
passed in. That salt has to be mined against an address the factory does not have
yet — its own — which is an ordinary CREATE address and so can be worked out from
the deployer and its next nonce. `lib/hooks.mjs` does that, `npm run mine` prints
it, and `npm run deploy` does it again for real.

**The way this goes wrong is a failed transaction, not a silent one.** The hook's
constructor checks its own address against the flags it implements and reverts if
they do not match, which takes the whole deployment down with it. A launchpad
whose fee is quietly never charged is the failure mode worth spending a
constructor check on.

```
BEFORE_INITIALIZE | BEFORE_SWAP | AFTER_SWAP
                  | BEFORE_SWAP_RETURNS_DELTA | AFTER_SWAP_RETURNS_DELTA   = 0x20cc
```

`BEFORE_INITIALIZE` is there for a second reason: it is how only the factory can
open a pool with this hook in it. Nobody can point the fee at a pool Quadpad did
not launch, and no pool can exist with a fee and nowhere to send it.

## Two promises, and they are not the same one

**The liquidity never comes out.** Everything anyone pays to buy a token becomes
liquidity, and liquidity leaves a v4 pool through exactly one door: a
`modifyLiquidity` with a negative delta. There is no such call in `QuadLocker`.
Search the file — every liquidity delta in it is zero or positive. And because a
v4 position is a row in the pool manager keyed by the address that added it
rather than an NFT, there is nothing to transfer, sell, borrow against or approve
away either.

**The fee does come out**, to two addresses fixed before the token existed: the
creator recorded at launch, and the `immutable` treasury in the hook.

This is the part worth being clear-eyed about. Locked liquidity means the money
people pay for supply is locked — for the creator as much as for anyone.

## What is fixed, and why

| Fixed | Why |
| --- | --- |
| Supply, at 1,000,000,000 | So no launch can quietly print more than another |
| LP fee, at zero | So the fee is the only fee, and no fee accrues where nobody can collect it |
| The hook | It is part of the pool's key, so the rate on the last day is the rate on the first |
| The pairing, native ETH | `address(0)` is always `currency0`, so the token is always `currency1` and its supply always sits below spot. No WETH, no address-ordering puzzle |
| The treasury | An `immutable` in the hook, with no setter under any spelling |
| The opening price and the range | So every launch starts where every other one did, and nobody has to ask |

A creator chooses the name, the ticker, the picture and the words. That is the
whole list — shorter than Tollpad's by the one entry that mattered. There is no
allocation, no vesting and no cliff, because there is nowhere to put one.

## The two keys

`npm run wallets` prints them once and saves them nowhere. It refuses to run if
stdout is not a terminal, and refuses again if the environment looks like CI or a
hosted workspace — a key is only secret while it has existed in exactly one
place, and a cloud shell is not that place. A phone running Termux is a fine
place; a web IDE is not.

**Deployer.** Sends one transaction and then matters almost not at all: the
launchpad has no owner, `launch` is permissionless, and the salt for the hook is
mined against whoever is deploying, so a different deployer is not a problem —
only a *changed* one between mining and sending is, and `deploy.mjs` mines it
itself to make that impossible.

**Treasury.** Receives 20% of every fee, forever, and is an `immutable` in the
hook. There is no setter under any spelling. It is **not** the address Tollpad
pays — `configAddress` refuses that one by name, because the two configs are one
directory apart and identical in shape, which is exactly how a copy-paste
nobody re-reads becomes permanent. `deploy.mjs` reads it back off the
chain after deploying and refuses to go on if it is not the address that was
asked for. It has to be an address that can call `withdraw` — a contract that
cannot make that call can never be paid — and it should be a hardware wallet
rather than a generated key, because it never signs anything else.

```bash
DEPLOYER_KEY=0x… npm run whoami     # prints the address, never the key
```

## The launch, written down

Everything public lives in `quadpad.config.json`, and every script reads it from
there:

```json
{
  "chainId": 4663,
  "poolManager": "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  "treasury": "",          // where the treasury's 20% goes, forever
  "deployer": "",          // the address that deploys — its address, not its key
  "deployed": { }          // deploy.mjs fills this in
}
```

There is no `launch` section, and that is the point: the opening price, the
range and the tick spacing are constants in `QuadpadFactory.sol`, not settings.
A launchpad whose one promise is "every launch opens at the same price" cannot
keep that promise in a config file.

### Quadpad's two addresses are Quadpad's own

Both are empty, and they stay empty until somebody generates them on their own
machine. They are **not** Tollpad's.

That is enforced rather than asked for. An earlier commit carried Tollpad's two
addresses over wholesale with a note saying to change them before deploying —
and a note is not a check. `configAddress` now refuses either of them outright,
in any spelling, and `test/config.test.mjs` asserts it:

```
treasury is Tollpad's treasury: 0xb1A81E4A729c87560eF12d7652D883e803C5422E

Quadpad deploys with its own two addresses. Generate them on the computer
you sit in front of — `node new-wallets.mjs`, which refuses to run on a
hosted machine — and put them in quadpad.config.json.
```

The treasury matters most: it is an `immutable` in the hook from `npm run
deploy` onwards, so the moment before deploying is the last moment it can be
changed at all. Paid to the wrong address, every fee the treasury side ever
earns goes there and no function anywhere moves it.

Addresses are public and belong in a file that gets reviewed in a diff rather
than retyped at a prompt — `treasury` in particular, since it is immutable from
`npm run deploy` onwards. **Keys never go in it.** They reach the scripts through
`DEPLOYER_KEY` in your shell, and `loadConfig` refuses to run at all if anything
in the file is 66 characters of hex.

### The venue

Uniswap v4 is live on Robinhood Chain. The address comes from Uniswap's own
deployment record,
[`deployments/4663.md`](https://github.com/Uniswap/contracts/blob/main/deployments/4663.md):

| Contract | Address |
| --- | --- |
| PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |

That is the only venue address a launch needs. v4 holds every pool in one
manager, and the other side is native ETH, so there is no factory, no position
manager and no WETH to record — the three things the v3 launchpad in this
repository has to name and cross-check.

## Every launch opens at the same price

This is the one thing Quadpad has that Hoodpad and Tollpad do not, and it is a
property of the factory rather than a convention anybody follows.

On the other two, the price range is a launch parameter. Two tokens posted on
the same afternoon can open an order of magnitude apart, and a buyer has to work
out which is which before they can read either chart. Here there is nothing to
work out: three constants in `QuadpadFactory` decide it, and `launch` takes no
price argument at all.

| Constant | Value | What it is |
| --- | --- | --- |
| `OPENING_TICK` | `201936` | Where every pool opens, and the top of its range |
| `TICK_LOWER` | `155904` | Where the last of the supply is sold |
| `TICK_SPACING` | `336` | The grid both ends sit on |

At tick 201936 one ETH buys about 588.2 million of the billion supply, which
values the whole of it at **1.700080239 ETH**. Ticks are discrete — each is
1.0001 of the last — so that is as near 1.7 as this curve comes: 0.005% over,
which is four figures past anything a chart shows.

`openingMarketCap()` derives that number from `OPENING_TICK` rather than storing
it beside it, so there is no second copy to fall out of step, and the test suite
checks it against the same arithmetic done off-chain, to the wei.

### Why the spacing is 336

Both ends of the range have to be multiples of the spacing, and the opening tick
has to land on it **exactly**. The position's top edge is the price the launch
advertises; a spacing that did not divide it would leave a gap between that
price and the first liquidity, and the first buy would cross the gap for free
and fill at the far side of it — which is to say at a price nobody was told
about.

201936 = 336 × 601 and 155904 = 336 × 464, so 336 divides both. It is also the
largest such divisor worth having: a swap walking the range end to end touches
two words of the pool's tick bitmap at this spacing, and a hundred and eighty of
them at a spacing of one.

### Why a hundredfold

A hundredfold above the opening price is 46,054 ticks down, and the range has to
end on a spacing — so it ends at the first one inside that, 137 spacings or
46,032 ticks, a factor of 99.78. Rounding the other way would put the last of
the supply past the hundredfold it is meant to be.

The whole supply spreads across that range, so it takes roughly
sqrt(1.7 × 169.6) ≈ **17 ETH** of buying to clear the shelf. Too narrow and the
supply runs out on the first afternoon; too wide and the price barely answers
the buying, which on a young chain reads as a dead chart.

### Why the range sits below spot

In v4 the other side of the pool is native ETH, which is `address(0)` and so is
always `currency0`. A launched token is therefore always `currency1` — there is
no ordering to discover — and a pool prices `currency1` in `currency0`, which
here means *tokens per ETH*. That runs the opposite way to the price anyone
quotes: a dearer token is a **lower** tick. So the opening price is the *top* of
the range and the far end is the bottom, and the whole supply sits below spot
where it needs no ETH to put in.

```bash
NAME="Some Token" SYMBOL=SOME npm run launch                 # prints the plan, sends nothing
NAME="Some Token" SYMBOL=SOME CONFIRM=launch npm run launch  # sends it
```

**Do not chain these with `&&`.** A dry run is a success, so the first exits 0
without sending anything and the next command in the chain runs against a launch
that never happened.

## Testing against the real thing

`test/contracts.test.mjs` deploys Uniswap's `PoolManager` — the shipped contract,
not a model of it — launches a token into it, buys with ETH, sells back, buys an
exact amount, and then tries to get something out that should not come out. So
the flash accounting, the tick crossing and the ERC-6909 claims are Uniswap's own.
`test/hooks.test.mjs` covers the address arithmetic on its own, because a hook
mined wrong does not fail loudly.

Two of the tests are about the price and nothing else. One works the range out
from "the whole supply is worth 1.7 ETH", by the same tick math the pool uses,
and asserts the contract's constants are those — reading a constant out of the
contract and comparing it to itself would pass whatever it said. The other
launches twice, from two different addresses, and reads back what the pool
manager recorded for each: same `sqrtPriceX96`, same tick, same range. There is
also one that asserts `launch`'s ABI has no price field in it, so putting one
back has to break a test rather than a promise.

The EVM has to be Cancun or later: v4 keeps its lock and its deltas in transient
storage.

## Not deployed, and not audited

`quadpad.config.json` has no addresses under `deployed` because nothing has been
deployed. None of this is audited. What the scripts do instead is check what can
be checked before spending gas: that the RPC really is the chain the config
names, that the pool manager answers like one, that the key signing is the
address the config expects, and — after deploying — that the hook landed on a
flagged address and holds the treasury that was asked for. `launch.mjs` simulates
the whole transaction against the node before it will broadcast.
