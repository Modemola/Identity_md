// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptBond} from "../src/KeptBond.sol";
import {KeptVaultV2} from "../src/v2/KeptVaultV2.sol";
import {KeptQuestionsV2} from "../src/v2/KeptQuestionsV2.sol";
import {QuestionsV2} from "../src/v2/QuestionsV2.sol";
import {OracleAttestation} from "../src/OracleAttestation.sol";
import {TestIntake} from "../src/testnet/TestIntake.sol";
import {TestIMD} from "../src/testnet/TestIMD.sol";
import {FeeToken} from "./mocks/FeeToken.sol";

/// Tries to take its refund twice by re-entering from the ETH it receives.
contract GreedyBonder {
    KeptBond immutable bondC;
    uint256 immutable id;
    bool tried;
    bool public reentered;

    constructor(KeptBond b, uint256 id_) {
        bondC = b;
        id = id_;
    }

    function post() external payable {
        bondC.bond{value: msg.value}(id, 0);
    }

    function take() external {
        bondC.refund(id, 0);
    }

    receive() external payable {
        if (tried) return;
        tried = true;
        try bondC.refund(id, 0) {
            reentered = true;
        } catch {}
    }
}

/// KEPT bonds against the real KeptVaultV2, with verdicts signed by a test oracle.
contract KeptBondTest is Test {
    bytes32 constant ACTION = 0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000;
    uint256 constant ORACLE_KEY = 0x0A11CE;
    address operator = makeAddr("operator");
    address team = makeAddr("team");
    address backer = makeAddr("backer");
    address holder = makeAddr("holder");
    address treasury = makeAddr("treasury");
    TestIMD imd;
    TestIntake intake;
    KeptVaultV2 vault;
    KeptBond bonds;
    FeeToken token;
    uint64 deadline;

    function setUp() public {
        vm.chainId(46630);
        vm.warp(1_800_000_000);
        imd = new TestIMD();
        intake = new TestIntake(operator, operator, 0.5 ether);
        vault = new KeptVaultV2(operator, address(intake), address(imd), ACTION, vm.addr(ORACLE_KEY), 9, 7, address(new KeptQuestionsV2()));
        bonds = new KeptBond(address(vault), treasury);
        token = new FeeToken(false);
        token.mint(team, 1_000 ether);
        token.mint(holder, 1_000_000 ether);
        vm.deal(team, 100 ether);
        vm.deal(backer, 100 ether);
        vm.startPrank(team);
        imd.faucet();
        imd.approve(address(vault), type(uint256).max);
        token.approve(address(vault), type(uint256).max);
        vm.stopPrank();
        vm.prank(holder);
        token.approve(address(bonds), type(uint256).max);
        deadline = uint64(block.timestamp + 7 days);
    }

    // ------------------------------------------------------------------ helpers

    function _pledge(QuestionsV2.Kind kind) internal returns (uint256 id) {
        KeptVaultV2.MilestoneInput[] memory ms = new KeptVaultV2.MilestoneInput[](1);
        ms[0].kind = kind;
        ms[0].deadline = deadline;
        ms[0].amount = 100 ether;
        ms[0].title = "Ship v2";
        if (kind == QuestionsV2.Kind.GithubRelease) {
            ms[0].a = "modemola/identity_md";
            ms[0].b = "v2.0.0";
        } else {
            ms[0].chainId = 4663;
            ms[0].target = address(0xBEEF);
            ms[0].a = "totalSupply()";
            ms[0].threshold = 10 ether;
        }
        vm.prank(team);
        id = vault.createPledge(IERC20(address(token)), team, "Bonded pledge", ms, 5 ether);
    }

    function _deliver(uint256 id, uint8 answerType, bytes memory answer) internal {
        vm.prank(team);
        bytes32 rid = vault.check(id, 0);
        QuestionsV2.Spec memory spec = vault.milestoneSpec(id, 0);
        OracleAttestation.Attestation memory a;
        a.requestId = keccak256(abi.encode("bond", id, block.timestamp));
        a.chainId = spec.kind == QuestionsV2.Kind.GithubRelease ? block.chainid : spec.chainId;
        a.questionHash = keccak256("q");
        a.answerType = answerType;
        a.answer = answer;
        a.panelSize = 9;
        a.quorum = 7;
        a.agreed = 9;
        a.issuedAt = uint64(block.timestamp);
        a.expiresAt = a.issuedAt + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_KEY, this.digest(a));
        vm.prank(operator);
        (bool ok,) = intake.deliver(rid, a, abi.encodePacked(r, s, v));
        assertTrue(ok, "verdict delivered");
    }

    function digest(OracleAttestation.Attestation calldata a) external view returns (bytes32) {
        return vault.attestationDigest(a);
    }

    function _keep(uint256 id) internal {
        _deliver(id, OracleAttestation.ANSWER_BOOL, abi.encode(true));
    }

    function _break(uint256 id) internal {
        vm.warp(uint256(deadline) + vault.GRACE() + 1);
        vault.settle(id, 0);
    }

    function _bond(uint256 id, address who, uint256 eth) internal {
        vm.prank(who);
        bonds.bond{value: eth}(id, 0);
    }

    // ------------------------------------------------------------------ kept

    function test_keptReturnsEveryBondInFull() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        _bond(id, team, 3 ether);
        _bond(id, backer, 1 ether);
        assertEq(address(bonds).balance, 4 ether);
        _keep(id);
        bonds.resolve(id, 0);
        (uint256 total, uint256 refundable, uint256 forfeit,,,, uint16 share, bool resolved, uint256 price) = bonds.bondInfo(id, 0);
        assertEq(total, 4 ether);
        assertEq(refundable, 4 ether);
        assertEq(forfeit, 0);
        assertEq(share, 10_000);
        assertTrue(resolved);
        assertEq(price, 0, "no auction after a kept promise");

        uint256 before = team.balance;
        vm.prank(team);
        bonds.refund(id, 0);
        assertEq(team.balance - before, 3 ether);
        vm.prank(backer);
        bonds.refund(id, 0);
        assertEq(address(bonds).balance, 0);
        vm.prank(team);
        vm.expectRevert(KeptBond.NothingToRefund.selector);
        bonds.refund(id, 0);
        vm.prank(holder);
        vm.expectRevert(KeptBond.AuctionClosed.selector);
        bonds.sell(id, 0, 1 ether, 0);
    }

    // ------------------------------------------------------------------ broken

    function test_brokenForfeitsAndHoldersSellIntoTheAuction() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        _bond(id, team, 2 ether);
        _break(id);
        bonds.resolve(id, 0);
        (,, uint256 forfeit, uint256 startPrice, uint256 maxPrice, uint64 t0,,,) = bonds.bondInfo(id, 0);
        assertEq(forfeit, 2 ether);
        assertEq(startPrice, (2 ether * 1e18) / token.totalSupply(), "the opening bid: the whole forfeit for the whole supply");
        assertEq(maxPrice, 2 ether, "the highest bid: one whole token for the whole forfeit");
        vm.prank(team);
        vm.expectRevert(KeptBond.NothingToRefund.selector);
        bonds.refund(id, 0);

        // 10 hours on, the bid has doubled 10 times
        vm.warp(uint256(t0) + 10 hours);
        uint256 price = bonds.priceNow(id, 0);
        assertEq(price, startPrice << 10);
        uint256 dead = token.balanceOf(bonds.DEAD());
        uint256 before = holder.balance;
        vm.prank(holder);
        (uint256 sold, uint256 eth) = bonds.sell(id, 0, 100_000 ether, 0);
        assertEq(sold, 100_000 ether);
        assertEq(eth, (100_000 ether * price) / 1e18);
        assertEq(holder.balance - before, eth, "the holder is paid in ETH");
        assertEq(token.balanceOf(bonds.DEAD()) - dead, sold, "every token bought is burned");

        // a seller offering more than the rest can pay for sells only what it pays for
        token.mint(holder, 2_000_000 ether);
        vm.prank(holder);
        (uint256 sold2, uint256 eth2) = bonds.sell(id, 0, 2_000_000 ether, 0);
        assertEq(eth + eth2, 2 ether, "the whole forfeit went to holders");
        assertLt(sold2, 2_000_000 ether);
        assertGe((sold2 * price) / 1e18, eth2, "the last seller was paid no more than its tokens are worth");
        assertEq(address(bonds).balance, 0);
        vm.prank(holder);
        vm.expectRevert(KeptBond.AuctionClosed.selector);
        bonds.sell(id, 0, 1 ether, 0);
    }

    function test_partialCreditSplitsTheBond() public {
        uint256 id = _pledge(QuestionsV2.Kind.ValueScaled);
        _bond(id, team, 1 ether);
        vm.warp(uint256(deadline) + 1);
        _deliver(id, OracleAttestation.ANSWER_UINT256, abi.encode(uint256(4 ether)));
        bonds.resolve(id, 0);
        (, uint256 refundable, uint256 forfeit,,,, uint16 share,,) = bonds.bondInfo(id, 0);
        assertEq(share, 4_000);
        assertEq(refundable, 0.4 ether);
        assertEq(forfeit, 0.6 ether);
        assertEq(bonds.refundOf(id, 0, team), 0.4 ether);
        uint256 before = team.balance;
        vm.prank(team);
        bonds.refund(id, 0);
        assertEq(team.balance - before, 0.4 ether);
    }

    // ------------------------------------------------------------------ the price

    function test_bidDoublesEveryHourAndRisesInAStraightLineBetween() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        _bond(id, team, 1 ether);
        _break(id);
        bonds.resolve(id, 0);
        (,,, uint256 start, uint256 cap, uint64 t0,,,) = bonds.bondInfo(id, 0);
        assertEq(bonds.priceNow(id, 0), start);
        vm.warp(uint256(t0) + 30 minutes);
        assertEq(bonds.priceNow(id, 0), start + start / 2, "halfway to the first doubling");
        vm.warp(uint256(t0) + 1 hours);
        assertEq(bonds.priceNow(id, 0), start * 2);
        vm.warp(uint256(t0) + 4 hours);
        assertEq(bonds.priceNow(id, 0), start * 16);
        vm.warp(uint256(t0) + 200 hours);
        assertEq(bonds.priceNow(id, 0), cap, "the bid stops at one whole token for the whole forfeit");
    }

    /// The flaw a falling price would have: one token taking the whole bond as the auction opens.
    function test_oneTokenCannotTakeTheBondAtTheOpen() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        _bond(id, team, 10 ether);
        _break(id);
        bonds.resolve(id, 0);
        vm.prank(holder);
        (, uint256 eth) = bonds.sell(id, 0, 1 ether, 0);
        assertLt(eth, 1e10, "a whole token gets a sliver at the opening bid");
        (,, uint256 forfeit,,,,,,) = bonds.bondInfo(id, 0);
        assertGt(forfeit, 10 ether - 1e10, "the bond is almost untouched");
    }

    function test_sixDecimalTokensArePricedPerWholeToken() public {
        // a 6-decimal token: one whole token (1e6 units) takes the whole forfeit at the start
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        _bond(id, team, 1 ether);
        _break(id);
        vm.mockCall(address(token), abi.encodeWithSignature("decimals()"), abi.encode(uint8(6)));
        bonds.resolve(id, 0);
        vm.clearMockedCalls();
        (,,,, uint256 maxPrice, uint64 t0,,,) = bonds.bondInfo(id, 0);
        assertEq(maxPrice, 1 ether * 1e12);
        vm.warp(uint256(t0) + 200 hours);
        vm.prank(holder);
        (, uint256 eth) = bonds.sell(id, 0, 1e5, 0);
        assertEq(eth, 0.1 ether, "a tenth of a token takes a tenth of the forfeit");
    }

    function test_slippageGuard() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        _bond(id, team, 1 ether);
        _break(id);
        bonds.resolve(id, 0);
        vm.warp(block.timestamp + 10 hours);
        uint256 quote = (1 ether * bonds.priceNow(id, 0)) / 1e18;
        vm.prank(holder);
        vm.expectRevert(KeptBond.SlippageExceeded.selector);
        bonds.sell(id, 0, 1 ether, quote + 1);
    }

    // ------------------------------------------------------------------ rules

    function test_bondRules() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        vm.prank(team);
        vm.expectRevert(KeptBond.TooSmall.selector);
        bonds.bond{value: 0.0009 ether}(id, 0);
        vm.expectRevert(KeptBond.NotResolvable.selector);
        bonds.resolve(id, 0);
        _bond(id, team, 1 ether);
        vm.expectRevert(KeptBond.NotResolvable.selector);
        bonds.resolve(id, 0);
        vm.prank(team);
        vm.expectRevert(KeptBond.NotResolved.selector);
        bonds.refund(id, 0);
        _keep(id);
        vm.prank(backer);
        vm.expectRevert(KeptBond.TooLate.selector);
        bonds.bond{value: 1 ether}(id, 0);
        bonds.resolve(id, 0);
        vm.expectRevert(KeptBond.AlreadyResolved.selector);
        bonds.resolve(id, 0);
    }

    function test_noBondAfterTheDeadline() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        vm.warp(uint256(deadline) + 1);
        vm.prank(team);
        vm.expectRevert(KeptBond.TooLate.selector);
        bonds.bond{value: 1 ether}(id, 0);
    }

    function test_leftoverIsSweptAfterThirtyDays() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        _bond(id, team, 1 ether);
        _break(id);
        bonds.resolve(id, 0);
        vm.expectRevert(KeptBond.AuctionStillOpen.selector);
        bonds.sweep(id, 0);
        vm.warp(block.timestamp + 30 days + 1);
        assertEq(bonds.priceNow(id, 0), 0);
        bonds.sweep(id, 0);
        assertEq(treasury.balance, 1 ether);
        vm.expectRevert(KeptBond.ZeroAmount.selector);
        bonds.sweep(id, 0);
    }

    function test_aSellerWithoutAllowanceGetsNothing() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        _bond(id, team, 1 ether);
        _break(id);
        bonds.resolve(id, 0);
        token.mint(backer, 10 ether);
        vm.prank(backer);
        vm.expectRevert();
        bonds.sell(id, 0, 10 ether, 0);
        assertEq(address(bonds).balance, 1 ether);
    }

    function test_refundCannotBeTakenTwiceByReentering() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        GreedyBonder g = new GreedyBonder(bonds, id);
        g.post{value: 1 ether}();
        _bond(id, team, 1 ether);
        _keep(id);
        bonds.resolve(id, 0);
        g.take();
        assertFalse(g.reentered());
        assertEq(address(g).balance, 1 ether);
        assertEq(address(bonds).balance, 1 ether, "the team's bond is untouched");
    }

    // ------------------------------------------------------------------ conservation

    /// Every wei posted ends with a bonder, a seller or the leftover address, minus at most a wei
    /// of rounding per bonder.
    function testFuzz_everyWeiIsAccountedFor(uint96 a, uint96 b, uint16 shareSeed, uint32 waitSeed, uint96 sellSeed) public {
        uint256 ea = bound(a, 0.001 ether, 50 ether);
        uint256 eb = bound(b, 0.001 ether, 50 ether);
        bool scaled = shareSeed % 3 == 0;
        uint256 id = _pledge(scaled ? QuestionsV2.Kind.ValueScaled : QuestionsV2.Kind.GithubRelease);
        _bond(id, team, ea);
        _bond(id, backer, eb);
        if (scaled) {
            vm.warp(uint256(deadline) + 1);
            _deliver(id, OracleAttestation.ANSWER_UINT256, abi.encode(bound(shareSeed, 0, 12 ether)));
        } else if (shareSeed % 3 == 1) {
            _keep(id);
        } else {
            _break(id);
        }
        bonds.resolve(id, 0);
        uint256 out;
        uint256 tb = team.balance;
        vm.prank(team);
        try bonds.refund(id, 0) {} catch {}
        out += team.balance - tb;
        uint256 bb = backer.balance;
        vm.prank(backer);
        try bonds.refund(id, 0) {} catch {}
        out += backer.balance - bb;

        vm.warp(block.timestamp + bound(waitSeed, 0, 40 hours));
        uint256 hb = holder.balance;
        vm.prank(holder);
        try bonds.sell(id, 0, bound(sellSeed, 1, 1_000_000 ether), 0) {} catch {}
        out += holder.balance - hb;
        vm.warp(block.timestamp + 31 days);
        try bonds.sweep(id, 0) {} catch {}
        out += treasury.balance;

        assertLe(out, ea + eb, "never pays out more than was posted");
        assertLe(ea + eb - out, 2, "at most a wei of rounding per bonder stays behind");
        assertEq(address(bonds).balance, ea + eb - out);
    }
}
