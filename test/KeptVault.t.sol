// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVault} from "../src/KeptVault.sol";
import {OracleAttestation, OracleAttestationConsumer} from "../src/OracleAttestation.sol";
import {Questions} from "../src/libraries/Questions.sol";
import {FeeToken} from "./mocks/FeeToken.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

contract KeptVaultTest is VaultFixture {
    // ---------------------------------------------------------------- creation

    function test_createPullsTokensAndBudget() public {
        uint256 id = _standard();
        (
            address c,
            address b,
            address t,
            string memory name,,
            uint8 count,
            uint8 open,
            uint128 locked,
            uint256 budget,
            uint16 ps,
            uint16 q
        ) = vault.pledge(id);
        assertEq(c, creator);
        assertEq(b, beneficiary);
        assertEq(t, address(team));
        assertEq(name, "KEPT roadmap");
        assertEq(count, 1);
        assertEq(open, 1);
        assertEq(locked, 100 ether);
        assertEq(budget, 10 ether);
        assertEq(ps, 9);
        assertEq(q, 7);
        assertEq(team.balanceOf(address(vault)), 100 ether);
        assertEq(imd.balanceOf(address(vault)), 10 ether);
        assertEq(vault.totalBudgets(), 10 ether);
    }

    function test_createRejectsTaxedToken() public {
        FeeToken taxed = new FeeToken(true);
        taxed.mint(creator, 1e24);
        vm.startPrank(creator);
        taxed.approve(address(vault), type(uint256).max);
        vm.expectRevert(KeptVault.TransferMismatch.selector);
        vault.createPledge(IERC20(address(taxed)), beneficiary, "x", _one(_release(T0 + 7 days, 1 ether)), 0);
        vm.stopPrank();
    }

    function test_createValidatesPledge() public {
        KeptVault.MilestoneInput[] memory none = new KeptVault.MilestoneInput[](0);
        vm.startPrank(creator);
        vm.expectRevert(KeptVault.InvalidPledge.selector);
        vault.createPledge(IERC20(address(team)), beneficiary, "x", none, 0);
        vm.expectRevert(KeptVault.InvalidPledge.selector);
        vault.createPledge(IERC20(address(team)), address(0), "x", _one(_release(T0 + 7 days, 1)), 0);
        vm.expectRevert(KeptVault.InvalidPledge.selector);
        vault.createPledge(IERC20(address(team)), beneficiary, "", _one(_release(T0 + 7 days, 1)), 0);
        KeptVault.MilestoneInput[] memory nine = new KeptVault.MilestoneInput[](9);
        for (uint256 i; i < 9; ++i) {
            nine[i] = _release(T0 + 7 days, 1);
        }
        vm.expectRevert(KeptVault.InvalidPledge.selector);
        vault.createPledge(IERC20(address(team)), beneficiary, "x", nine, 0);
        vm.stopPrank();
    }

    function test_createValidatesMilestones() public {
        vm.startPrank(creator);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.InvalidMilestone.selector, 0));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(_release(T0 + 7 days, 0)), 0);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.InvalidMilestone.selector, 0));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(_release(T0 + 59 minutes, 1)), 0);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.InvalidMilestone.selector, 0));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(_release(T0 + 4 * 365 days, 1)), 0);
        KeptVault.MilestoneInput memory untitled = _release(T0 + 7 days, 1);
        untitled.title = "";
        vm.expectRevert(abi.encodeWithSelector(KeptVault.InvalidMilestone.selector, 0));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(untitled), 0);
        vm.stopPrank();
    }

    function test_createRejectsBadQuestionStrings() public {
        string[6] memory badRepos = ["noslash", "/name", "owner/", "a/b/c", "own er/x", "owner/.hidden"];
        for (uint256 i; i < badRepos.length; ++i) {
            KeptVault.MilestoneInput memory m = _release(T0 + 7 days, 1);
            m.a = badRepos[i];
            vm.prank(creator);
            vm.expectRevert(abi.encodeWithSelector(Questions.BadParameter.selector, 0));
            vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(m), 0);
        }
        string[4] memory badTexts = ["say \"true\"", "it's", "back\\slash", " padded"];
        for (uint256 i; i < badTexts.length; ++i) {
            KeptVault.MilestoneInput memory m = _page(T0 + 7 days, 1);
            m.b = badTexts[i];
            vm.prank(creator);
            vm.expectRevert(abi.encodeWithSelector(Questions.BadParameter.selector, 1));
            vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(m), 0);
        }
        string[3] memory badUrls = ["http://kept.site", "https://a b.com", "https://x.com/\"q"];
        for (uint256 i; i < badUrls.length; ++i) {
            KeptVault.MilestoneInput memory m = _page(T0 + 7 days, 1);
            m.a = badUrls[i];
            vm.prank(creator);
            vm.expectRevert(abi.encodeWithSelector(Questions.BadParameter.selector, 0));
            vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(m), 0);
        }
        KeptVault.MilestoneInput memory wrongChain = _deployed(T0 + 7 days, 1, 10, address(0xBEEF));
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(Questions.UnsupportedChain.selector, 10));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(wrongChain), 0);
        KeptVault.MilestoneInput memory badCall = _value(T0 + 7 days, 1, address(0xBEEF), 1);
        badCall.a = "balanceOf(address)";
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(Questions.BadParameter.selector, 0));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(badCall), 0);
    }

    // ---------------------------------------------------------------- questions

    function test_questionBodies() public view {
        uint64 deadline = 1_793_318_400; // 2026-10-30T00:00:00Z
        assertEq(
            vault.previewQuestion(_release(deadline, 1)),
            string.concat(
                '{"v":1,"question":"KEPT milestone check. Does the public GitHub repository https://github.com/kept-labs/app',
                " have a published GitHub Release (not a draft, not only a git tag) whose tag name is exactly 'v1.0.0',",
                " published at or before 2026-10-30T00:00:00Z? Answer true only if such a release exists and meets every",
                ' condition; otherwise answer false.","chainId":4663,"window":{"hours":1},"answerType":"bool",',
                '"evidence":"panel","panelSize":9,"quorum":7,"validForSeconds":86400}'
            )
        );
        assertEq(
            vault.previewQuestion(_deployed(deadline, 1, 8453, 0x1397434cd35e8a9C8aC312A61D3A285EB31dea56)),
            string.concat(
                '{"v":1,"question":"KEPT milestone check. On chain id 8453, does the address ',
                "0x1397434cd35e8a9c8ac312a61d3a285eb31dea56 have deployed contract bytecode (code size greater than zero)",
                " at the window's closing block? Answer true or false.\",\"chainId\":8453,\"window\":{\"hours\":1},",
                '"answerType":"bool","evidence":"chain","panelSize":9,"quorum":7,"validForSeconds":86400}'
            )
        );
    }

    function test_isoDate() public pure {
        assertEq(Questions.isoDate(0), "1970-01-01T00:00:00Z");
        assertEq(Questions.isoDate(951_782_400), "2000-02-29T00:00:00Z");
        assertEq(Questions.isoDate(1_709_164_800), "2024-02-29T00:00:00Z");
        assertEq(Questions.isoDate(1_791_000_000), "2026-10-03T04:00:00Z");
        assertEq(Questions.isoDate(4_102_444_799), "2099-12-31T23:59:59Z");
    }

    function test_questionOfMatchesPreview() public {
        KeptVault.MilestoneInput memory m = _page(T0 + 7 days, 1 ether);
        uint256 id = _create(_one(m), 0);
        assertEq(vault.questionOf(id, 0), vault.previewQuestion(m));
    }

    // ---------------------------------------------------------------- checks

    function test_checkPaysIntakeFromBudget() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        assertTrue(rid != bytes32(0));
        assertEq(imd.balanceOf(treasury), PRICE);
        assertEq(_budget(id), 10 ether - PRICE);
        assertEq(vault.totalBudgets(), 10 ether - PRICE);
        assertEq(imd.allowance(address(vault), address(intake)), 0);
        assertEq(string(intake.lastBody()), vault.questionOf(id, 0));
    }

    function test_onlyTeamChecksBeforeDeadline() public {
        uint256 id = _standard();
        vm.prank(stranger);
        vm.expectRevert(KeptVault.NotAllowed.selector);
        vault.check(id, 0);
        _check(id, 0, beneficiary);
    }

    function test_onlyTeamChecksEvenAfterDeadline() public {
        uint256 id = _standard();
        vm.warp(T0 + 7 days);
        vm.prank(stranger);
        vm.expectRevert(KeptVault.NotAllowed.selector);
        vault.check(id, 0);
        _check(id, 0, beneficiary);
        vm.warp(T0 + 8 days);
        vault.clearStale(id, 0);
        vm.warp(T0 + 10 days + 1);
        vm.prank(creator);
        vm.expectRevert(KeptVault.CheckWindowClosed.selector);
        vault.check(id, 0);
    }

    function test_oneCheckInFlight() public {
        uint256 id = _standard();
        _check(id, 0, creator);
        vm.prank(creator);
        vm.expectRevert(KeptVault.CheckInFlight.selector);
        vault.check(id, 0);
    }

    function test_staleCheckRetriesAndAttemptsCap() public {
        uint256 id = _standard();
        _check(id, 0, creator);
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.clearStale(id, 0);
        vm.warp(T0 + 1 days);
        _check(id, 0, creator); // clears the stale one itself
        vm.warp(T0 + 2 days);
        _check(id, 0, creator);
        vm.warp(T0 + 3 days);
        vm.prank(creator);
        vm.expectRevert(KeptVault.AttemptsExhausted.selector);
        vault.check(id, 0);
    }

    function test_checkNeedsBudget() public {
        uint256 id = _create(_one(_release(T0 + 7 days, 1 ether)), 0.4 ether);
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.InsufficientBudget.selector, 0.4 ether, PRICE));
        vault.check(id, 0);
        vm.prank(stranger);
        vault.fund(id, 0.1 ether);
        _check(id, 0, creator);
    }

    function test_checkRejectsIntakeThatDoesNotPull() public {
        uint256 id = _standard();
        intake.setSkipPull(true);
        vm.prank(creator);
        vm.expectRevert(KeptVault.TransferMismatch.selector);
        vault.check(id, 0);
    }

    function test_checkRejectsRepeatedRequestId() public {
        uint256 id = _create(_one(_release(T0 + 7 days, 1 ether)), 10 ether);
        uint256 id2 = _create(_one(_release(T0 + 7 days, 1 ether)), 10 ether);
        _check(id, 0, creator);
        intake.setRepeatId(true);
        vm.prank(creator);
        vm.expectRevert(KeptVault.UnknownRequest.selector);
        vault.check(id2, 0);
    }

    // ---------------------------------------------------------------- verdicts

    function test_keptPaysBeneficiaryAndReturnsBudget() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        uint256 gas = _deliver(id, 0, rid, true);
        assertLt(gas, 120_000, "callback must fit the Intake's 200k gas");
        (KeptVault.Outcome o, bool settled) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
        assertFalse(settled);

        vm.prank(stranger);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 100 ether);
        assertEq(team.balanceOf(address(vault)), 0);
        vm.prank(stranger);
        vault.withdrawBudget(id);
        assertEq(imd.balanceOf(creator), 1_000 ether - PRICE, "unused budget returned to the creator");
        assertEq(vault.totalBudgets(), 0);
    }

    function test_keptRebatesFromRefereeFund() public {
        vm.prank(stranger);
        vault.fundReferee(2 ether);
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        uint256 gas = _deliver(id, 0, rid, true);
        assertLt(gas, 150_000, "heaviest callback path (kept + rebate) must fit the Intake's 200k gas");
        assertEq(vault.refereeFund(), 2 ether - PRICE);
        assertEq(_budget(id), 10 ether);
        vault.settle(id, 0);
        vault.withdrawBudget(id);
        assertEq(imd.balanceOf(creator), 1_000 ether, "a kept promise cost nothing");
    }

    function test_noRebateWhenFundIsShort() public {
        vm.prank(stranger);
        vault.fundReferee(0.1 ether);
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        _deliver(id, 0, rid, true);
        assertEq(vault.refereeFund(), 0.1 ether);
        assertEq(_budget(id), 10 ether - PRICE);
    }

    function test_falseVerdictKeepsMilestoneOpen() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        _deliver(id, 0, rid, false);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Open));
        bytes32 again = _check(id, 0, creator);
        _deliver(id, 0, again, true);
        (o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
    }

    function test_unprovenMilestoneBurns() public {
        uint256 id = _standard();
        vm.warp(T0 + 7 days + 3 days);
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.settle(id, 0);
        vm.warp(T0 + 7 days + 3 days + 1);
        vm.prank(stranger);
        vault.settle(id, 0);
        (KeptVault.Outcome o, bool settled) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Broken));
        assertTrue(settled);
        assertEq(team.balanceOf(vault.BURN()), 100 ether);
        assertEq(team.balanceOf(beneficiary), 0);
        vault.withdrawBudget(id);
        assertEq(imd.balanceOf(creator), 1_000 ether, "budget returned, no check was bought");
    }

    function test_settleWaitsForCheckInFlight() public {
        uint256 id = _standard();
        vm.warp(T0 + 7 days + 3 days);
        bytes32 rid = _check(id, 0, beneficiary);
        vm.warp(T0 + 7 days + 3 days + 2);
        vm.expectRevert(KeptVault.CheckInFlight.selector);
        vault.settle(id, 0);
        _deliver(id, 0, rid, true);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 100 ether);
    }

    function test_settleBurnsAfterStaleLastCheck() public {
        uint256 id = _standard();
        vm.warp(T0 + 7 days + 3 days);
        bytes32 rid = _check(id, 0, beneficiary);
        vm.warp(T0 + 7 days + 4 days);
        vault.settle(id, 0);
        assertEq(team.balanceOf(vault.BURN()), 100 ether);
        // The late answer cannot resurrect the milestone.
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        (bool ok,,) = intake.deliver(rid, a, _sign(a, signerKey));
        assertFalse(ok);
    }

    function test_settleTwiceReverts() public {
        uint256 id = _standard();
        vm.warp(T0 + 11 days);
        vault.settle(id, 0);
        vm.expectRevert(KeptVault.AlreadySettled.selector);
        vault.settle(id, 0);
    }

    function test_multiMilestoneMixedOutcomes() public {
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](3);
        ms[0] = _release(T0 + 2 days, 10 ether);
        ms[1] = _page(T0 + 4 days, 20 ether);
        ms[2] = _value(T0 + 6 days, 30 ether, address(team), 1);
        uint256 id = _create(ms, 5 ether);

        bytes32 r0 = _check(id, 0, creator);
        _deliver(id, 0, r0, true);
        vault.settle(id, 0);

        vm.warp(T0 + 4 days);
        bytes32 r1 = _check(id, 1, creator);
        _deliver(id, 1, r1, false);

        vm.warp(T0 + 6 days);
        bytes32 r2 = _check(id, 2, beneficiary);
        _deliver(id, 2, r2, true);
        vault.settle(id, 2);

        vm.warp(T0 + 7 days + 1);
        vault.settle(id, 1);

        assertEq(team.balanceOf(beneficiary), 40 ether);
        assertEq(team.balanceOf(vault.BURN()), 20 ether);
        assertEq(team.balanceOf(address(vault)), 0);
        vault.withdrawBudget(id);
        assertEq(imd.balanceOf(creator), 1_000 ether - 3 * PRICE);
        (,,,,,, uint8 open, uint128 locked, uint256 budget,,) = vault.pledge(id);
        assertEq(open, 0);
        assertEq(locked, 0);
        assertEq(budget, 0);
    }

    // ---------------------------------------------------------------- callback guards

    function test_callbackOnlyFromIntake() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory sig = _sign(a, signerKey);
        vm.prank(stranger);
        vm.expectRevert(KeptVault.OnlyIntake.selector);
        vault.onOracleResult(rid, a, sig);
    }

    function test_callbackRejectsUnknownRequest() public {
        uint256 id = _standard();
        _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory sig = _sign(a, signerKey);
        vm.prank(address(intake));
        vm.expectRevert(KeptVault.UnknownRequest.selector);
        vault.onOracleResult(keccak256("nope"), a, sig);
    }

    function test_callbackRejectsWrongSigner() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory sig = _sign(a, 0xB0B);
        vm.prank(address(intake));
        vm.expectRevert(OracleAttestationConsumer.BadSignature.selector);
        vault.onOracleResult(rid, a, sig);
    }

    function test_callbackRejectsWeakOrMismatchedAttestations() public {
        uint256 id = _create(_one(_deployed(T0 + 7 days, 1 ether, 8453, address(0xBEEF))), 10 ether);
        bytes32 rid = _check(id, 0, creator);
        for (uint256 i; i < 7; ++i) {
            OracleAttestation.Attestation memory a = _attestation(id, 0, true);
            if (i == 0) a.chainId = 4663; // question was about Base
            if (i == 1) a.panelSize = 8;
            if (i == 2) a.quorum = 6;
            if (i == 3) a.answer = abi.encode(true, true);
            if (i == 4) a.issuedAt = uint64(block.timestamp - 1);
            if (i == 5) a.agreed = 10;
            if (i == 6) a.quorum = 10;
            bytes memory sig = _sign(a, signerKey);
            vm.prank(address(intake));
            vm.expectRevert(KeptVault.InvalidAttestation.selector);
            vault.onOracleResult(rid, a, sig);
        }
    }

    function test_panelEvidenceNeedsQuorumAgreement() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        a.agreed = 6;
        bytes memory sig = _sign(a, signerKey);
        vm.prank(address(intake));
        vm.expectRevert(KeptVault.InvalidAttestation.selector);
        vault.onOracleResult(rid, a, sig);
    }

    /// @dev Real case: Robinhood request 2cbdce1f (8 Oct 2026) was signed with agreed 139 < quorum 140,
    /// settled by the deployer's rerun of a chain recipe. KEPT must accept that for chain templates.
    function test_chainEvidenceAcceptsDeployerSettledVerdict() public {
        uint256 id = _create(_one(_deployed(T0 + 7 days, 1 ether, 8453, address(0xBEEF))), 10 ether);
        bytes32 rid = _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        a.agreed = 6;
        bytes memory sig = _sign(a, signerKey);
        vm.prank(address(intake));
        vault.onOracleResult(rid, a, sig);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
    }

    function test_callbackRejectsWrongAnswerType() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        a.answerType = OracleAttestation.ANSWER_UINT256;
        bytes memory sig = _sign(a, signerKey);
        vm.prank(address(intake));
        vm.expectRevert(
            abi.encodeWithSelector(
                OracleAttestationConsumer.WrongAnswerType.selector,
                OracleAttestation.ANSWER_BOOL,
                OracleAttestation.ANSWER_UINT256
            )
        );
        vault.onOracleResult(rid, a, sig);
    }

    function test_callbackRejectsExpiredAttestation() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory sig = _sign(a, signerKey);
        vm.warp(a.expiresAt + 1);
        vm.prank(address(intake));
        vm.expectRevert(
            abi.encodeWithSelector(OracleAttestationConsumer.AttestationExpired.selector, a.expiresAt)
        );
        vault.onOracleResult(rid, a, sig);
    }

    function test_attestationCannotBeReplayedOnAnotherCheck() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, false);
        bytes memory sig = _sign(a, signerKey);
        intake.deliver(rid, a, sig);
        bytes32 rid2 = _check(id, 0, creator);
        (bool ok,, bytes memory reason) = intake.deliver(rid2, a, sig);
        assertFalse(ok);
        assertEq(
            reason, abi.encodeWithSelector(OracleAttestationConsumer.AlreadyConsumed.selector, a.requestId)
        );
    }

    function test_withdrawBudgetOnlyWhenFinished() public {
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](2);
        ms[0] = _release(T0 + 2 days, 1 ether);
        ms[1] = _release(T0 + 4 days, 1 ether);
        uint256 id = _create(ms, 2 ether);
        vm.expectRevert(KeptVault.NotOpen.selector);
        vault.withdrawBudget(id);
        vm.warp(T0 + 7 days + 1);
        vault.settle(id, 0);
        vm.expectRevert(KeptVault.NotOpen.selector);
        vault.withdrawBudget(id);
        vault.settle(id, 1);
        vm.prank(stranger);
        assertEq(vault.withdrawBudget(id), 2 ether);
        assertEq(imd.balanceOf(creator), 1_000 ether);
        assertEq(imd.balanceOf(stranger), 1_000 ether, "the caller gets nothing");
        vm.expectRevert(KeptVault.NothingPending.selector);
        vault.withdrawBudget(id);
    }

    function test_signerRotationDoesNotStrandChecksInFlight() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        vm.prank(owner);
        vault.proposeProtocol(address(intake), ACTION, vm.addr(0xB0B));
        vm.warp(T0 + 7 days);
        vault.executeProtocol();
        assertEq(vault.oracleSigner(), vm.addr(0xB0B));
        // The answer to the old check is signed by the signer it was asked under.
        _deliver(id, 0, rid, true);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
    }

    function test_newChecksUseTheRotatedSigner() public {
        uint256 id = _create(_one(_release(T0 + 20 days, 1 ether)), 5 ether);
        vm.prank(owner);
        vault.proposeProtocol(address(intake), ACTION, vm.addr(0xB0B));
        vm.warp(T0 + 7 days);
        vault.executeProtocol();
        bytes32 rid = _check(id, 0, creator);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory oldSig = _sign(a, signerKey);
        vm.prank(address(intake));
        vm.expectRevert(OracleAttestationConsumer.BadSignature.selector);
        vault.onOracleResult(rid, a, oldSig);
        bytes memory newSig = _sign(a, 0xB0B);
        vm.prank(address(intake));
        vault.onOracleResult(rid, a, newSig);
    }

    function test_checkOpenReportsBudget() public {
        uint256 id = _create(_one(_release(T0 + 7 days, 1 ether)), 0.4 ether);
        (bool open, bool funded) = vault.checkOpen(id, 0);
        assertTrue(open);
        assertFalse(funded);
        vm.prank(stranger);
        vault.fund(id, 0.1 ether);
        (open, funded) = vault.checkOpen(id, 0);
        assertTrue(open && funded);
    }

    function test_valueTemplateRejectsZeroThreshold() public {
        KeptVault.MilestoneInput memory m = _value(T0 + 7 days, 1, address(0xBEEF), 0);
        vm.prank(creator);
        vm.expectRevert(abi.encodeWithSelector(Questions.BadParameter.selector, 3));
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(m), 0);
    }

    // ---------------------------------------------------------------- admin

    function test_protocolChangeWaitsSevenDays() public {
        address newIntake = makeAddr("intake2");
        address newSigner = makeAddr("signer2");
        vm.prank(stranger);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.proposeProtocol(newIntake, ACTION, newSigner);

        vm.prank(owner);
        vault.proposeProtocol(newIntake, ACTION, newSigner);
        vm.warp(T0 + 7 days - 1);
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.executeProtocol();
        vm.warp(T0 + 7 days);
        vault.executeProtocol();
        assertEq(address(vault.intake()), newIntake);
        assertEq(vault.oracleSigner(), newSigner);
    }

    function test_inFlightCheckStaysBoundToItsIntake() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, creator);
        vm.prank(owner);
        vault.proposeProtocol(makeAddr("intake2"), ACTION, signer);
        vm.warp(T0 + 7 days);
        vault.executeProtocol();
        // The old intake can still deliver what it took.
        _deliver(id, 0, rid, true);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
    }

    function test_panelChangeOnlyAffectsNewPledges() public {
        uint256 id = _standard();
        vm.prank(owner);
        vault.setPanel(15, 11);
        (,,,,,,,,, uint16 ps, uint16 q) = vault.pledge(id);
        assertEq(ps, 9);
        assertEq(q, 7);
        uint256 id2 = _standard();
        (,,,,,,,,, ps, q) = vault.pledge(id2);
        assertEq(ps, 15);
        assertEq(q, 11);
        vm.prank(owner);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        vault.setPanel(9, 4);
    }

    function test_ownerHasNoPathToLockedTokens() public {
        uint256 id = _standard();
        vm.startPrank(owner);
        vm.expectRevert(KeptVault.NotAllowed.selector);
        vault.check(id, 0);
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.settle(id, 0);
        vault.setOwner(address(0));
        vm.stopPrank();
        assertEq(vault.owner(), address(0));
        assertEq(team.balanceOf(address(vault)), 100 ether);
    }
}
