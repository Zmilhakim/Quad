// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @title QuadRouter
/// @notice The way in and out of a Quadpad pool.
///
/// A v4 pool cannot be traded with directly: the pool manager only opens for a
/// contract that can answer `unlockCallback`, and settles in deltas rather than
/// transfers. So a launched token is untradeable until something like this
/// exists, which is the whole reason it does.
///
/// ## What it is not
///
/// It holds nothing. It has no owner, no upgrade path, no pause, no fee of its
/// own, and no privileged caller. Every function settles inside the one
/// transaction that started it and sends the proceeds to the caller, so an
/// approval left on this contract cannot be spent by anybody but the account
/// that gave it, on the swap it asks for.
///
/// ## What it protects
///
/// Two things, because a swap against a thin pool is where money goes missing:
///
///   * **A limit on the price.** Every entry point takes a worst acceptable
///     result and reverts rather than settling outside it. There is no
///     "unlimited slippage" call in this file.
///   * **A deadline.** A swap that sits unmined until the price has moved is a
///     swap at a price nobody agreed to.
///
/// ## The 4% is not here
///
/// The fee belongs to the hook, and this contract neither adds to it nor knows
/// its rate. What the caller is quoted here is what the pool and the hook
/// between them decide, which is why the amounts below are read back off the
/// settled delta rather than predicted.
contract QuadRouter is IUnlockCallback {
    using SafeERC20 for IERC20;

    /// @dev The swap runs to the end of the curve; the caller's own limit is
    /// what stops it, checked against what actually settled. A price limit here
    /// would silently return less than asked for instead of reverting.
    uint160 internal constant NO_PRICE_LIMIT_UP = TickMath.MAX_SQRT_PRICE - 1;
    uint160 internal constant NO_PRICE_LIMIT_DOWN = TickMath.MIN_SQRT_PRICE + 1;

    IPoolManager public immutable poolManager;

    struct CallbackData {
        address trader;
        PoolKey key;
        SwapParams params;
    }

    error Deadline(uint256 deadline, uint256 blockTime);
    error NativeInputExpected();
    error NotPoolManager();
    error NothingIn();
    error RefundFailed();
    error TooLittleReceived(uint256 received, uint256 minimum);
    error TooMuchSpent(uint256 spent, uint256 maximum);

    event Swapped(
        address indexed trader, PoolKey key, bool indexed zeroForOne, uint256 amountIn, uint256 amountOut
    );

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    /// @dev Native ETH arrives here from `take` during a sell, and as the
    /// caller's own change during a buy. It is sent on before the call returns.
    receive() external payable {}

    modifier before(uint256 deadline) {
        if (block.timestamp > deadline) revert Deadline(deadline, block.timestamp);
        _;
    }

    // ------------------------------------------------------------------- buy

    /// @notice Spend the ETH sent with this call on the pool's token.
    /// @param key The pool, exactly as the factory's notice reports it.
    /// @param minTokensOut The fewest tokens worth doing this for. Reverts below it.
    /// @param deadline The last block timestamp this may be mined at.
    /// @return tokensOut What the caller received.
    /// @dev The whole of `msg.value` is the input, so there is no second number
    /// that could disagree with it.
    function buy(PoolKey calldata key, uint256 minTokensOut, uint256 deadline)
        external
        payable
        before(deadline)
        returns (uint256 tokensOut)
    {
        if (!key.currency0.isAddressZero()) revert NativeInputExpected();
        if (msg.value == 0) revert NothingIn();

        BalanceDelta delta = _swap(key, true, -int256(msg.value));

        tokensOut = uint256(uint128(delta.amount1()));
        if (tokensOut < minTokensOut) revert TooLittleReceived(tokensOut, minTokensOut);

        _refund();
        emit Swapped(msg.sender, key, true, msg.value, tokensOut);
    }

    /// @notice Buy an exact number of tokens, paying up to the ETH sent.
    /// @dev This is the path an aggregator takes, and the one the hook charges
    /// in `afterSwap` rather than `beforeSwap`. Whatever is not spent goes back
    /// in the same transaction.
    /// @return ethSpent What the swap actually cost, fee included.
    function buyExactTokens(PoolKey calldata key, uint256 tokensOut, uint256 deadline)
        external
        payable
        before(deadline)
        returns (uint256 ethSpent)
    {
        if (!key.currency0.isAddressZero()) revert NativeInputExpected();
        if (tokensOut == 0) revert NothingIn();

        BalanceDelta delta = _swap(key, true, int256(tokensOut));

        ethSpent = uint256(uint128(-delta.amount0()));
        if (ethSpent > msg.value) revert TooMuchSpent(ethSpent, msg.value);

        _refund();
        emit Swapped(msg.sender, key, true, ethSpent, tokensOut);
    }

    // ------------------------------------------------------------------ sell

    /// @notice Sell tokens back to the pool for ETH.
    /// @param tokensIn How many to sell. The caller must have approved this
    /// contract for at least that much first.
    /// @param minEthOut The least ETH worth doing this for. Reverts below it.
    /// @return ethOut What the caller received.
    function sell(PoolKey calldata key, uint256 tokensIn, uint256 minEthOut, uint256 deadline)
        external
        before(deadline)
        returns (uint256 ethOut)
    {
        if (tokensIn == 0) revert NothingIn();

        BalanceDelta delta = _swap(key, false, -int256(tokensIn));

        ethOut = uint256(uint128(delta.amount0()));
        if (ethOut < minEthOut) revert TooLittleReceived(ethOut, minEthOut);

        _refund();
        emit Swapped(msg.sender, key, false, tokensIn, ethOut);
    }

    // ----------------------------------------------------------- the plumbing

    function _swap(PoolKey calldata key, bool zeroForOne, int256 amountSpecified) private returns (BalanceDelta) {
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: zeroForOne ? NO_PRICE_LIMIT_DOWN : NO_PRICE_LIMIT_UP
        });

        return abi.decode(
            poolManager.unlock(abi.encode(CallbackData({trader: msg.sender, key: key, params: params}))), (BalanceDelta)
        );
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();

        CallbackData memory call = abi.decode(data, (CallbackData));
        BalanceDelta delta = poolManager.swap(call.key, call.params, "");

        _settle(call.key.currency0, delta.amount0(), call.trader);
        _settle(call.key.currency1, delta.amount1(), call.trader);

        return abi.encode(delta);
    }

    /// @dev One side of the settled delta. Positive is owed to the trader and
    /// taken straight to them; negative is owed to the pool and paid — in ETH
    /// from what came with the call, or pulled from the trader's own balance,
    /// which is the only account this contract ever moves a token out of.
    function _settle(Currency currency, int128 amount, address trader) private {
        if (amount == 0) return;

        if (amount > 0) {
            poolManager.take(currency, currency.isAddressZero() ? address(this) : trader, uint128(amount));
            return;
        }

        uint256 owed = uint256(uint128(-amount));
        if (currency.isAddressZero()) {
            poolManager.settle{value: owed}();
        } else {
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransferFrom(trader, address(poolManager), owed);
            poolManager.settle();
        }
    }

    /// @dev Everything this contract is holding, back to the caller. It is the
    /// last thing every entry point does, so the balance here is zero between
    /// transactions and there is nothing for a later caller to sweep.
    function _refund() private {
        uint256 balance = address(this).balance;
        if (balance == 0) return;

        (bool sent,) = msg.sender.call{value: balance}("");
        if (!sent) revert RefundFailed();
    }
}
