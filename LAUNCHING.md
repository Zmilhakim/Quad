# Launching a token on Quadpad

Nothing here is a setting.

The opening price, the supply, the fee, the split and the venue are not
configured per launch — they are the same for every token because there is no
argument anywhere that could make them different. `launch()` takes five things:

    name, symbol, imageURI, blurb, link

and that is the entire list. It has no price field, no supply field, no fee
field and no allocation field. A test asserts the ABI stays that way, so adding
one has to break a build rather than a promise.

So there is no configuration to save between launches. What follows is the
procedure, not the settings.

## What every launch gets, whether you want it or not

| | | where it comes from |
| --- | --- | --- |
| Opening market cap | 1.700080239474970520 ETH | `OPENING_TICK` in QuadpadFactory |
| Supply | 1,000,000,000, all into the pool | `FIXED_SUPPLY` |
| Fee | 4% of everything paid in, both directions | `FEE_BPS` in QuadHook |
| Creator's share | 80% of the fee | `CREATOR_BPS` |
| Treasury's share | 20% | the rest |
| Venue | Uniswap v4, native ETH pair, LP fee 0 | `LP_FEE`, the pool key |
| Liquidity | locked in QuadLocker, permanently | no withdraw exists |
| Range | tick 155904 … 201936, spacing 336 | `TICK_LOWER`, `TICK_SPACING` |

All of them are `constant` or `immutable`. The hook's address carries its own
permission bits, mined at deployment, so a pool cannot be opened with this
factory and quietly skip the fee — and `beforeInitialize` refuses any caller but
the factory, so nobody can point the fee at a pool Quadpad did not launch.

The deployed addresses are in `contracts/quadpad.config.json`.

## The easy way: the website

Open **quadpad.fun/launch**, connect the wallet you want to be the creator, fill
in the five fields, send.

That is the whole procedure. No key to paste, no terminal, no checkout to keep
up to date. The fee accrues to whichever address sent the transaction, and it is
collected at **quadpad.fun/dashboard** — one button, every currency at once.

Use this unless you have a reason not to.

## The terminal way

For launching from a machine rather than a wallet app, or for reading the plan
before sending it.

```
cd ~/Quad/contracts
git pull
npm install && npm run compile          # only after a pull that changed anything
```

The key, entered so it never reaches the shell history:

```
read -rsp "key: " DEPLOYER_KEY; echo; export DEPLOYER_KEY; echo ${#DEPLOYER_KEY}
```

It must print **66**. A private key is `0x` plus 64 hex characters, no spaces. If
it prints anything else the paste was truncated or picked up something else —
`npm run launch` will refuse it rather than send anything, but it is quicker to
notice here.

```
npm run whoami
```

`address` is who will own the fee. `config matches` means this key is the one
the config expects.

Then the launch, which sends nothing on the first run:

```
NAME='Token Name' SYMBOL='TICKER' IMAGE='https://…' BLURB='One sentence.' LINK='https://…' npm run launch
```

It prints the supply, the opening price, the range, the fee, the address the
token will land on, and what the gas will cost against what the account holds.
Read it, then run the line it prints back — that line carries every field you
passed, including the picture, the blurb and the link, which are written into
the notice once and by nothing afterwards.

Afterwards:

```
npm run status                          # the board, read from the pool manager
npm run collect                         # what the fee owes you; CONFIRM=collect sends it
```

## Trading it

A launched token is not buyable by a wallet on its own — a v4 pool has no `swap`
a wallet can call. Trades go through `QuadRouter`, from the card on
**quadpad.fun/board**, or:

```
ID=0 BUY=0.001 npm run swap             # prints the plan, sends nothing
ID=0 SELL=all npm run swap
```

## What to check after a launch

1. The token appears on **quadpad.fun/board** with its picture and blurb.
2. `npm run status` shows it priced, with the supply in the pool.
3. A small buy goes through, and `unclaimed` on the board stops being zero.

If the picture is missing, the URL was wrong — and it cannot be changed. That is
the one field worth checking twice before sending.
