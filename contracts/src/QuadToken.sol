// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title QuadToken
/// @notice A fixed-supply ERC20. The whole supply is minted once, in the
/// constructor, straight to the locker that is about to put all of it into the
/// pool. There is no mint function, no owner and no pause: the supply printed
/// at launch is the supply forever.
///
/// The supply never passes through the factory or the creator's hands. It is
/// minted to the locker and goes from there into liquidity, so "the team holds
/// nothing" is not a promise anyone has to keep — there is no moment at which
/// anybody holds anything to keep.
contract QuadToken is ERC20 {
    /// @param name_ Token name, as it appears on the board.
    /// @param symbol_ Ticker, as it appears on the board.
    /// @param supply_ The whole supply, minted in full to `recipient`.
    /// @param recipient The locker, which moves all of it into the pool.
    constructor(string memory name_, string memory symbol_, uint256 supply_, address recipient)
        ERC20(name_, symbol_)
    {
        _mint(recipient, supply_);
    }

    /// @notice Burn tokens you hold. The locker calls this on the dust left over
    /// after the position is minted, so a launch never ends with a stray balance
    /// sitting anywhere.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
