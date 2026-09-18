// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";

import {QuadToken} from "./QuadToken.sol";

/// @title QuadLocker
/// @notice Holds the liquidity of every token launched through Quadpad, and has
/// no way to give any of it back.
///
/// The whole surface is two functions: one the factory calls once per launch to
/// put a supply in, and the pool manager's callback that does it. There is no
/// withdraw, no owner, no emergency, and no upgrade. **Search this file: every
/// liquidity delta in it is zero or positive.** Liquidity leaves a v4 pool
/// through exactly one door — a `modifyLiquidity` with a negative delta — and
/// there is no such call here.
///
/// A v4 position is not an NFT. It is a row in the pool manager keyed by the
/// address that added it, which is this contract. So there is nothing to
/// transfer, sell, borrow against, or approve away by mistake: the position is
/// not an object that exists outside the pool manager at all.
///
/// One locker holds every launch. Positions are keyed per pool, so two launches
/// can never reach each other's liquidity, and a launch costs one contract
/// deployment less.
///
/// There is nothing to collect here either. Quadpad pools are opened with an LP
/// fee of zero — the 4% fee in `QuadHook` is the entire fee schedule — so this
/// contract never accrues fees that would then need a way out.
contract QuadLocker is IUnlockCallback {
    using StateLibrary for IPoolManager;

    /// @dev One position per pool, so it needs no distinguishing salt.
    bytes32 internal constant POSITION_SALT = bytes32(0);

    struct Lock {
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        address token;
        uint256 lockedAt;
    }

    IPoolManager public immutable poolManager;

    /// @notice The factory that deployed this locker. The only address that can
    /// put liquidity in, and it has no way to take any out either.
    address public immutable factory;

    mapping(PoolId poolId => Lock) private _locks;

    error AlreadyLocked();
    error NotFactory();
    error NotPoolManager();
    error NothingToLock();

    event LockedIn(PoolId indexed poolId, address indexed token, int24 tickLower, int24 tickUpper, uint128 liquidity);

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
        factory = msg.sender;
    }

    /// @notice Put the whole balance this contract holds of the pool's token in
    /// as one position, and shut it. Once per pool, by the factory, in the
    /// launch transaction.
    /// @dev The amount is read as a balance rather than passed in, so there is
    /// no argument a caller could use to hold part of a supply back.
    function lockIn(PoolKey calldata key, int24 tickLower, int24 tickUpper) external returns (uint128 liquidity) {
        if (msg.sender != factory) revert NotFactory();

        PoolId id = key.toId();
        // The token, not the timestamp: a chain whose genesis block is at zero
        // would make a timestamp an unreliable way to ask whether this has run.
        if (_locks[id].token != address(0)) revert AlreadyLocked();

        liquidity = abi.decode(poolManager.unlock(abi.encode(key, tickLower, tickUpper)), (uint128));

        _locks[id] = Lock({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            token: Currency.unwrap(key.currency1),
            lockedAt: block.timestamp
        });

        emit LockedIn(id, Currency.unwrap(key.currency1), tickLower, tickUpper, liquidity);
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        (PoolKey memory key, int24 tickLower, int24 tickUpper) = abi.decode(data, (PoolKey, int24, int24));

        // The token is currency1 in every Quadpad pool: the other side is native
        // ETH, which is address(0) and therefore always the lower currency.
        uint256 supply = IERC20(Currency.unwrap(key.currency1)).balanceOf(address(this));
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96, TickMath.getSqrtPriceAtTick(tickLower), TickMath.getSqrtPriceAtTick(tickUpper), 0, supply
        );
        if (liquidity == 0) revert NothingToLock();

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: int256(uint256(liquidity)), // positive, here and nowhere else
                salt: POSITION_SALT
            }),
            ""
        );

        // The range sits entirely below spot, so the pool asks for the token and
        // nothing else. The factory checked that before getting here; this is
        // where it would show up if it were ever not true.
        uint256 owed = uint256(uint128(-delta.amount1()));
        poolManager.sync(key.currency1);
        IERC20(Currency.unwrap(key.currency1)).transfer(address(poolManager), owed);
        poolManager.settle();

        // Liquidity is quantised, so a little of the supply does not fit. It is
        // destroyed rather than kept: a launch leaves no balance anywhere, not
        // even here.
        uint256 dust = supply - owed;
        if (dust > 0) QuadToken(Currency.unwrap(key.currency1)).burn(dust);

        return abi.encode(liquidity);
    }

    // ------------------------------------------------------------------- views

    /// @notice What this contract locked into a pool, and when.
    function lockOf(PoolId poolId) external view returns (Lock memory) {
        return _locks[poolId];
    }

    /// @notice The position's liquidity as the pool manager has it, rather than
    /// as this contract remembers it.
    function lockedLiquidity(PoolId poolId) external view returns (uint128) {
        Lock memory lock = _locks[poolId];
        if (lock.token == address(0)) return 0;
        return poolManager.getPositionLiquidity(
            poolId, keccak256(abi.encodePacked(address(this), lock.tickLower, lock.tickUpper, POSITION_SALT))
        );
    }
}
