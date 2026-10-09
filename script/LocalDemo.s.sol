// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {KeptVault} from "../src/KeptVault.sol";
import {OracleAttestation} from "../src/OracleAttestation.sol";
import {Questions} from "../src/libraries/Questions.sol";
import {MockIntake} from "../test/mocks/MockIntake.sol";
import {FeeToken} from "../test/mocks/FeeToken.sol";

/// @notice Local anvil fixture for the website: a vault with a mock Intake whose "oracle" is anvil
/// key #1, and pledges in every state. Not a deployment script for any real chain.
/// stage1: deploy and create pledges; advance time 6 days 1 hour; stage2: verdicts and settlements.
contract LocalDemo is Script {
    uint256 constant DEPLOYER = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant ORACLE = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;

    function stage1() external {
        address me = vm.addr(DEPLOYER);
        vm.startBroadcast(DEPLOYER);
        FeeToken imd = new FeeToken(false);
        FeeToken team = new FeeToken(false);
        MockIntake intake = new MockIntake(address(0x7EA));
        KeptVault vault = new KeptVault(
            me, address(intake), address(imd), bytes32("oracle.request@oracle-1"), vm.addr(ORACLE), 9, 7
        );
        new PoolManager(me);
        team.approve(address(vault), type(uint256).max);
        imd.approve(address(vault), type(uint256).max);
        vault.fundReferee(3 ether);

        uint64 t = uint64(block.timestamp);
        KeptVault.MilestoneInput[] memory a = new KeptVault.MilestoneInput[](4);
        a[0] = _m(Questions.Kind.PageContains, t + 2 days, 50_000_000 ether, "Website live on IPFS");
        a[0].a = "https://kept.site.identitymd.eth.limo/";
        a[0].b = "Promises the swarm enforces";
        a[1] = _m(Questions.Kind.GithubRelease, t + 4 days, 50_000_000 ether, "Ship v1.0 of the KEPT app");
        a[1].a = "modemola/identity_md";
        a[1].b = "v1.0.0";
        a[2] = _m(Questions.Kind.ContractDeployed, t + 12 days, 50_000_000 ether, "Deploy KEPT on Base");
        a[2].chainId = 8453;
        a[2].target = address(0xBA5E);
        a[3] = _m(Questions.Kind.ValueAtLeast, t + 30 days, 50_000_000 ether, "Burn 10M KEPT");
        a[3].chainId = 4663;
        a[3].target = address(team);
        a[3].a = "totalBurned()";
        a[3].threshold = 10_000_000 ether;
        vault.createPledge(IERC20(address(team)), me, "KEPT team roadmap", a, 3 ether);

        KeptVault.MilestoneInput[] memory b = new KeptVault.MilestoneInput[](2);
        b[0] = _m(Questions.Kind.GithubRelease, t + 3 days, 10_000_000 ether, "Open-source the indexer");
        b[0].a = "example-labs/indexer";
        b[0].b = "v0.1.0";
        b[1] = _m(Questions.Kind.PageContains, t + 20 days, 20_000_000 ether, "Docs site with API reference");
        b[1].a = "https://docs.example.xyz/api";
        b[1].b = "API reference";
        vault.createPledge(IERC20(address(team)), address(0xB0B), "Example Labs launch promises", b, 1 ether);

        vault.check(1, 0);
        vm.stopBroadcast();
        console.log("vault", address(vault));
        console.log("intake", address(intake));
        console.log("team", address(team));
    }

    function stage2(address vaultAddr, address intakeAddr) external {
        KeptVault vault = KeptVault(vaultAddr);
        MockIntake intake = MockIntake(intakeAddr);
        vm.startBroadcast(DEPLOYER);
        _deliver(vault, intake, 1, 0, true);
        vault.settle(1, 0);
        bytes32 r = vault.check(1, 1);
        r;
        _deliver(vault, intake, 1, 1, false);
        vault.check(1, 1);
        vault.settle(2, 0);
        vault.check(1, 2);
        vm.stopBroadcast();
    }

    function _deliver(KeptVault vault, MockIntake intake, uint256 id, uint8 index, bool answer) internal {
        (,,,,,,, bytes32 inFlight, uint64 askedAt) = vault.milestone(id, index);
        Questions.Spec memory spec = vault.milestoneSpec(id, index);
        OracleAttestation.Attestation memory a;
        a.requestId = keccak256(abi.encode(id, index, block.timestamp));
        a.chainId = Questions.questionChain(spec);
        a.answerType = OracleAttestation.ANSWER_BOOL;
        a.answer = abi.encode(answer);
        a.panelSize = 9;
        a.quorum = 7;
        a.agreed = answer ? 9 : 8;
        a.issuedAt = askedAt + 60; // the mined block can be a few seconds after the simulated one
        a.expiresAt = askedAt + 30 days;
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(ORACLE, vault.attestationDigest(a));
        intake.deliver(inFlight, a, abi.encodePacked(rr, s, v));
    }

    function _m(Questions.Kind kind, uint64 deadline, uint128 amount, string memory title)
        internal
        pure
        returns (KeptVault.MilestoneInput memory m)
    {
        m.kind = kind;
        m.deadline = deadline;
        m.amount = amount;
        m.title = title;
    }
}
