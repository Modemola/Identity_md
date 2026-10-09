// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVault} from "../src/KeptVault.sol";
import {OracleAttestation} from "../src/OracleAttestation.sol";
import {Questions} from "../src/libraries/Questions.sol";
import {MockIntake} from "./mocks/MockIntake.sol";
import {FeeToken} from "./mocks/FeeToken.sol";

/// @dev Drives random pledges, checks, verdicts, timeouts, donations and settlements.
contract VaultHandler is Test {
    KeptVault public vault;
    MockIntake public intake;
    FeeToken public imd;
    FeeToken public team;
    uint256 internal signerKey;
    address public beneficiary = address(0xBE);
    address public creator = address(0xC0);
    uint256 public paidOut;
    uint256 public burned;
    uint256 public deposited;
    uint256 internal nonce;
    bytes32[] internal requests;

    constructor(KeptVault vault_, MockIntake intake_, FeeToken imd_, FeeToken team_, uint256 key) {
        vault = vault_;
        intake = intake_;
        imd = imd_;
        team = team_;
        signerKey = key;
        team.mint(creator, 1e30);
        imd.mint(creator, 1e30);
        imd.mint(address(this), 1e30);
        vm.startPrank(creator);
        team.approve(address(vault), type(uint256).max);
        imd.approve(address(vault), type(uint256).max);
        vm.stopPrank();
        imd.approve(address(vault), type(uint256).max);
    }

    function create(uint8 n, uint96 amount, uint32 lead, uint96 budget) external {
        n = uint8(bound(n, 1, 4));
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](n);
        uint256 total;
        for (uint256 i; i < n; ++i) {
            ms[i].kind = Questions.Kind.GithubRelease;
            ms[i].deadline = uint64(block.timestamp + bound(lead, 1 hours, 10 days) + i * 1 days);
            ms[i].amount = uint128(bound(amount, 1, 1e24));
            ms[i].title = "ship";
            ms[i].a = "kept/app";
            ms[i].b = "v1";
            total += ms[i].amount;
        }
        vm.prank(creator);
        vault.createPledge(IERC20(address(team)), beneficiary, "p", ms, bound(budget, 0, 5 ether));
        deposited += total;
    }

    function donate(uint96 amount) external {
        amount = uint96(bound(amount, 1, 3 ether));
        vault.fundReferee(amount);
    }

    function fund(uint256 pledgeSeed, uint96 amount) external {
        uint256 count = vault.pledgeCount();
        if (count == 0) return;
        uint256 id = bound(pledgeSeed, 1, count);
        try vault.fund(id, bound(amount, 1, 3 ether)) {} catch {}
    }

    function check(uint256 pledgeSeed, uint8 index) external {
        uint256 count = vault.pledgeCount();
        if (count == 0) return;
        uint256 id = bound(pledgeSeed, 1, count);
        vm.prank(creator);
        try vault.check(id, index % 4) returns (bytes32 rid) {
            requests.push(rid);
        } catch {}
    }

    function answer(uint256 requestSeed, bool kept) external {
        if (requests.length == 0) return;
        // Mostly answer the newest check (the one most likely still in flight), sometimes an old one.
        bytes32 rid =
            requestSeed % 4 != 0 ? requests[requests.length - 1] : requests[requestSeed % requests.length];
        OracleAttestation.Attestation memory a;
        a.requestId = bytes32(++nonce);
        a.chainId = 4663;
        a.answerType = OracleAttestation.ANSWER_BOOL;
        a.answer = abi.encode(kept);
        a.panelSize = 9;
        a.quorum = 7;
        a.agreed = 7;
        a.issuedAt = uint64(block.timestamp);
        a.expiresAt = uint64(block.timestamp + 1 days);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, vault.attestationDigest(a));
        intake.deliver(rid, a, abi.encodePacked(r, s, v));
    }

    function settle(uint256 pledgeSeed, uint8 index) external {
        uint256 count = vault.pledgeCount();
        if (count == 0) return;
        uint256 id = bound(pledgeSeed, 1, count);
        uint256 beforeB = team.balanceOf(beneficiary);
        uint256 beforeD = team.balanceOf(vault.BURN());
        try vault.settle(id, index % 4) {
            paidOut += team.balanceOf(beneficiary) - beforeB;
            burned += team.balanceOf(vault.BURN()) - beforeD;
        } catch {}
    }

    function clear(uint256 pledgeSeed, uint8 index) external {
        uint256 count = vault.pledgeCount();
        if (count == 0) return;
        try vault.clearStale(bound(pledgeSeed, 1, count), index % 4) {} catch {}
    }

    function wait(uint32 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 3 days));
    }

    function digest(OracleAttestation.Attestation calldata a) external view returns (bytes32) {
        return vault.attestationDigest(a);
    }
}

