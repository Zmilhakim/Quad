// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {QuadHook} from "./QuadHook.sol";
import {QuadLocker} from "./QuadLocker.sol";
import {QuadToken} from "./QuadToken.sol";

/// @title QuadpadFactory
/// @notice The board. Every token launched through Quadpad is recorded here, and
/// every figure the site prints is read back out of this contract or the pool
/// manager — nothing is estimated off-chain.
///
/// A launch is one transaction, and it costs nothing but gas:
///
///   1. mint the whole fixed supply, straight to the locker,
///   2. open a Uniswap v4 pool of native ETH against it, with `QuadHook` in the
///      key and an LP fee of zero,
///   3. put the entire supply in as one position the locker cannot take back.
///
/// The creator ends the transaction holding no tokens — the supply never passed
/// through their hands or this contract's — and owning one thing: 80% of the 4%
/// fee that pool charges from its first trade onwards, forever.
///
/// ## Every launch opens at the same price
///
/// This is the one thing Quadpad has that the other launchpads in this
/// repository do not. On Hoodpad and Tollpad the price range is a launch
/// parameter, so two tokens posted on the same afternoon can open an order of
/// magnitude apart and a buyer has to work out which is which before they can
/// read either chart. Here the range is not a parameter. It is
/// `OPENING_TICK`, `TICK_LOWER` and `TICK_SPACING` — three constants — so every
/// pool this contract has ever opened or will ever open starts at the same
/// price: the whole supply valued at **1.7 ETH**.
///
/// `launch` takes no price arguments at all. That is deliberate and it is the
/// difference between a claim and a guarantee: there is no calldata anybody can
/// craft, from any address, that opens a Quadpad pool anywhere else on the
/// curve.
///
/// ## What is fixed, and why
///
/// **The supply**, so no launch can quietly print more than another. **The LP
/// fee, at zero**, so the 4% fee is the only fee anyone has to reason about and
/// nothing accrues to a position that has no way to pay out. **The hook**, which
/// is part of a pool's key and therefore cannot be swapped later — the rate a
/// pool charges on its first day is the rate it charges forever. **The opening
/// price and the range**, for the reason above. And **the pairing**: native ETH,
/// which is `address(0)` and so always `currency0`, which makes the launched
/// token always `currency1` and its supply always the side below spot. There is
/// no WETH and no address-ordering puzzle to solve.
///
/// ## What a creator controls
///
/// The name, the ticker, the picture and the words. That is the whole list —
/// shorter than Tollpad's by the one entry that mattered. There is no
/// allocation, no vesting schedule, no unlock cliff and no treasury carve-out,
/// because there is nowhere to put one: the supply has exactly one destination
/// and it is the pool.
contract QuadpadFactory {
    using StateLibrary for IPoolManager;

    struct Notice {
        uint256 id;
        address token;
        address creator;
        string name;
        string symbol;
        string imageURI;
        string blurb;
        string link;
        uint256 supply;
        uint256 launchedAt;
        int24 tickSpacing;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
    }

    /// @dev Metadata, and nothing else. Tollpad's equivalent carries a tick
    /// spacing, an opening `sqrtPriceX96` and both ends of the range; the whole
    /// point of this launchpad is that those are not things a caller gets to
    /// say.
    struct LaunchParams {
        string name;
        string symbol;
        string imageURI;
        string blurb;
        string link;
    }

    /// @notice Every token launched here has exactly this supply. Not a
    /// parameter.
    uint256 public constant FIXED_SUPPLY = 1_000_000_000e18;

    /// @notice Quadpad pools charge no LP fee. The 4% fee in `QuadHook` is the
    /// entire fee schedule.
    uint24 public constant LP_FEE = 0;

    /// @notice The tick every Quadpad pool opens at, and the top of its range.
    ///
    /// A v4 pool prices `currency1` in `currency0`, and the other side here is
    /// native ETH — `address(0)`, and so always `currency0`. What the pool
    /// quotes is therefore *tokens per ETH*, which runs the opposite way to the
    /// price anyone talks about: a dearer token is a **lower** tick. So this,
    /// the highest tick in the range, is where the token is cheapest, and it is
    /// where every launch starts.
    ///
    /// At tick 201936 one ETH buys 1.0001^201936 ≈ 588.2 million of the
    /// 1,000,000,000 supply, which values the whole of it at
    /// **1.700080 ETH**. Ticks are discrete, so that is as near 1.7 as this
    /// curve comes — 0.005% over, which is four figures further than any price
    /// anyone reads off a chart.
    int24 public constant OPENING_TICK = 201936;

    /// @notice The bottom of the range: where the last of the supply is sold.
    ///
    /// A hundredfold above the opening price is 46,054 ticks down, and the
    /// range has to end on a spacing — so it ends at the first one *inside*
    /// that, 137 spacings or 46,032 ticks, a factor of 99.78. Rounding the
    /// other way would put the last of the supply past the hundredfold this is
    /// meant to be.
    ///
    /// The whole supply is spread across that range, so it takes roughly
    /// sqrt(1.7 × 169.6) ≈ **17 ETH** of buying to clear the shelf. Too narrow
    /// and the supply runs out on the first afternoon; too wide and the price
    /// barely answers the buying, which on a young chain reads as a dead
    /// chart.
    int24 public constant TICK_LOWER = 155904;

    /// @notice The pool's tick spacing.
    ///
    /// Both ends of the range have to be multiples of it, and `OPENING_TICK` in
    /// particular has to land on it **exactly**: the position's top edge is the
    /// price the launch advertises, and a spacing that did not divide it would
    /// leave a gap between the opening price and the first liquidity. A buy
    /// crossing that gap fills at the far side of it — which is to say at a
    /// price nobody was told about.
    ///
    /// 201936 = 336 × 601 and 155904 = 336 × 464, so 336 divides both. It is
    /// also the largest such divisor worth having: a swap walking the range end
    /// to end touches two words of the pool's tick bitmap at this spacing, and
    /// a hundred and eighty of them at a spacing of one.
    int24 public constant TICK_SPACING = 336;

    IPoolManager public immutable poolManager;
    QuadHook public immutable hook;
    QuadLocker public immutable locker;

    /// @notice Where the treasury's share of every fee goes. Recorded here for
    /// readers; the address that actually decides is the `immutable` in the hook.
    address public immutable treasury;

    Notice[] private _notices;
    mapping(address creator => uint256[] noticeIds) private _noticesOf;
    mapping(PoolId poolId => uint256 noticeId) private _noticeOfPool;

    uint256 public lastLaunchAt;

    error EmptyMetadata();
    error NotSingleSided();
    error PoolAlreadyExists();
    error UnknownPool();
    error ZeroAddress();

    event Launched(
        uint256 indexed id, address indexed token, address indexed creator, PoolId poolId, string name, string symbol
    );
    event SupplyLocked(uint256 indexed id, PoolId indexed poolId, int24 tickLower, int24 tickUpper, uint128 liquidity);

    /// @param poolManager_ The Uniswap v4 pool manager every launch opens a pool in.
    /// @param treasury_ Where the treasury's 20% of every fee goes, forever.
    /// @param hookSalt A CREATE2 salt, mined off-chain, that lands the hook on an
    /// address carrying the flags v4 reads its permissions from. The hook's own
    /// constructor checks this and reverts if the salt is wrong, so a
    /// mis-mined salt costs a failed deployment rather than a launchpad whose
    /// fee is never collected.
    constructor(IPoolManager poolManager_, address treasury_, bytes32 hookSalt) {
        if (address(poolManager_) == address(0) || treasury_ == address(0)) revert ZeroAddress();

        poolManager = poolManager_;
        treasury = treasury_;
        hook = new QuadHook{salt: hookSalt}(poolManager_, treasury_);
        locker = new QuadLocker(poolManager_);
    }

    // --------------------------------------------------------------- launching

    /// @notice Launch a token, open its pool, and lock the supply into it.
    function launch(LaunchParams calldata params)
        external
        returns (uint256 id, address token, PoolId poolId, uint128 liquidity)
    {
        if (bytes(params.name).length == 0 || bytes(params.symbol).length == 0) revert EmptyMetadata();

        token = address(new QuadToken(params.name, params.symbol, FIXED_SUPPLY, address(locker)));

        PoolKey memory key = PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO, // native ETH, always the lower currency
            currency1: Currency.wrap(token),
            fee: LP_FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(hook))
        });
        poolId = key.toId();

        // Nobody else can have opened this pool: `beforeInitialize` refuses any
        // caller but this contract, and refuses a pool this contract has not
        // registered. So an already-initialised pool here would mean a token
        // address collision, which is not a thing to carry on through.
        (uint160 existing,,,) = poolManager.getSlot0(poolId);
        if (existing != 0) revert PoolAlreadyExists();

        hook.register(key, msg.sender);

        // The opening price is not passed in and not stored — it is derived from
        // a constant, every time, by the same library the pool manager uses to
        // read it back. There is nothing here for a caller to influence.
        int24 tick = poolManager.initialize(key, TickMath.getSqrtPriceAtTick(OPENING_TICK));

        // The whole range has to sit below spot. A range reaching above it would
        // need ETH as well, and the locker has none to give — it would fail
        // inside the pool manager's callback, which is a worse place to learn it.
        //
        // With the price fixed at the top of the range this holds by
        // construction, so the check is not defending against a bad argument any
        // more; it is defending against an edit. Change `OPENING_TICK` without
        // changing `TICK_LOWER` and the first launch reverts, rather than
        // opening a pool that asks the locker for ETH it does not have.
        if (OPENING_TICK > tick) revert NotSingleSided();

        liquidity = locker.lockIn(key, TICK_LOWER, OPENING_TICK);

        id = _notices.length;
        _notices.push(
            Notice({
                id: id,
                token: token,
                creator: msg.sender,
                name: params.name,
                symbol: params.symbol,
                imageURI: params.imageURI,
                blurb: params.blurb,
                link: params.link,
                supply: FIXED_SUPPLY,
                launchedAt: block.timestamp,
                tickSpacing: TICK_SPACING,
                tickLower: TICK_LOWER,
                tickUpper: OPENING_TICK,
                liquidity: liquidity
            })
        );
        _noticesOf[msg.sender].push(id);
        _noticeOfPool[poolId] = id + 1; // +1, so that "no notice" and "notice 0" differ
        lastLaunchAt = block.timestamp;

        emit Launched(id, token, msg.sender, poolId, params.name, params.symbol);
        emit SupplyLocked(id, poolId, TICK_LOWER, OPENING_TICK, liquidity);
    }

    // ------------------------------------------------------------------- views

    function noticeCount() external view returns (uint256) {
        return _notices.length;
    }

    function noticeAt(uint256 id) external view returns (Notice memory) {
        return _notices[id];
    }

    /// @notice A page of the board, newest first — the order the feed reads in.
    function latest(uint256 offset, uint256 limit) external view returns (Notice[] memory page) {
        uint256 total = _notices.length;
        if (offset >= total) return new Notice[](0);

        uint256 remaining = total - offset;
        uint256 size = remaining < limit ? remaining : limit;
        page = new Notice[](size);

        for (uint256 i = 0; i < size; i++) {
            page[i] = _notices[total - 1 - offset - i];
        }
    }

    function noticesOf(address creator) external view returns (uint256[] memory) {
        return _noticesOf[creator];
    }

    /// @notice The notice a pool belongs to. Reverts for a pool this factory did
    /// not open, rather than answering about notice zero.
    function noticeOfPool(PoolId poolId) external view returns (Notice memory) {
        uint256 slot = _noticeOfPool[poolId];
        if (slot == 0) revert UnknownPool();
        return _notices[slot - 1];
    }

    /// @notice The pool key for a notice — everything needed to trade it, or to
    /// read it out of the pool manager directly.
    function poolKeyOf(uint256 id) public view returns (PoolKey memory) {
        Notice memory notice = _notices[id];
        return PoolKey({
            currency0: CurrencyLibrary.ADDRESS_ZERO,
            currency1: Currency.wrap(notice.token),
            fee: LP_FEE,
            tickSpacing: notice.tickSpacing,
            hooks: IHooks(address(hook))
        });
    }

    function poolIdOf(uint256 id) external view returns (PoolId) {
        return poolKeyOf(id).toId();
    }

    /// @notice Every term of a Quadpad launch that is fixed, in one call.
    ///
    /// The site prints these rather than its own copy of them. A constant that
    /// is typed into a web app is a number that can drift from the contract
    /// without anybody noticing; one that is read out of the contract cannot.
    /// @return supply The supply every launch mints.
    /// @return openingTick The tick every pool opens at, and the top of its range.
    /// @return lowerTick The bottom of the range.
    /// @return tickSpacing The spacing both ends sit on.
    /// @return openingSqrtPriceX96 The opening price itself, as the pool takes it.
    /// @return feeBps The fee on every swap, in basis points.
    /// @return creatorBps The launcher's share of that fee, in basis points.
    function launchTerms()
        external
        view
        returns (
            uint256 supply,
            int24 openingTick,
            int24 lowerTick,
            int24 tickSpacing,
            uint160 openingSqrtPriceX96,
            uint256 feeBps,
            uint256 creatorBps
        )
    {
        return (
            FIXED_SUPPLY,
            OPENING_TICK,
            TICK_LOWER,
            TICK_SPACING,
            TickMath.getSqrtPriceAtTick(OPENING_TICK),
            hook.FEE_BPS(),
            hook.CREATOR_BPS()
        );
    }

    /// @notice What the whole supply is worth in wei at the price every pool
    /// opens at — the number the front of the site is built around.
    ///
    /// Derived from `OPENING_TICK` rather than stored beside it, so there is no
    /// second copy to fall out of step. It comes to 1.700080239 ETH: ticks are
    /// discrete, and that is the nearest one to 1.7.
    ///
    /// The arithmetic is the pool's own, read backwards. A pool quotes
    /// `currency1` per `currency0` as `(sqrtPriceX96 / 2^96)^2`, and ETH is
    /// `currency0` — so one unit of the token costs `2^192 / sqrtPriceX96^2`
    /// wei, and the supply is `FIXED_SUPPLY` of them.
    ///
    /// `FIXED_SUPPLY * 2^192` is about 6e84 and does not fit in 256 bits, so the
    /// multiplication is done in 512 with `Math.mulDiv`. Staging it as two
    /// divisions instead would truncate twice, and this figure is checked
    /// against off-chain arithmetic to the wei.
    function openingMarketCap() public pure returns (uint256 weiValue) {
        uint256 sqrtPriceX96 = uint256(TickMath.getSqrtPriceAtTick(OPENING_TICK));
        return Math.mulDiv(FIXED_SUPPLY, 1 << 192, sqrtPriceX96 * sqrtPriceX96);
    }

    /// @notice Everything the board header needs, in one call.
    function boardStats()
        external
        view
        returns (
            uint256 tokens,
            uint256 lastLaunch,
            uint256 supply,
            uint256 feeBps,
            uint256 creatorBps,
            uint256 openingCapWei
        )
    {
        return (
            _notices.length,
            lastLaunchAt,
            FIXED_SUPPLY,
            hook.FEE_BPS(),
            hook.CREATOR_BPS(),
            openingMarketCap()
        );
    }
}
