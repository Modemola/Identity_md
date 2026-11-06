// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {KeptVault} from "../src/KeptVault.sol";
import {KeptMarkets} from "../src/KeptMarkets.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

contract KeptMarketsTest is VaultFixture {
    KeptMarkets internal markets;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    uint64 internal constant DEADLINE = T0 + 7 days;

    function setUp() public override {
        super.setUp();
        markets = new KeptMarkets(address(vault), owner, 1_000 ether);
        address[5] memory who = [alice, bob, carol, creator, beneficiary];
        for (uint256 i; i < who.length; ++i) {
            imd.mint(who[i], 100_000 ether);
            vm.prank(who[i]);
            imd.approve(address(markets), type(uint256).max);
        }
    }

    function _bet(address who, uint256 id, bool yes, uint256 amount) internal {
        vm.prank(who);
        markets.bet(id, 0, yes, amount);
    }

    function _kept(uint256 id) internal {
        bytes32 req = _check(id, 0, beneficiary);
        _deliver(id, 0, req, true);
    }

    function _claim(address who, uint256 id) internal returns (uint256) {
        vm.prank(who);
        return markets.claim(id, 0);
    }

    // ---------------------------------------------------------------- outcomes

    function test_yesWinsWhenTheSwarmSaysKept() public {
        uint256 id = _standard();
        _bet(alice, id, true, 100 ether);
        _bet(bob, id, false, 300 ether);
        _bet(carol, id, false, 100 ether);
        _kept(id);
        uint256 budgetBefore = _budget(id);
        uint256 refereeBefore = vault.refereeFund();

        markets.resolve(id, 0);
        assertEq(uint8(markets.market(id, 0).state), uint8(KeptMarkets.State.Yes));

        // 2% of the 400 IMD losing pool: half to the pledge's check budget, half to the Referee Fund
        assertEq(_budget(id), budgetBefore + 4 ether);
        assertEq(vault.refereeFund(), refereeBefore + 4 ether);
        assertEq(_claim(alice, id), 100 ether + 392 ether);
        assertEq(markets.owed(id, 0, bob), 0);
        assertEq(imd.balanceOf(address(markets)), 0);
    }

    function test_noWinsWhenTheMilestoneBurns() public {
        uint256 id = _standard();
        _bet(alice, id, true, 100 ether);
        _bet(bob, id, false, 50 ether);
        uint256 refereeBefore = vault.refereeFund();
        vm.warp(DEADLINE + vault.GRACE() + 1);

        markets.resolve(id, 0); // settles the vault on the way
        (KeptVault.Outcome o, bool settled) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Broken));
        assertTrue(settled);
        assertEq(uint8(markets.market(id, 0).state), uint8(KeptMarkets.State.No));

        // the pledge is finished, so it takes no budget: the whole 2 IMD fee goes to the Referee Fund
        assertEq(vault.refereeFund(), refereeBefore + 2 ether);
        assertEq(_claim(bob, id), 50 ether + 98 ether);
        vm.prank(alice);
        vm.expectRevert(KeptMarkets.NothingToClaim.selector);
        markets.claim(id, 0);
    }

    function test_oneSidedMarketRefundsWithoutFee() public {
        uint256 id = _standard();
        _bet(alice, id, true, 70 ether);
        _bet(bob, id, true, 30 ether);
        _kept(id);
        uint256 refereeBefore = vault.refereeFund();
        markets.resolve(id, 0);
        assertEq(uint8(markets.market(id, 0).state), uint8(KeptMarkets.State.Refund));
        assertEq(vault.refereeFund(), refereeBefore);
        assertEq(_claim(alice, id), 70 ether);
        assertEq(_claim(bob, id), 30 ether);
    }

    function test_voidsWhenNeverResolvable() public {
        uint256 id = _standard();
        _bet(alice, id, true, 10 ether);
        _bet(bob, id, false, 20 ether);
        vm.mockCallRevert(address(vault), abi.encodeWithSelector(KeptVault.settle.selector), "stuck");

        vm.warp(DEADLINE + vault.GRACE() + 1);
        vm.expectRevert(KeptMarkets.NotResolvable.selector);
        markets.resolve(id, 0);

        vm.warp(DEADLINE + vault.GRACE() + markets.VOID_AFTER() + 1);
        markets.resolve(id, 0);
        assertEq(uint8(markets.market(id, 0).state), uint8(KeptMarkets.State.Void));
        assertEq(_claim(alice, id), 10 ether);
        assertEq(_claim(bob, id), 20 ether);
    }

    // ---------------------------------------------------------------- when betting closes

    function test_closesAtTheDeadline() public {
        uint256 id = _standard();
        _bet(alice, id, true, 1 ether);
        vm.warp(DEADLINE);
        vm.prank(bob);
        vm.expectRevert(KeptMarkets.BettingClosed.selector);
        markets.bet(id, 0, false, 1 ether);
    }

    function test_closesAtTheFirstCheck() public {
        uint256 id = _standard();
        _bet(alice, id, true, 1 ether);
        bytes32 req = _check(id, 0, beneficiary);
        vm.prank(bob);
        vm.expectRevert(KeptMarkets.BettingClosed.selector);
        markets.bet(id, 0, false, 1 ether);

        // a "not delivered" answer leaves the milestone open, but the market stays closed
        _deliver(id, 0, req, false);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Open));
        vm.prank(bob);
        vm.expectRevert(KeptMarkets.BettingClosed.selector);
        markets.bet(id, 0, false, 1 ether);
        (bool open,,,) = markets.quote(id, 0);
        assertFalse(open);
    }

    function test_cannotOpenAfterAnOutcome() public {
        uint256 id = _standard();
        _kept(id);
        vm.prank(alice);
        vm.expectRevert(KeptMarkets.BettingClosed.selector);
        markets.bet(id, 0, false, 1 ether);
    }

    function test_marketOpenedAfterAFailedCheckStillTakesBets() public {
        uint256 id = _standard();
        bytes32 req = _check(id, 0, beneficiary);
        _deliver(id, 0, req, false); // one attempt used, milestone still open
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 1 ether);
        assertEq(markets.market(id, 0).attemptsAtOpen, 1);
    }

    // ---------------------------------------------------------------- guards

    function test_teamCannotBetOnItself() public {
        uint256 id = _standard();
        vm.prank(creator);
        vm.expectRevert(KeptMarkets.InsiderBet.selector);
        markets.bet(id, 0, false, 1 ether);
        vm.prank(beneficiary);
        vm.expectRevert(KeptMarkets.InsiderBet.selector);
        markets.bet(id, 0, true, 1 ether);
    }

    function test_yesPoolIsCappedAndTheCapOnlyGoesDown() public {
        uint256 id = _standard();
        _bet(alice, id, true, 1_000 ether);
        vm.prank(bob);
        vm.expectRevert(KeptMarkets.CapReached.selector);
        markets.bet(id, 0, true, 1);
        _bet(bob, id, false, 5_000 ether); // the NO side is not capped

        vm.prank(stranger);
        vm.expectRevert(KeptMarkets.NotOwner.selector);
        markets.lowerYesCap(1);
        vm.startPrank(owner);
        vm.expectRevert(KeptMarkets.InvalidCap.selector);
        markets.lowerYesCap(2_000 ether);
        markets.lowerYesCap(500 ether);
        vm.stopPrank();
        assertEq(markets.yesCap(), 500 ether);
    }

    function test_pauseStopsBetsButNotPayouts() public {
        uint256 id = _standard();
        _bet(alice, id, true, 10 ether);
        _bet(bob, id, false, 10 ether);
        vm.prank(owner);
        markets.setPaused(true);
        vm.prank(carol);
        vm.expectRevert(KeptMarkets.Paused.selector);
        markets.bet(id, 0, true, 1 ether);
        _kept(id);
        markets.resolve(id, 0);
        assertGt(_claim(alice, id), 10 ether);
    }

    function test_resolveAndClaimGuards() public {
        uint256 id = _standard();
        vm.expectRevert(KeptMarkets.UnknownMarket.selector);
        markets.resolve(id, 0);
        _bet(alice, id, true, 1 ether);
        _bet(bob, id, false, 1 ether);
        vm.expectRevert(KeptMarkets.NotResolvable.selector);
        markets.resolve(id, 0);
        vm.prank(alice);
        vm.expectRevert(KeptMarkets.NotResolved.selector);
        markets.claim(id, 0);
        vm.prank(alice);
        vm.expectRevert(KeptMarkets.ZeroAmount.selector);
        markets.bet(id, 0, true, 0);

        _kept(id);
        markets.resolve(id, 0);
        vm.expectRevert(KeptMarkets.AlreadyResolved.selector);
        markets.resolve(id, 0);
        _claim(alice, id);
        vm.prank(alice);
        vm.expectRevert(KeptMarkets.NothingToClaim.selector);
        markets.claim(id, 0);
    }

    function test_quoteShowsOddsAndCloseTime() public {
        uint256 id = _standard();
        (bool open, uint256 yesBps, uint256 pot, uint64 closesAt) = markets.quote(id, 0);
        assertTrue(open);
        assertEq(yesBps, 5_000);
        assertEq(pot, 0);
        assertEq(closesAt, DEADLINE);
        _bet(alice, id, true, 300 ether);
        _bet(bob, id, false, 100 ether);
        (, yesBps, pot,) = markets.quote(id, 0);
        assertEq(yesBps, 7_500);
        assertEq(pot, 400 ether);
    }

    // ---------------------------------------------------------------- solvency

    /// Whatever the stakes and the outcome, everyone can claim, and only rounding dust is left.
    function testFuzz_payoutsNeverExceedDeposits(uint96[6] memory raw, bool kept) public {
        uint256 id = _standard();
        address[3] memory who = [alice, bob, carol];
        uint256 deposits;
        for (uint256 i; i < 6; ++i) {
            uint256 amount = bound(raw[i], 1, 300 ether); // 3 YES bets stay under the 1,000 IMD cap
            _bet(who[i % 3], id, i < 3, amount);
            deposits += amount;
        }
        uint256 refereeBefore = vault.refereeFund();
        uint256 budgetBefore = _budget(id);
        if (kept) {
            _kept(id);
            budgetBefore = _budget(id);
        } else {
            vm.warp(DEADLINE + vault.GRACE() + 1);
        }
        markets.resolve(id, 0);
        uint256 fee = vault.refereeFund() - refereeBefore + (_budget(id) - budgetBefore);

        uint256 paid;
        for (uint256 i; i < 3; ++i) {
            if (markets.owed(id, 0, who[i]) != 0) paid += _claim(who[i], id);
        }
        assertLe(paid + fee, deposits);
        assertLe(deposits - paid - fee, 3); // at most one wei of rounding per winner
        assertEq(imd.balanceOf(address(markets)), deposits - paid - fee);
    }
}
