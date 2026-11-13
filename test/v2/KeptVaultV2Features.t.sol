// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVaultV2 as KeptVault} from "../../src/v2/KeptVaultV2.sol";
import {OracleAttestation} from "../../src/OracleAttestation.sol";
import {QuestionsV2 as Questions} from "../../src/v2/QuestionsV2.sol";
import {VaultFixtureV2 as VaultFixture} from "./VaultFixtureV2.sol";

/// @notice What v2 adds (docs/VAULT_V2.md): partial credit, chain checks after the deadline, appeals,
/// and pledge numbers from 1001.
contract KeptVaultV2FeaturesTest is VaultFixture {
    uint64 internal constant DEADLINE = T0 + 7 days;
    uint128 internal constant AMOUNT = 150 ether;

    // ---------------------------------------------------------------- builders

    /// The KEPT milestone 3 shape: the hook's collected() from 0 (nothing) to 5 IMD (all of it).
    function _scaled(uint256 floor, uint256 target) internal view returns (KeptVault.MilestoneInput memory m) {
        m = _value(DEADLINE, AMOUNT, address(team), target);
        m.kind = Questions.Kind.ValueScaled;
        m.floor = floor;
        m.a = "collected()";
        m.title = "KEPT pool earns 5 IMD";
    }

    function _uintVerdict(uint256 id, uint8 index, bytes32 rid, uint256 value) internal {
        OracleAttestation.Attestation memory a = _attestation(id, index, true);
        a.answerType = OracleAttestation.ANSWER_UINT256;
        a.answer = abi.encode(value);
        (bool ok,, bytes memory reason) = intake.deliver(rid, a, _sign(a, signerKey));
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(reason, 32), mload(reason))
            }
        }
    }

    function _panelVerdict(uint256 id, uint8 index, bytes32 rid, bool answer, uint16 panel, uint16 quorum)
        internal
        returns (bool ok, bytes memory reason)
    {
        OracleAttestation.Attestation memory a = _attestation(id, index, answer);
        a.panelSize = panel;
        a.quorum = quorum;
        a.agreed = quorum;
        (ok,, reason) = intake.deliver(rid, a, _sign(a, signerKey));
    }

    function _share(uint256 id, uint8 index) internal view returns (uint16 share) {
        (share,,,,) = vault.milestoneV2(id, index);
    }

    // ---------------------------------------------------------------- numbering

    function test_pledgesStartAt1001() public {
        assertEq(vault.pledgeCount(), 1000);
        uint256 id = _standard();
        assertEq(id, 1001);
        assertEq(_standard(), 1002);
        assertEq(vault.pledgeCount(), 1002);
    }

    // ---------------------------------------------------------------- partial credit

    function test_scaledQuestionReadsANumberAtTheDeadline() public {
        string memory body = _preview(_scaled(0, 5 ether));
        assertEq(
            body,
            string.concat(
                '{"v":1,"question":"KEPT milestone check. On chain id 4663, call the view function collected() on the contract ',
                vm.toLowercase(vm.toString(address(team))),
                " at the last block at or before 2026-10-10T04:00:00Z. Return the uint256 it returns, in raw units.",
                ' Answer 0 if the call reverts or does not return a uint256.","chainId":4663,"window":{"hours":1},',
                '"answerType":"uint256","evidence":"chain","panelSize":9,"quorum":7,"validForSeconds":86400}'
            )
        );
    }

    function test_scaledValidation() public {
        vm.startPrank(creator);
        // the floor must sit below the target
        vm.expectRevert(abi.encodeWithSelector(Questions.BadParameter.selector, 4));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(_scaled(5 ether, 5 ether)), 0);
        // a floor means nothing on an all-or-nothing milestone
        KeptVault.MilestoneInput memory m = _value(DEADLINE, AMOUNT, address(team), 5 ether);
        m.floor = 1;
        vm.expectRevert(abi.encodeWithSelector(Questions.BadParameter.selector, 4));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(m), 0);
        KeptVault.MilestoneInput memory r = _release(DEADLINE, AMOUNT);
        r.floor = 1;
        vm.expectRevert(abi.encodeWithSelector(Questions.BadParameter.selector, 4));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(r), 0);
        vm.stopPrank();
    }

    /// On a mainnet vault, a question about a chain IMD doesn't serve (a testnet) is still refused.
    function test_mainnetVaultRefusesTestnetChainQuestions() public {
        KeptVault.MilestoneInput memory m = _scaled(0, 5 ether);
        m.chainId = 46630;
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(Questions.UnsupportedChain.selector, uint64(46630)));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(m), 0);
    }

    function test_scaledIsReadOnceAfterTheDeadline() public {
        uint256 id = _create(_one(_scaled(0, 5 ether)), 10 ether);
        (bool open,) = vault.checkOpen(id, 0);
        assertFalse(open, "a moving number is not scored early");
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.check(id, 0);
        vm.warp(DEADLINE + 1);
        (open,) = vault.checkOpen(id, 0);
        assertTrue(open);
        vm.warp(DEADLINE + vault.GRACE() + 1);
        (open,) = vault.checkOpen(id, 0);
        assertFalse(open, "closes with the grace window");
    }

    function test_partialSplitsTheTranche() public {
        uint256 id = _create(_one(_scaled(0, 5 ether)), 10 ether);
        vm.prank(stranger);
        vault.fundReferee(PRICE);
        vm.warp(DEADLINE + 1 hours);
        bytes32 rid = _check(id, 0, beneficiary);
        vm.expectEmit(true, true, false, true, address(vault));
        emit KeptVault.Scored(id, 0, bytes32(nonce + 1), 3 ether, 6000);
        _uintVerdict(id, 0, rid, 3 ether);

        (KeptVault.Outcome o, bool settled) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Partial));
        assertFalse(settled);
        assertEq(_share(id, 0), 6000);
        assertEq(vault.refereeFund(), 0, "a partial delivery still earns the rebate");

        // settles at once: the number at the deadline is final
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 90 ether);
        assertEq(team.balanceOf(vault.BURN()), 60 ether);
        (,,,,,,, uint128 locked,,,) = vault.pledge(id);
        assertEq(locked, 0);
        vm.expectRevert(KeptVault.AlreadySettled.selector);
        vault.settle(id, 0);
    }

    function test_scaledAtTargetIsKept() public {
        uint256 id = _create(_one(_scaled(0, 5 ether)), 10 ether);
        vm.warp(DEADLINE + 1 hours);
        bytes32 rid = _check(id, 0, beneficiary);
        _uintVerdict(id, 0, rid, 7 ether);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
        assertEq(_share(id, 0), 10_000);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), AMOUNT);
    }

    function test_scaledAtOrBelowFloorBurnsWithoutWaiting() public {
        uint256 id = _create(_one(_scaled(2 ether, 5 ether)), 10 ether);
        vm.warp(DEADLINE + 1 hours);
        bytes32 rid = _check(id, 0, beneficiary);
        _uintVerdict(id, 0, rid, 2 ether);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Broken));
        // no need to wait out the grace window: nothing is left to prove
        vault.settle(id, 0);
        assertEq(team.balanceOf(vault.BURN()), AMOUNT);
        assertEq(team.balanceOf(beneficiary), 0);
    }

    function test_scaledRejectsABoolAnswer() public {
        uint256 id = _create(_one(_scaled(0, 5 ether)), 10 ether);
        vm.warp(DEADLINE + 1 hours);
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true); // answerType bool
        (bool ok,,) = intake.deliver(rid, a, _sign(a, signerKey));
        assertFalse(ok);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Open));
    }

    function test_unscoredScaledBurnsAfterGrace() public {
        uint256 id = _create(_one(_scaled(0, 5 ether)), 10 ether);
        vm.warp(DEADLINE + vault.GRACE());
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.settle(id, 0);
        vm.warp(DEADLINE + vault.GRACE() + 1);
        vault.settle(id, 0);
        assertEq(team.balanceOf(vault.BURN()), AMOUNT);
    }

    /// Whatever the floor, target and value: what's paid plus what's burned is the tranche, and the
    /// paid share never exceeds what the value earned.
    function testFuzz_partialConserves(uint128 amount, uint256 floor, uint256 target, uint256 value) public {
        amount = uint128(bound(amount, 1, 1e27)); // what the test creator holds
        target = bound(target, 1, type(uint256).max);
        floor = bound(floor, 0, target - 1);
        KeptVault.MilestoneInput memory m = _scaled(floor, target);
        m.amount = amount;
        uint256 id = _create(_one(m), 10 ether);
        vm.warp(DEADLINE + 1 hours);
        bytes32 rid = _check(id, 0, beneficiary);
        _uintVerdict(id, 0, rid, value);
        uint256 burnBefore = team.balanceOf(vault.BURN());
        vault.settle(id, 0);
        uint256 paid = team.balanceOf(beneficiary);
        uint256 burned = team.balanceOf(vault.BURN()) - burnBefore;
        assertEq(paid + burned, amount);
        if (value <= floor) assertEq(paid, 0);
        if (value >= target) assertEq(paid, amount);
        assertEq(team.balanceOf(address(vault)), 0);
    }

    // ---------------------------------------------------------------- chain checks after the deadline

    function test_chainCheckAskedEarlyReadsNow() public {
        uint256 id = _create(_one(_value(DEADLINE, AMOUNT, address(team), 1 ether)), 10 ether);
        vm.warp(T0 + 1 days); // 2026-10-04T04:00:00Z
        string memory q = vault.questionOf(id, 0);
        assertTrue(_contains(q, "at the last block at or before 2026-10-04T04:00:00Z"));
        vm.warp(DEADLINE + 2 days);
        q = vault.questionOf(id, 0);
        assertTrue(_contains(q, "at the last block at or before 2026-10-10T04:00:00Z"), "after the deadline it reads the deadline");
    }

    function test_releaseAndChainCheckableInGraceButNotPages() public {
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](3);
        ms[0] = _release(DEADLINE, 1 ether);
        ms[1] = _page(DEADLINE, 1 ether);
        ms[2] = _deployed(DEADLINE, 1 ether, 4663, address(team));
        uint256 id = _create(ms, 10 ether);
        vm.warp(DEADLINE + 1 days);
        (bool r,) = vault.checkOpen(id, 0);
        (bool p,) = vault.checkOpen(id, 1);
        (bool d,) = vault.checkOpen(id, 2);
        assertTrue(r);
        assertFalse(p);
        assertTrue(d);
        (,,,, uint64 checkBy) = vault.milestoneV2(id, 1);
        assertEq(checkBy, DEADLINE);
        (,,,, checkBy) = vault.milestoneV2(id, 2);
        assertEq(checkBy, DEADLINE + vault.GRACE());
    }

    // ---------------------------------------------------------------- appeals

    function _releaseRejected() internal returns (uint256 id) {
        id = _create(_one(_release(DEADLINE, AMOUNT)), 10 ether);
        bytes32 rid = _check(id, 0, beneficiary);
        _deliver(id, 0, rid, false);
    }

    function test_appealGoesToAFifteenAgentPanel() public {
        uint256 id = _releaseRejected();
        assertTrue(vault.appealOpen(id, 0));
        uint256 cap = vault.DEFAULT_APPEAL_PRICE();
        vm.prank(beneficiary);
        bytes32 rid = vault.appeal(id, 0, cap);
        assertTrue(_contains(vault.questionOf(id, 0), '"panelSize":9'), "the stored question keeps the pledge panel");
        (,, bool appealed, bool inFlightAppeal,) = vault.milestoneV2(id, 0);
        assertTrue(appealed && inFlightAppeal);

        // the regular 9-agent panel can't answer an appeal
        (bool ok, bytes memory reason) = _panelVerdict(id, 0, rid, true, 9, 7);
        assertFalse(ok);
        assertEq(reason, abi.encodeWithSelector(KeptVault.InvalidAttestation.selector));
        (ok,) = _panelVerdict(id, 0, rid, true, 15, 10);
        assertFalse(ok, "quorum below 11");

        (ok,) = _panelVerdict(id, 0, rid, true, 15, 11);
        assertTrue(ok);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), AMOUNT);
    }

    function test_appealIsFinal() public {
        uint256 id = _releaseRejected();
        vm.prank(beneficiary);
        bytes32 rid = vault.appeal(id, 0, 1 ether);
        (bool ok,) = _panelVerdict(id, 0, rid, false, 15, 11);
        assertTrue(ok);
        assertFalse(vault.appealOpen(id, 0));
        (bool open,) = vault.checkOpen(id, 0);
        assertFalse(open, "no more regular checks after an appeal");
        vm.startPrank(beneficiary);
        vm.expectRevert(KeptVault.NotAppealable.selector);
        vault.check(id, 0);
        vm.expectRevert(KeptVault.NotAppealable.selector);
        vault.appeal(id, 0, 1 ether);
        vm.stopPrank();
        vm.warp(DEADLINE + vault.GRACE() + 1);
        vault.settle(id, 0);
        assertEq(team.balanceOf(vault.BURN()), AMOUNT);
    }

    function test_appealNeedsANoFirst() public {
        uint256 id = _create(_one(_release(DEADLINE, AMOUNT)), 10 ether);
        assertFalse(vault.appealOpen(id, 0));
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.NotAppealable.selector);
        vault.appeal(id, 0, 1 ether);
    }

    function test_noAppealOnChainQuestions() public {
        uint256 id = _create(_one(_value(DEADLINE, AMOUNT, address(team), 1 ether)), 10 ether);
        bytes32 rid = _check(id, 0, beneficiary);
        _deliver(id, 0, rid, false);
        assertFalse(vault.appealOpen(id, 0));
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.NotAppealable.selector);
        vault.appeal(id, 0, 1 ether);
    }

    function test_appealAfterAllThreeChecks() public {
        uint256 id = _create(_one(_release(DEADLINE, AMOUNT)), 10 ether);
        for (uint256 i; i < 3; ++i) {
            bytes32 r = _check(id, 0, beneficiary);
            _deliver(id, 0, r, false);
        }
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.AttemptsExhausted.selector);
        vault.check(id, 0);
        assertTrue(vault.appealOpen(id, 0), "the appeal is the fourth try");
        vm.prank(beneficiary);
        vault.appeal(id, 0, 1 ether);
        (,,,,,, uint8 attempts,,) = vault.milestone(id, 0);
        assertEq(attempts, 4);
    }

    function test_appealGuards() public {
        uint256 id = _releaseRejected();
        vm.prank(stranger);
        vm.expectRevert(KeptVault.NotAllowed.selector);
        vault.appeal(id, 0, 1 ether);
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.PriceAboveLimit.selector, PRICE, PRICE - 1));
        vault.appeal(id, 0, PRICE - 1);
        // a page's appeal closes with its deadline
        KeptVault.MilestoneInput memory pg = _page(DEADLINE, AMOUNT);
        uint256 pid = _create(_one(pg), 10 ether);
        bytes32 rid = _check(pid, 0, beneficiary);
        _deliver(pid, 0, rid, false);
        vm.warp(DEADLINE + 1);
        assertFalse(vault.appealOpen(pid, 0));
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.CheckWindowClosed.selector);
        vault.appeal(pid, 0, 1 ether);
        // a release's appeal stays open through grace
        assertTrue(vault.appealOpen(id, 0));
    }

    // ---------------------------------------------------------------- helpers

    function _contains(string memory hay, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i <= h.length - n.length; ++i) {
            bool hit = true;
            for (uint256 k; k < n.length && hit; ++k) hit = h[i + k] == n[k];
            if (hit) return true;
        }
        return false;
    }
}
