// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVaultV2} from "../../src/v2/KeptVaultV2.sol";
import {KeptQuestionsV2} from "../../src/v2/KeptQuestionsV2.sol";
import {QuestionsV2} from "../../src/v2/QuestionsV2.sol";
import {KeptToken} from "../../src/KeptToken.sol";

/// @title KeptVaultV2 against IMD's current Intake on Robinhood Chain
/// @notice Opt-in. Skipped unless run on a Robinhood fork:
/// `forge test --match-contract VaultV2ForkTest --fork-url https://rpc.mainnet.chain.robinhood.com`
contract VaultV2ForkTest is Test {
    address constant OWNER = 0xD3336A7c8a7D8814C437196aBb16c4FE7aA7B016;
    /// @dev IMD's current Intake: the same address on every chain, with v1's request()/priceOf().
    address constant INTAKE = 0xa43e6F75ee006411F79Ac1C84120606C2330DE82;
    address constant IMD = 0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127;
    address constant SIGNER = 0x5598Aa9146215Bc13eb26f2c692Ad1461Fd32982;
    /// @dev The live KeptHook: its collected() is the number KEPT's own milestone 3 is about.
    address constant HOOK = 0xb5F28198750864e199477A6898bAD44AE4d1e0cC;
    bytes32 constant ACTION = 0x6f7261636c652e72657175657374406f7261636c652d31000000000000000000;
    bytes32 constant REQUESTED = keccak256("Requested(bytes32,address,bytes32,bytes,address,bytes4,address,uint256)");

    KeptVaultV2 vault;
    KeptQuestionsV2 builder;
    KeptToken kept;
    address team = makeAddr("team");

    function setUp() public {
        // forge runs offline tests as chain 4663 too (foundry.toml), so also skip without the live Intake
        if (block.chainid != 4663 || INTAKE.code.length == 0) {
            vm.skip(true);
            return;
        }
        assertGt(INTAKE.code.length, 0, "live Intake code");
        assertGt(HOOK.code.length, 0, "live KeptHook code");
        builder = new KeptQuestionsV2();
        vault = new KeptVaultV2(OWNER, INTAKE, IMD, ACTION, SIGNER, 9, 7, address(builder));
        kept = new KeptToken();
    }

    /// A partial-credit milestone, asked after its deadline, is a real paid request whose body asks
    /// for a number at the deadline's block.
    function test_scaledCheckAfterTheDeadlineBuysARealRequest() public {
        deal(IMD, team, 10 ether);
        kept.transfer(team, 150 ether);
        vm.startPrank(team);
        IERC20(IMD).approve(address(vault), type(uint256).max);
        kept.approve(address(vault), type(uint256).max);
        KeptVaultV2.MilestoneInput[] memory ms = new KeptVaultV2.MilestoneInput[](1);
        ms[0].kind = QuestionsV2.Kind.ValueScaled;
        ms[0].deadline = uint64(block.timestamp + 1 days);
        ms[0].amount = 150 ether;
        ms[0].chainId = 4663;
        ms[0].target = HOOK;
        ms[0].threshold = 5 ether;
        ms[0].a = "collected()";
        ms[0].title = "KEPT pool earns 5 IMD";
        uint256 id = vault.createPledge(IERC20(address(kept)), team, "v2 fork rehearsal", ms, 1 ether);
        assertEq(id, 1001);

        vm.warp(block.timestamp + 2 days); // past the deadline, inside grace: v1 could not do this
        uint256 before = IERC20(IMD).balanceOf(address(vault));
        vm.recordLogs();
        bytes32 rid = vault.check(id, 0);
        vm.stopPrank();
        assertTrue(rid != bytes32(0));
        uint256 paid = before - IERC20(IMD).balanceOf(address(vault));
        assertGt(paid, 0);
        assertLe(paid, 0.5 ether);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool seen;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != INTAKE || logs[i].topics[0] != REQUESTED) continue;
            (bytes memory body, address target,,,) = abi.decode(logs[i].data, (bytes, address, bytes4, address, uint256));
            assertEq(string(body), vault.questionOf(id, 0));
            assertEq(target, address(vault));
            assertTrue(_contains(string(body), '"answerType":"uint256","evidence":"chain"'));
            assertTrue(_contains(string(body), "Return the uint256 it returns"));
            seen = true;
        }
        assertTrue(seen, "the current Intake emitted Requested");
        // the number the swarm will read, today
        (bool ok, bytes memory out) = HOOK.staticcall(abi.encodeWithSignature("collected()"));
        assertTrue(ok && out.length == 32, "collected() is a uint256 view");
    }

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
