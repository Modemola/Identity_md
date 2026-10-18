// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {KeptVault} from "../src/KeptVault.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

/// @notice Documents the supported token boundary for audit finding 74f963a8ddc3.
/// @dev KEPT accounts in nominal token units, not rebasing shares. See README's token restrictions.
contract KeptVaultTokenCompatibilityTest is VaultFixture {
    function test_standardTokenSharedPledgesSettleAndRefundIndependently() public {
        uint256 first = _standard();
        uint256 last = _standard();
        bytes32 rid = _check(last, 0, beneficiary);
        _deliver(last, 0, rid, true);
        vault.settle(last, 0);
        assertEq(vault.withdrawBudget(last), 10 ether - PRICE);
        vm.warp(T0 + 11 days);
        vault.settle(first, 0);
        assertEq(vault.withdrawBudget(first), 10 ether);
        assertEq(team.balanceOf(beneficiary), 100 ether);
        assertEq(team.balanceOf(vault.BURN()), 100 ether);
        assertEq(team.balanceOf(address(vault)), 0);
        assertEq(vault.totalBudgets(), 0);
    }

    /// @notice Reproduction of the expressly unsupported shrinking-balance token case.
    /// An ERC-20 interface cannot reveal whether a future rebase, decay or confiscation is possible.
    function test_unsupportedBalanceShrinkCanStrandLastTrancheAndBudget() public {
        uint256 first = _standard();
        uint256 last = _standard();
        // Model a 10% negative rebase/confiscation after two exact deposits of 100 tokens each.
        deal(address(team), address(vault), 180 ether);
        vm.warp(T0 + 11 days);
        vault.settle(first, 0);
        assertEq(team.balanceOf(address(vault)), 80 ether);
        vm.expectRevert(
            abi.encodeWithSignature(
                "ERC20InsufficientBalance(address,uint256,uint256)", address(vault), 80 ether, 100 ether
            )
        );
        vault.settle(last, 0);
        (,,,,,, uint8 open, uint128 locked, uint256 budget,,) = vault.pledge(last);
        assertEq(open, 1);
        assertEq(locked, 100 ether);
        assertEq(budget, 10 ether);
        vm.expectRevert(KeptVault.NotOpen.selector);
        vault.withdrawBudget(last);
    }
}
