// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVault} from "../../src/KeptVault.sol";
import {OracleAttestation} from "../../src/OracleAttestation.sol";
import {Questions} from "../../src/libraries/Questions.sol";
import {MockIntake} from "../mocks/MockIntake.sol";
import {FeeToken} from "../mocks/FeeToken.sol";

abstract contract VaultFixture is Test {
    bytes32 internal constant ACTION = 0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000;
    uint256 internal constant PRICE = 0.5 ether;
    uint64 internal constant T0 = 1_791_000_000; // 2026-10-03T04:00:00Z

    KeptVault internal vault;
    MockIntake internal intake;
    FeeToken internal imd;
    FeeToken internal team;

    uint256 internal signerKey = 0xA11CE;
    address internal signer;
    address internal owner = makeAddr("owner");
    address internal creator = makeAddr("creator");
    address internal beneficiary = makeAddr("beneficiary");
    address internal stranger = makeAddr("stranger");
    address internal treasury = makeAddr("treasury");

    uint256 internal nonce;

    function setUp() public virtual {
        vm.warp(T0);
        signer = vm.addr(signerKey);
        imd = new FeeToken(false);
        team = new FeeToken(false);
        intake = new MockIntake(treasury);
        vault = new KeptVault(owner, address(intake), address(imd), ACTION, signer, 9, 7);

        team.mint(creator, 1e27);
        imd.mint(creator, 1_000 ether);
        imd.mint(stranger, 1_000 ether);
        vm.startPrank(creator);
        team.approve(address(vault), type(uint256).max);
        imd.approve(address(vault), type(uint256).max);
        vm.stopPrank();
        vm.prank(stranger);
        imd.approve(address(vault), type(uint256).max);
    }

    // ---------------------------------------------------------------- builders

    function _release(uint64 deadline, uint128 amount)
        internal
        pure
        returns (KeptVault.MilestoneInput memory m)
    {
        m.kind = Questions.Kind.GithubRelease;
        m.deadline = deadline;
        m.amount = amount;
        m.title = "Ship v1 of the app";
        m.a = "kept-labs/app";
        m.b = "v1.0.0";
    }

    function _page(uint64 deadline, uint128 amount)
        internal
        pure
        returns (KeptVault.MilestoneInput memory m)
    {
        m.kind = Questions.Kind.PageContains;
        m.deadline = deadline;
        m.amount = amount;
        m.title = "Website is live";
        m.a = "https://kept.site.identitymd.eth.limo/";
        m.b = "Promises the swarm enforces";
    }

    function _deployed(uint64 deadline, uint128 amount, uint64 chainId, address target)
        internal
        pure
        returns (KeptVault.MilestoneInput memory m)
    {
        m.kind = Questions.Kind.ContractDeployed;
        m.deadline = deadline;
        m.amount = amount;
        m.chainId = chainId;
        m.target = target;
        m.title = "V2 contract deployed";
    }

    function _value(uint64 deadline, uint128 amount, address target, uint256 threshold)
        internal
        pure
        returns (KeptVault.MilestoneInput memory m)
    {
        m.kind = Questions.Kind.ValueAtLeast;
        m.deadline = deadline;
        m.amount = amount;
        m.chainId = 4663;
        m.target = target;
        m.threshold = threshold;
        m.a = "totalSupply()";
        m.title = "One million supply burned";
    }

    function _one(KeptVault.MilestoneInput memory m)
        internal
        pure
        returns (KeptVault.MilestoneInput[] memory ms)
    {
        ms = new KeptVault.MilestoneInput[](1);
        ms[0] = m;
    }

    function _create(KeptVault.MilestoneInput[] memory ms, uint256 budget) internal returns (uint256 id) {
        vm.prank(creator);
        id = vault.createPledge(IERC20(address(team)), beneficiary, "KEPT roadmap", ms, budget);
    }

    function _standard() internal returns (uint256 id) {
        id = _create(_one(_release(T0 + 7 days, 100 ether)), 10 ether);
    }

    // ---------------------------------------------------------------- oracle

    function _attestation(uint256 pledgeId, uint8 index, bool answer)
        internal
        returns (OracleAttestation.Attestation memory a)
    {
        Questions.Spec memory spec = vault.milestoneSpec(pledgeId, index);
        (,,,,,,,, uint64 askedAt) = vault.milestone(pledgeId, index);
        a.requestId = bytes32(++nonce);
        a.chainId = Questions.questionChain(spec);
        a.questionHash = keccak256("question");
        a.answerType = OracleAttestation.ANSWER_BOOL;
        a.answer = abi.encode(answer);
        a.fromBlock = 1;
        a.toBlock = 2;
        a.blockHash = keccak256("block");
        a.panelJobId = keccak256("panel");
        a.panelSize = 9;
        a.quorum = 7;
        a.agreed = 8;
        a.issuedAt = askedAt > block.timestamp ? askedAt : uint64(block.timestamp);
        a.expiresAt = a.issuedAt + 1 days;
    }

    function _sign(OracleAttestation.Attestation memory a, uint256 key) internal view returns (bytes memory) {
        bytes32 digest = this.digestOf(a);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function digestOf(OracleAttestation.Attestation calldata a) external view returns (bytes32) {
        return vault.attestationDigest(a);
    }

    function _check(uint256 pledgeId, uint8 index, address who) internal returns (bytes32 requestId) {
        vm.prank(who);
        requestId = vault.check(pledgeId, index);
    }

    /// @dev Delivers a signed verdict through the mock Intake and requires the callback to succeed.
    function _deliver(uint256 pledgeId, uint8 index, bytes32 requestId, bool answer)
        internal
        returns (uint256 gas)
    {
        OracleAttestation.Attestation memory a = _attestation(pledgeId, index, answer);
        (bool ok, uint256 used, bytes memory reason) = intake.deliver(requestId, a, _sign(a, signerKey));
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(reason, 32), mload(reason))
            }
        }
        gas = used;
    }

    function _outcome(uint256 pledgeId, uint8 index)
        internal
        view
        returns (KeptVault.Outcome o, bool settled)
    {
        (,,,, o, settled,,,) = vault.milestone(pledgeId, index);
    }

    function _budget(uint256 pledgeId) internal view returns (uint256 b) {
        (,,,,,,,, b,,) = vault.pledge(pledgeId);
    }
}
