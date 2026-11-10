// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVaultV2} from "../../src/v2/KeptVaultV2.sol";
import {KeptQuestionsV2} from "../../src/v2/KeptQuestionsV2.sol";
import {QuestionsV2} from "../../src/v2/QuestionsV2.sol";
import {OracleAttestation} from "../../src/OracleAttestation.sol";
import {TestIntake} from "../../src/testnet/TestIntake.sol";
import {TestIMD} from "../../src/testnet/TestIMD.sol";
import {FeeToken} from "../mocks/FeeToken.sol";

/// The testnet kit end to end: KeptVaultV2, unchanged, on the test Intake and test IMD.
contract TestnetKitTest is Test {
    bytes32 constant ACTION = 0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000;
    uint256 constant ORACLE_KEY = 0x0A11CE;
    address operator = makeAddr("operator");
    address team = makeAddr("team");
    address stranger = makeAddr("stranger");
    TestIMD imd;
    TestIntake intake;
    KeptVaultV2 vault;
    FeeToken token;

    function setUp() public {
        vm.chainId(46630);
        vm.warp(1_800_000_000);
        imd = new TestIMD();
        intake = new TestIntake(operator, operator, 0.5 ether);
        KeptQuestionsV2 builder = new KeptQuestionsV2();
        vault = new KeptVaultV2(operator, address(intake), address(imd), ACTION, vm.addr(ORACLE_KEY), 9, 7, address(builder));
        token = new FeeToken(false);
        token.mint(team, 1_000 ether);
        vm.startPrank(team);
        imd.faucet();
        imd.approve(address(vault), type(uint256).max);
        token.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    function _pledge(QuestionsV2.Kind kind) internal returns (uint256 id) {
        KeptVaultV2.MilestoneInput[] memory ms = new KeptVaultV2.MilestoneInput[](1);
        ms[0].kind = kind;
        ms[0].deadline = uint64(block.timestamp + 7 days);
        ms[0].amount = 100 ether;
        ms[0].title = "Test milestone";
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
        id = vault.createPledge(IERC20(address(token)), team, "VibeVibe test pledge", ms, 5 ether);
    }

    function _attestation(uint256 id, uint8 answerType, bytes memory answer) internal view returns (OracleAttestation.Attestation memory a) {
        QuestionsV2.Spec memory spec = vault.milestoneSpec(id, 0);
        (,,,,,,,, uint64 askedAt) = vault.milestone(id, 0);
        a.requestId = keccak256(abi.encode("test", id, askedAt));
        a.chainId = spec.kind == QuestionsV2.Kind.GithubRelease ? block.chainid : spec.chainId;
        a.questionHash = keccak256("q");
        a.answerType = answerType;
        a.answer = answer;
        a.panelSize = 9;
        a.quorum = 7;
        a.agreed = 9;
        a.issuedAt = uint64(block.timestamp);
        a.expiresAt = a.issuedAt + 1 days;
    }

    function _sign(OracleAttestation.Attestation memory a, uint256 key) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, this.digest(a));
        return abi.encodePacked(r, s, v);
    }

    function digest(OracleAttestation.Attestation calldata a) external view returns (bytes32) {
        return vault.attestationDigest(a);
    }

    function test_checkPaysTheTestIntakeAndEmitsTheRequest() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        assertEq(id, 1001);
        vm.recordLogs();
        vm.prank(team);
        bytes32 rid = vault.check(id, 0);
        assertEq(imd.balanceOf(operator), 0.5 ether, "paid to the treasury");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool seen;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(intake) || logs[i].topics[1] != rid) continue;
            (bytes memory body,,,,) = abi.decode(logs[i].data, (bytes, address, bytes4, address, uint256));
            assertEq(string(body), vault.questionOf(id, 0));
            seen = true;
        }
        assertTrue(seen);
    }

    function test_onlyTheOperatorDeliversOnce() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        vm.prank(team);
        bytes32 rid = vault.check(id, 0);
        OracleAttestation.Attestation memory a = _attestation(id, 0, abi.encode(true));
        bytes memory sig = _sign(a, ORACLE_KEY);
        vm.prank(stranger);
        vm.expectRevert(TestIntake.NotOperator.selector);
        intake.deliver(rid, a, sig);
        vm.prank(operator);
        (bool ok,) = intake.deliver(rid, a, sig);
        assertTrue(ok);
        (,,,, KeptVaultV2.Outcome outcome,,,,) = vault.milestone(id, 0);
        assertEq(uint8(outcome), 1);
        vm.prank(operator);
        vm.expectRevert(TestIntake.UnknownRequest.selector);
        intake.deliver(rid, a, sig);
    }

    function test_aWronglySignedVerdictIsRefusedAndTheRequestStaysOpen() public {
        uint256 id = _pledge(QuestionsV2.Kind.GithubRelease);
        vm.prank(team);
        bytes32 rid = vault.check(id, 0);
        OracleAttestation.Attestation memory a = _attestation(id, 0, abi.encode(true));
        vm.startPrank(operator);
        (bool ok,) = intake.deliver(rid, a, _sign(a, 0xBAD));
        assertFalse(ok, "only the vault's oracle signer counts");
        (,,,, KeptVaultV2.Outcome outcome,,,,) = vault.milestone(id, 0);
        assertEq(uint8(outcome), 0);
        (ok,) = intake.deliver(rid, a, _sign(a, ORACLE_KEY));
        assertTrue(ok, "a corrected verdict can follow");
        vm.stopPrank();
    }

    function test_partialCreditThroughTheTestIntake() public {
        uint256 id = _pledge(QuestionsV2.Kind.ValueScaled);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(team);
        bytes32 rid = vault.check(id, 0);
        OracleAttestation.Attestation memory a = _attestation(id, OracleAttestation.ANSWER_UINT256, abi.encode(uint256(4 ether)));
        bytes memory sig = _sign(a, ORACLE_KEY);
        vm.prank(operator);
        (bool ok,) = intake.deliver(rid, a, sig);
        assertTrue(ok);
        vault.settle(id, 0);
        assertEq(token.balanceOf(team), 900 ether + 40 ether, "40% of 100 back to the team");
        assertEq(token.balanceOf(vault.BURN()), 60 ether);
    }

    function test_faucetOncePerDay() public {
        vm.startPrank(stranger);
        imd.faucet();
        assertEq(imd.balanceOf(stranger), 100 ether);
        vm.expectRevert(abi.encodeWithSelector(TestIMD.TooSoon.selector, block.timestamp + 1 days));
        imd.faucet();
        vm.warp(block.timestamp + 1 days);
        imd.faucet();
        assertEq(imd.balanceOf(stranger), 200 ether);
        vm.stopPrank();
    }

    function test_onlyTheOperatorSetsThePrice() public {
        vm.prank(stranger);
        vm.expectRevert(TestIntake.NotOperator.selector);
        intake.setPrice(0);
        vm.prank(operator);
        intake.setPrice(1 ether);
        assertEq(intake.priceOf(ACTION, address(imd)), 1 ether);
    }
}
