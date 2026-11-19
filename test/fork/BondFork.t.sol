// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptBond} from "../../src/KeptBond.sol";
import {KeptVaultV2} from "../../src/v2/KeptVaultV2.sol";

/// @title A KEPT bond on the live testnet vault, with real $SCOUT
/// @notice Opt-in: `forge test --match-contract BondForkTest --fork-url https://rpc.testnet.chain.robinhood.com`
/// Bonds ETH behind milestone 2 of pledge #1001 ($SCOUT, on the testnet KeptVaultV2), lets it
/// break, and has a holder sell $SCOUT into the auction.
contract BondForkTest is Test {
    KeptVaultV2 constant VAULT = KeptVaultV2(0x2E46f4BDDdC8664982b2266462d70c056cdF7eE2);
    IERC20 constant SCOUT = IERC20(0x0a272E5eE3F48c668ccF30E65E7738099AE0a1DE);
    address constant TEAM = 0x3ACB6d0Cb65532A90665330f5FF4CbC0C68Cd185;
    KeptBond bonds;
    address treasury = makeAddr("treasury");
    address holder = makeAddr("holder");

    function setUp() public {
        if (address(VAULT).code.length == 0 || address(SCOUT).code.length == 0) {
            vm.skip(true);
            return;
        }
        vm.chainId(46630);
        bonds = new KeptBond(address(VAULT), treasury);
    }

    function test_aBrokenScoutPromisePaysScoutHolders() public {
        (,,, uint8 outcome0,,) = _m();
        assertEq(outcome0, 0, "milestone 2 is still open");
        vm.deal(TEAM, 5 ether);
        vm.prank(TEAM);
        bonds.bond{value: 1 ether}(1001, 1);

        // nobody proves it: the vault burns the tranche after its deadline and grace
        (uint64 deadline,,,,,) = _m();
        vm.warp(uint256(deadline) + VAULT.GRACE() + 1);
        VAULT.settle(1001, 1);
        (,,, uint8 outcome,,) = _m();
        assertEq(outcome, 2, "broken");
        bonds.resolve(1001, 1);

        // a holder sells $SCOUT to the bond once the bid is worth it
        vm.prank(TEAM);
        SCOUT.transfer(holder, 10_000_000 ether);
        vm.startPrank(holder);
        SCOUT.approve(address(bonds), type(uint256).max);
        (,,,,, uint64 t0,,,) = bonds.bondInfo(1001, 1);
        vm.warp(uint256(t0) + 8 hours);
        uint256 dead = SCOUT.balanceOf(bonds.DEAD());
        (uint256 sold, uint256 eth) = bonds.sell(1001, 1, 1_000_000 ether, 0);
        vm.stopPrank();
        assertGt(eth, 0);
        assertEq(holder.balance, eth, "paid in ETH");
        assertEq(SCOUT.balanceOf(bonds.DEAD()) - dead, sold, "real SCOUT burned");
        emit log_named_decimal_uint("ETH paid for 1M SCOUT, 8 hours in", eth, 18);
    }

    function _m() internal view returns (uint64 deadline, uint128 amount, bool settled, uint8 outcome, uint8 attempts, uint64 askedAt) {
        KeptVaultV2.Outcome o;
        (, , deadline, amount, o, settled, attempts,, askedAt) = VAULT.milestone(1001, 1);
        outcome = uint8(o);
    }
}
