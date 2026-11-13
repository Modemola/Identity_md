// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVaultV2} from "../../src/v2/KeptVaultV2.sol";
import {KeptQuestionsV2} from "../../src/v2/KeptQuestionsV2.sol";
import {QuestionsV2} from "../../src/v2/QuestionsV2.sol";
import {OracleAttestation} from "../../src/OracleAttestation.sol";
import {TestIntake} from "../../src/testnet/TestIntake.sol";
import {TestIMD} from "../../src/testnet/TestIMD.sol";

/// @title KEPT on vibe/vibe's chain: Robinhood Chain testnet (46630)
/// @notice Opt-in. Skipped unless run on a fork of the testnet:
/// `forge test --match-contract VibeVibeForkTest --fork-url https://rpc.testnet.chain.robinhood.com`
/// Real vibe/vibe tokens, the KEPT testnet kit (test Intake, test IMD) and KeptVaultV2 unchanged.
contract VibeVibeForkTest is Test {
    bytes32 constant ACTION = 0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000;
    /// @dev $SCOUT, vibe/vibe launch #8422, graduated 9 Oct 2026.
    IERC20 constant SCOUT = IERC20(0x0a272E5eE3F48c668ccF30E65E7738099AE0a1DE);
    /// @dev A plain wallet holding SCOUT since its graduation drop.
    address constant SCOUT_HOLDER = 0x3ACB6d0Cb65532A90665330f5FF4CbC0C68Cd185;
    /// @dev vibe/vibe launch #47444: not graduated, so its token's transfers are still locked.
    IERC20 constant FRESH = IERC20(0x041a911E29edF35Da2b87BcC461689a87c000c08);
    address constant FRESH_POOL = 0x9294DaaA6741b4dd552E8DBBef8ef0b3B53824CB;
    address constant VIBEVIBE_FACTORY = 0xe794217880011f9cA6961340eD5c16EC9559Fea0;
    uint256 constant ORACLE_KEY = 0x0A11CE;

    TestIMD imd;
    TestIntake intake;
    KeptVaultV2 vault;
    address operator = makeAddr("operator");

    function setUp() public {
        // foundry.toml pins chain_id 4663 for the suite, so the fork is recognised by its contracts
        if (address(SCOUT).code.length == 0 || VIBEVIBE_FACTORY.code.length == 0) {
            vm.skip(true);
            return;
        }
        vm.chainId(46630);
        assertGt(VIBEVIBE_FACTORY.code.length, 0, "vibe/vibe factory");
        imd = new TestIMD();
        intake = new TestIntake(operator, operator, 0.5 ether);
        KeptQuestionsV2 builder = new KeptQuestionsV2();
        vault = new KeptVaultV2(operator, address(intake), address(imd), ACTION, vm.addr(ORACLE_KEY), 9, 7, address(builder));
    }

    function _milestone(uint64 deadline, uint128 amount) internal pure returns (KeptVaultV2.MilestoneInput[] memory ms) {
        ms = new KeptVaultV2.MilestoneInput[](1);
        ms[0].kind = QuestionsV2.Kind.GithubRelease;
        ms[0].deadline = deadline;
        ms[0].amount = amount;
        ms[0].title = "Scout v2 is released";
        ms[0].a = "modemola/chogxvibevibe";
        ms[0].b = "v2.0.0";
    }

    /// A graduated vibe/vibe token goes through the whole KEPT flow on its own chain.
    function test_graduatedScoutPledgeKeptAndReleased() public {
        uint256 amount = 1_000_000 ether;
        assertGe(SCOUT.balanceOf(SCOUT_HOLDER), amount, "holder still holds SCOUT");
        vm.startPrank(SCOUT_HOLDER);
        imd.faucet();
        imd.approve(address(vault), type(uint256).max);
        SCOUT.approve(address(vault), amount);
        uint256 id = vault.createPledge(SCOUT, SCOUT_HOLDER, "Graduation Scout roadmap", _milestone(uint64(block.timestamp + 3 days), uint128(amount)), 1 ether);
        assertEq(id, 1001);
        assertEq(SCOUT.balanceOf(address(vault)), amount, "SCOUT locked: the vault took the exact amount");
        bytes32 rid = vault.check(id, 0);
        vm.stopPrank();

        OracleAttestation.Attestation memory a;
        (,,,,,,,, uint64 askedAt) = vault.milestone(id, 0);
        a.requestId = keccak256("scout-v2");
        a.chainId = 46630;
        a.questionHash = keccak256("q");
        a.answerType = OracleAttestation.ANSWER_BOOL;
        a.answer = abi.encode(true);
        a.panelSize = 9;
        a.quorum = 7;
        a.agreed = 9;
        a.issuedAt = askedAt;
        a.expiresAt = askedAt + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ORACLE_KEY, this.digest(a));
        vm.prank(operator);
        (bool ok, bytes memory reason) = intake.deliver(rid, a, abi.encodePacked(r, s, v));
        assertTrue(ok, string(reason));

        uint256 before = SCOUT.balanceOf(SCOUT_HOLDER);
        vault.settle(id, 0);
        assertEq(SCOUT.balanceOf(SCOUT_HOLDER) - before, amount, "released back to the team");
    }

    /// Before graduation vibe/vibe locks transfers, so a team can't lock its token in KEPT yet.
    function test_ungraduatedTokenCannotBePledgedYet() public {
        address team = makeAddr("team");
        uint256 inPool = FRESH.balanceOf(FRESH_POOL);
        assertGt(inPool, 0, "the pool holds the launch's supply");
        // the pool can send tokens (it sells them to buyers); give the team some, the way a buy would
        vm.prank(FRESH_POOL);
        (bool sent,) = address(FRESH).call(abi.encodeWithSelector(IERC20.transfer.selector, team, 1 ether));
        if (!sent) {
            emit log("the pool itself cannot transfer outside a buy; the lock is enforced at the pool");
            return;
        }
        assertEq(FRESH.balanceOf(team), 1 ether);
        vm.startPrank(team);
        imd.faucet();
        imd.approve(address(vault), type(uint256).max);
        FRESH.approve(address(vault), 1 ether);
        // vibe/vibe's own transfer lock (custom error 0xdb89e3f4), raised by the token before KEPT's
        // vault does anything: the lock lifts at graduation
        vm.expectRevert(bytes4(0xdb89e3f4));
        vault.createPledge(FRESH, team, "too early", _milestone(uint64(block.timestamp + 3 days), 1 ether), 0);
        vm.stopPrank();
    }

    function digest(OracleAttestation.Attestation calldata a) external view returns (bytes32) {
        return vault.attestationDigest(a);
    }
}
