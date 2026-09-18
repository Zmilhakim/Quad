// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

/// @dev The venue the tests run against. `TestPoolManager` is Uniswap's own
/// `PoolManager`, deployed as it ships — a token is launched into the real
/// thing, with real flash accounting, real tick math and real ERC-6909 claims,
/// not a model of them.
contract TestPoolManager is PoolManager {
    constructor(address initialOwner) PoolManager(initialOwner) {}
}

/// @dev The smallest thing that can trade against the pool, so the tests can
/// make a launch earn its fee the only way anything ever does: somebody trades.
contract TestSwapRouter is IUnlockCallback {
    IPoolManager public immutable poolManager;

    struct CallbackData {
        address trader;
        PoolKey key;
        SwapParams params;
    }

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    receive() external payable {}

    /// @notice Swap, paying in whatever `params` implies. Send ETH along when
    /// the input side is native.
    function swap(PoolKey calldata key, SwapParams calldata params) external payable returns (BalanceDelta delta) {
        delta = abi.decode(
            poolManager.unlock(abi.encode(CallbackData({trader: msg.sender, key: key, params: params}))),
            (BalanceDelta)
        );

        // Hand back anything the swap did not need, so a test's accounting is
        // about the pool rather than about this router.
        uint256 dust = address(this).balance;
        if (dust > 0) {
            (bool sent,) = msg.sender.call{value: dust}("");
            require(sent, "refund failed");
        }
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "not the pool manager");

        CallbackData memory call = abi.decode(data, (CallbackData));
        BalanceDelta delta = poolManager.swap(call.key, call.params, "");

        _settle(call.key.currency0, delta.amount0(), call.trader);
        _settle(call.key.currency1, delta.amount1(), call.trader);

        return abi.encode(delta);
    }

    function _settle(Currency currency, int128 amount, address trader) private {
        if (amount == 0) return;

        if (amount > 0) {
            poolManager.take(currency, trader, uint128(amount));
            return;
        }

        uint256 owed = uint256(uint128(-amount));
        if (currency.isAddressZero()) {
            poolManager.settle{value: owed}();
        } else {
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).transferFrom(trader, address(poolManager), owed);
            poolManager.settle();
        }
    }
}
