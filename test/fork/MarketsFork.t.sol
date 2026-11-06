// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptMarkets} from "../../src/KeptMarkets.sol";
import {IKeptVault} from "../../src/interfaces/IKeptVault.sol";

/// KeptMarkets against the live vault on Robinhood Chain: pledge #1's open milestone 3.
///
/// `forge test --match-contract MarketsForkTest --fork-url https://rpc.mainnet.chain.robinhood.com`
contract MarketsForkTest is Test {
    IKeptVault internal constant VAULT = IKeptVault(0x3152f9cbF64D0C1AC24EA7E101dB3E4d8da86896);
    address internal constant OWNER = 0xD3336A7c8a7D8814C437196aBb16c4FE7aA7B016;
    KeptMarkets internal markets;
    IERC20 internal imd;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function setUp() public {
        assertGt(address(VAULT).code.length, 0, "live vault code");
        markets = new KeptMarkets(address(VAULT), OWNER, 1_000 ether);
        imd = IERC20(VAULT.imd());
        deal(address(imd), alice, 100 ether);
        deal(address(imd), bob, 100 ether);
        vm.prank(alice);
        imd.approve(address(markets), type(uint256).max);
        vm.prank(bob);
        imd.approve(address(markets), type(uint256).max);
    }

    function test_liveMilestoneThreeTakesBetsAndBurnsToNo() public {
        (,, uint64 deadline,, uint8 outcome,,,,) = VAULT.milestone(1, 2);
        if (outcome != 0 || block.timestamp >= deadline) return; // only meaningful while it is open
        (bool open,,,) = markets.quote(1, 2);
        assertTrue(open);

        vm.prank(alice);
        markets.bet(1, 2, true, 10 ether);
        vm.prank(bob);
        markets.bet(1, 2, false, 30 ether);

        // the KEPT team cannot bet on its own milestone
        deal(address(imd), OWNER, 1 ether);
        vm.startPrank(OWNER);
        imd.approve(address(markets), 1 ether);
        vm.expectRevert(KeptMarkets.InsiderBet.selector);
        markets.bet(1, 2, false, 1 ether);
        vm.stopPrank();

        // nobody proves it: past deadline + GRACE the market settles the vault and NO wins
        uint256 referee = _referee();
        vm.warp(uint256(deadline) + VAULT.GRACE() + 1);
        markets.resolve(1, 2);
        assertEq(uint8(markets.market(1, 2).state), uint8(KeptMarkets.State.No));
        (,,,, outcome,,,,) = VAULT.milestone(1, 2);
        assertEq(outcome, 2);
        vm.prank(bob);
        assertEq(markets.claim(1, 2), 30 ether + 9.8 ether);
        assertEq(_referee(), referee + 0.2 ether); // pledge #1 is finished, so all of the fee
    }

    function _referee() internal view returns (uint256 r) {
        (bool ok, bytes memory data) = address(VAULT).staticcall(abi.encodeWithSignature("refereeFund()"));
        require(ok);
        r = abi.decode(data, (uint256));
    }
}
