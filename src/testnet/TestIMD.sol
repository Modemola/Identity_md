// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Test IMD, for KEPT on testnets the IMD oracle does not serve
/// @notice Pays for test checks on a testnet KEPT vault. Worth nothing: anyone can take 100 a day
/// from the faucet.
contract TestIMD is ERC20 {
    uint256 public constant DRIP = 100 ether;
    uint256 public constant COOLDOWN = 1 days;
    mapping(address => uint256) public lastDrip;

    error TooSoon(uint256 nextAt);

    constructor() ERC20("Test IMD (KEPT testnet)", "tIMD") {}

    function faucet() external {
        uint256 next = lastDrip[msg.sender] + COOLDOWN;
        if (lastDrip[msg.sender] != 0 && block.timestamp < next) revert TooSoon(next);
        lastDrip[msg.sender] = block.timestamp;
        _mint(msg.sender, DRIP);
    }
}