contract VaultInvariantTest is Test {
    KeptVault vault;
    VaultHandler handler;
    FeeToken imd;
    FeeToken team;

    function setUp() public {
        vm.warp(1_791_000_000);
        uint256 key = 0xA11CE;
        imd = new FeeToken(false);
        team = new FeeToken(false);
        MockIntake intake = new MockIntake(address(0x7EA));
        vault = new KeptVault(
            address(this),
            address(intake),
            address(imd),
            bytes32("oracle.request@oracle-1"),
            vm.addr(key),
            9,
            7
        );
        handler = new VaultHandler(vault, intake, imd, team, key);
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](8);
        selectors[0] = VaultHandler.create.selector;
        selectors[1] = VaultHandler.donate.selector;
        selectors[2] = VaultHandler.fund.selector;
        selectors[3] = VaultHandler.check.selector;
        selectors[4] = VaultHandler.answer.selector;
        selectors[5] = VaultHandler.settle.selector;
        selectors[6] = VaultHandler.clear.selector;
        selectors[7] = VaultHandler.wait.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    /// @notice Every locked token is either still in the vault, paid to the team, or burned.
    function invariant_tokensConserved() public view {
        assertEq(
            team.balanceOf(address(vault)) + handler.paidOut() + handler.burned(),
            handler.deposited(),
            "team tokens"
        );
        uint256 locked;
        for (uint256 id = 1; id <= vault.pledgeCount(); ++id) {
            (,,,,,,, uint128 l,,,) = vault.pledge(id);
            locked += l;
        }
        assertEq(locked, team.balanceOf(address(vault)), "locked equals held");
    }

    /// @notice The vault's IMD is exactly the pledge budgets plus the Referee Fund.
    function invariant_imdAccounted() public view {
        assertEq(imd.balanceOf(address(vault)), vault.totalBudgets() + vault.refereeFund(), "imd");
        uint256 budgets;
        for (uint256 id = 1; id <= vault.pledgeCount(); ++id) {
            (,,,,,,,, uint256 b,,) = vault.pledge(id);
            budgets += b;
        }
        assertEq(budgets, vault.totalBudgets(), "budgets sum");
    }

    /// @notice A milestone is never both paid and burned, and settled ones hold nothing.
    function invariant_settledMilestonesHaveOutcome() public view {
        for (uint256 id = 1; id <= vault.pledgeCount(); ++id) {
            (,,,,, uint8 count, uint8 open,,,,) = vault.pledge(id);
            uint8 unsettled;
            for (uint8 i; i < count; ++i) {
                (,,,, KeptVault.Outcome o, bool settled, uint8 attempts,,) = vault.milestone(id, i);
                assertLe(attempts, vault.MAX_ATTEMPTS());
                if (settled) assertTrue(o != KeptVault.Outcome.Open);
                else ++unsettled;
            }
            assertEq(unsettled, open, "open count");
        }
    }
}

contract VaultHandlerSmokeTest is VaultInvariantTest {
    function test_handlerReachesPayoutAndBurn() public {
        handler.create(2, 1e18, 2 hours, 2 ether);
        handler.check(1, 0);
        handler.answer(0, true);
        handler.settle(1, 0);
        assertGt(handler.paidOut(), 0, "payout path");
        handler.wait(3 days);
        handler.wait(3 days);
        handler.settle(1, 1);
        assertGt(handler.burned(), 0, "burn path");
        invariant_tokensConserved();
        invariant_imdAccounted();
        invariant_settledMilestonesHaveOutcome();
    }
}
