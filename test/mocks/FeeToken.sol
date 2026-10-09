// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Plain ERC-20 with an optional 1% transfer tax, to prove KEPT refuses taxed tokens.
contract FeeToken is ERC20 {
    bool public immutable taxed;

    constructor(bool taxed_) ERC20("Team", "TEAM") {
        taxed = taxed_;
        _mint(msg.sender, 1e27);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (taxed && from != address(0) && to != address(0)) {
            uint256 tax = value / 100;
            super._update(from, address(0xFEE), tax);
            value -= tax;
        }
        super._update(from, to, value);
    }
}
