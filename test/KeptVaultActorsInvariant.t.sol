// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVault} from "../src/KeptVault.sol";
import {OracleAttestation} from "../src/OracleAttestation.sol";
import {Questions} from "../src/libraries/Questions.sol";
import {MockIntake} from "./mocks/MockIntake.sol";
import {FeeToken} from "./mocks/FeeToken.sol";

/// @dev Several creators and beneficiaries, three pledge tokens (one of them IMD itself), all four
/// templates' timing rules via three of them, price changes, signer rotation and outsiders who try
/// to spend attempts or forge verdicts. Rule breaks are counted in ghost variables, not asserted
/// inside the handler, so a broken rule cannot hide behind `fail_on_revert = false`.
contract ActorsHandler is Test {
    uint256 internal constant MAX_PLEDGES = 12;

    KeptVault public vault;
    MockIntake public intake;
    FeeToken public imd;
    FeeToken[3] public tokens; // [teamA, teamB, imd]
    address public treasury;

    address[2] public creators = [address(0xC0), address(0xC1)];
    address[2] public beneficiaries = [address(0xB0), address(0xB1)];
    address public outsider = address(0x0BAD);

    uint256[] internal keys;
    mapping(address => uint256) internal keyOf;

    struct Req {
        uint256 pledgeId;
        uint8 index;
        uint256 key;
    }

    bytes32[] public requests;
    mapping(bytes32 => Req) internal reqs;

    struct Seen {
        KeptVault.Outcome outcome;
        bool settled;
        uint8 attempts;
    }

    mapping(uint256 => mapping(uint8 => Seen)) internal seen;

    // ghost accounting
    mapping(address => uint256) public deposited; // per pledge token
    mapping(address => uint256) public paid;
    mapping(address => uint256) public burned;
    uint256 public imdIn; // budgets, top-ups and donations
    uint256 public imdSpent; // paid to the Intake
    uint256 public imdReturned; // withdrawn budgets

    // rule breaks
    uint256 public outsiderChecks;
    uint256 public forgedAccepted;
    uint256 public wrongPayouts;
    uint256 public earlyBurns;
    uint256 public finalityBreaks;
    uint256 public wrongRefunds;
    uint256 public overspends;

    // coverage
    uint256 public keptVerdicts;
    uint256 public payouts;
    uint256 public burns;
    uint256 public rotations;

    constructor(
        KeptVault vault_,
        MockIntake intake_,
        FeeToken imd_,
        FeeToken a,
        FeeToken b,
        uint256 key,
        address t
    ) {
        vault = vault_;
        intake = intake_;
        imd = imd_;
        tokens = [a, b, imd_];
        treasury = t;
        keys.push(key);
        keyOf[vm.addr(key)] = key;
        for (uint256 i; i < 2; ++i) {
            for (uint256 j; j < 3; ++j) {
                tokens[j].mint(creators[i], 1e30);
                vm.prank(creators[i]);
                tokens[j].approve(address(vault), type(uint256).max);
            }
        }
        imd.mint(address(this), 1e30);
        imd.approve(address(vault), type(uint256).max);
    }

    // ---------------------------------------------------------------- actions

    function create(uint256 seed, uint8 n, uint96 amount, uint32 lead, uint96 budget) external {
        if (vault.pledgeCount() >= MAX_PLEDGES) return;
        n = uint8(bound(n, 1, 4));
        address who = creators[seed % 2];
        address to = beneficiaries[(seed >> 1) % 2];
        FeeToken token = tokens[(seed >> 2) % 3];
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](n);
        uint256 total;
        for (uint256 i; i < n; ++i) {
            uint256 kind = (seed >> (8 + 2 * i)) % 3;
            KeptVault.MilestoneInput memory m = ms[i];
            m.deadline = uint64(block.timestamp + bound(lead, 1 hours, 10 days) + i * 1 days);
            m.amount = uint128(bound(amount, 1, 1e24) + i);
            m.title = "ship";
            if (kind == 0) {
                m.kind = Questions.Kind.GithubRelease;
                m.a = "kept/app";
                m.b = "v1";
            } else if (kind == 1) {
                m.kind = Questions.Kind.PageContains;
                m.a = "https://kept.example/";
                m.b = "live";
            } else {
                m.kind = Questions.Kind.ValueAtLeast;
                m.chainId = 4663;
                m.target = address(0xBEEF);
                m.threshold = 1;
                m.a = "totalSupply()";
            }
            total += m.amount;
        }
        uint256 b = bound(budget, 0, 3 ether);
        vm.prank(who);
        vault.createPledge(IERC20(address(token)), to, "p", ms, b);
        deposited[address(token)] += total;
        imdIn += b;
        _sweep();
    }

    function donate(uint96 amount) external {
        uint256 a = bound(amount, 1, 2 ether);
        vault.fundReferee(a);
        imdIn += a;
        _sweep();
    }

    function fund(uint256 pledgeSeed, uint96 amount) external {
        uint256 id = _pick(pledgeSeed);
        if (id == 0) return;
        uint256 a = bound(amount, 1, 2 ether);
        try vault.fund(id, a) {
            imdIn += a;
        } catch {}
        _sweep();
    }

    function check(uint256 pledgeSeed, uint8 index, uint8 actor, bool explicitCap) external {
        uint256 id = _pick(pledgeSeed);
        if (id == 0) return;
        (, address ben,,,,,,,,,) = vault.pledge(id);
        address who = actor % 4 == 0 ? outsider : actor % 4 == 1 ? creators[actor % 2] : ben;
        uint256 signerKey = keyOf[vault.oracleSigner()];
        uint256 before = imd.balanceOf(treasury);
        (,,,,,,,, uint256 budgetBefore,,) = vault.pledge(id);
        (bool ok, bytes32 rid) = _tryCheck(who, id, index % 4, explicitCap);
        if (ok) {
            if (who != ben) ++outsiderChecks;
            uint256 spent = imd.balanceOf(treasury) - before;
            if (spent > budgetBefore) ++overspends;
            imdSpent += spent;
            requests.push(rid);
            reqs[rid] = Req(id, index % 4, signerKey);
        }
        _sweep();
    }

    function _tryCheck(address who, uint256 id, uint8 index, bool explicitCap)
        internal
        returns (bool ok, bytes32 rid)
    {
        vm.prank(who);
        if (explicitCap) {
            try vault.check(id, index, 1 ether) returns (bytes32 r) {
                return (true, r);
            } catch {}
        } else {
            try vault.check(id, index) returns (bytes32 r) {
                return (true, r);
            } catch {}
        }
    }

    function answer(uint256 requestSeed, bool kept, uint8 tamper) external {
        if (requests.length == 0) return;
        bytes32 rid =
            requestSeed % 4 != 0 ? requests[requests.length - 1] : requests[requestSeed % requests.length];
        Req memory r = reqs[rid];
        OracleAttestation.Attestation memory a;
        a.requestId = keccak256(abi.encode(rid, block.timestamp, requestSeed));
        a.chainId = 4663;
        a.answerType = OracleAttestation.ANSWER_BOOL;
        a.answer = abi.encode(kept);
        a.panelSize = 9;
        a.quorum = 7;
        a.agreed = 7;
        a.issuedAt = uint64(block.timestamp);
        a.expiresAt = uint64(block.timestamp + 1 days);
        uint256 key = r.key;
        bool forged = tamper % 5 == 0;
        if (forged) {
            // An outsider's key, or a weaker panel than the pledge requires.
            if (tamper % 2 == 0) key = 0xBAD;
            else a.panelSize = 8;
        }
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, vault.attestationDigest(a));
        (bool ok,,) = intake.deliver(rid, a, abi.encodePacked(rr, s, v));
        if (ok && forged) ++forgedAccepted;
        if (ok && kept) ++keptVerdicts;
        _sweep();
    }

    function settle(uint256 pledgeSeed, uint8 index) external {
        uint256 id = _pick(pledgeSeed);
        if (id == 0) return;
        uint8 i = index % 4;
        (, address ben, address token,,,,,,,,) = vault.pledge(id);
        uint256 bBefore = IERC20(token).balanceOf(ben);
        uint256 dBefore = IERC20(token).balanceOf(vault.BURN());
        try vault.settle(id, i) {
            (,, uint64 deadline, uint128 amount, KeptVault.Outcome o,,,,) = vault.milestone(id, i);
            uint256 toBen = IERC20(token).balanceOf(ben) - bBefore;
            uint256 toBurn = IERC20(token).balanceOf(vault.BURN()) - dBefore;
            if (o == KeptVault.Outcome.Kept) {
                if (toBen != amount || toBurn != 0) ++wrongPayouts;
                paid[token] += toBen;
                ++payouts;
            } else {
                if (o != KeptVault.Outcome.Broken || toBurn != amount || toBen != 0) ++wrongPayouts;
                if (block.timestamp <= uint256(deadline) + vault.GRACE()) ++earlyBurns;
                burned[token] += toBurn;
                ++burns;
            }
        } catch {}
        _sweep();
    }

    function withdraw(uint256 pledgeSeed) external {
        uint256 id = _pick(pledgeSeed);
        if (id == 0) return;
        (address creator,,,,,,,, uint256 budget,,) = vault.pledge(id);
        uint256 before = imd.balanceOf(creator);
        vm.prank(outsider);
        try vault.withdrawBudget(id) returns (uint256 left) {
            if (left != budget || imd.balanceOf(creator) - before != left) ++wrongRefunds;
            imdReturned += left;
        } catch {}
        _sweep();
    }

    function clear(uint256 pledgeSeed, uint8 index) external {
        uint256 id = _pick(pledgeSeed);
        if (id == 0) return;
        vm.prank(outsider);
        try vault.clearStale(id, index % 4) {} catch {}
        _sweep();
    }

    function reprice(uint96 price) external {
        intake.setPrice(bound(price, 0.1 ether, 0.8 ether));
    }

    function rotate(uint256 seed) external {
        uint256 key = bound(seed, 1, 1e18) | 1;
        keys.push(key);
        keyOf[vm.addr(key)] = key;
        address admin = vault.owner();
        bytes32 action = vault.action();
        vm.prank(admin);
        vault.proposeProtocol(address(intake), action, vm.addr(key));
        vm.warp(block.timestamp + vault.PROTOCOL_DELAY());
        vault.executeProtocol();
        ++rotations;
        _sweep();
    }

    function wait(uint32 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 3 days));
        _sweep();
    }

    // ---------------------------------------------------------------- helpers

    function requestCount() external view returns (uint256) {
        return requests.length;
    }

    function _pick(uint256 seed) internal view returns (uint256) {
        uint256 count = vault.pledgeCount();
        return count == 0 ? 0 : bound(seed, 1, count);
    }

    /// @dev Outcomes are final: settled stays settled, Kept and Broken never change, attempts
    /// never go down and never pass the cap.
    function _sweep() internal {
        uint256 count = vault.pledgeCount();
        for (uint256 id = 1; id <= count; ++id) {
            (,,,,, uint8 n,,,,,) = vault.pledge(id);
            for (uint8 i; i < n; ++i) {
                (,,,, KeptVault.Outcome o, bool settled, uint8 attempts,,) = vault.milestone(id, i);
                Seen memory s = seen[id][i];
                if (
                    (s.settled && !settled) || (s.outcome != KeptVault.Outcome.Open && o != s.outcome)
                        || attempts < s.attempts || attempts > vault.MAX_ATTEMPTS()
                        || (settled && o == KeptVault.Outcome.Open)
                ) ++finalityBreaks;
                seen[id][i] = Seen(o, settled, attempts);
            }
        }
    }
}

abstract contract ActorsBase is Test {
    KeptVault vault;
    ActorsHandler handler;
    MockIntake intake;
    FeeToken imd;
    FeeToken teamA;
    FeeToken teamB;
    address treasury = address(0x7EA);

    function setUp() public {
        vm.warp(1_791_000_000);
        uint256 key = 0xA11CE;
        imd = new FeeToken(false);
        teamA = new FeeToken(false);
        teamB = new FeeToken(false);
        intake = new MockIntake(treasury);
        vault = new KeptVault(
            address(0x0A11),
            address(intake),
            address(imd),
            bytes32("oracle.request@oracle-1"),
            vm.addr(key),
            9,
            7
        );
        handler = new ActorsHandler(vault, intake, imd, teamA, teamB, key, treasury);
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](11);
        selectors[0] = ActorsHandler.create.selector;
        selectors[1] = ActorsHandler.donate.selector;
        selectors[2] = ActorsHandler.fund.selector;
        selectors[3] = ActorsHandler.check.selector;
        selectors[4] = ActorsHandler.answer.selector;
        selectors[5] = ActorsHandler.settle.selector;
        selectors[6] = ActorsHandler.withdraw.selector;
        selectors[7] = ActorsHandler.clear.selector;
        selectors[8] = ActorsHandler.reprice.selector;
        selectors[9] = ActorsHandler.rotate.selector;
        selectors[10] = ActorsHandler.wait.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function _lockedIn(address token) internal view returns (uint256 locked) {
        for (uint256 id = 1; id <= vault.pledgeCount(); ++id) {
            (,, address t,,,,, uint128 l,,,) = vault.pledge(id);
            if (t == token) locked += l;
        }
    }

    /// @notice Each team token deposited is still locked, paid to its beneficiary or burned.
    function _teamTokensConserved() internal view {
        for (uint256 j; j < 2; ++j) {
            address t = j == 0 ? address(teamA) : address(teamB);
            assertEq(IERC20(t).balanceOf(address(vault)), _lockedIn(t), "held == locked");
            assertEq(
                _lockedIn(t) + handler.paid(t) + handler.burned(t),
                handler.deposited(t),
                "deposited == locked+out"
            );
        }
    }

    /// @notice IMD held is exactly budgets, the Referee Fund and IMD locked as a pledge token, and
    /// every IMD that came in is held, paid to the Intake, returned, paid out or burned.
    function _imdConserved() internal view {
        uint256 lockedImd = _lockedIn(address(imd));
        uint256 held = imd.balanceOf(address(vault));
        assertEq(held, vault.totalBudgets() + vault.refereeFund() + lockedImd, "imd held");
        uint256 budgets;
        for (uint256 id = 1; id <= vault.pledgeCount(); ++id) {
            (,,,,,,,, uint256 b,,) = vault.pledge(id);
            budgets += b;
        }
        assertEq(budgets, vault.totalBudgets(), "budgets sum");
        assertEq(imd.balanceOf(treasury), handler.imdSpent(), "only checks reach the Intake");
        assertEq(
            handler.imdIn() + handler.deposited(address(imd)),
            held + handler.imdSpent() + handler.imdReturned() + handler.paid(address(imd))
                + handler.burned(address(imd)),
            "imd in == imd out + held"
        );
    }

    /// @notice No rule break was observed by the handler on any call.
    function _rulesHold() internal view {
        assertEq(handler.outsiderChecks(), 0, "only the beneficiary spends attempts");
        assertEq(handler.forgedAccepted(), 0, "forged or weak verdict accepted");
        assertEq(handler.wrongPayouts(), 0, "settlement sent the wrong amount or to the wrong place");
        assertEq(handler.earlyBurns(), 0, "burned before deadline + GRACE");
        assertEq(handler.finalityBreaks(), 0, "an outcome reopened");
        assertEq(handler.wrongRefunds(), 0, "budget refund did not go to the creator in full");
        assertEq(handler.overspends(), 0, "a check spent more than its pledge's budget");
    }

    /// @notice A finished pledge holds nothing locked and has no open milestone.
    function _openCountMatches() internal view {
        for (uint256 id = 1; id <= vault.pledgeCount(); ++id) {
            (,,,,, uint8 n, uint8 open, uint128 locked,,,) = vault.pledge(id);
            uint8 unsettled;
            uint256 owed;
            for (uint8 i; i < n; ++i) {
                (,,, uint128 amount,, bool settled,,,) = vault.milestone(id, i);
                if (!settled) {
                    ++unsettled;
                    owed += amount;
                }
            }
            assertEq(unsettled, open, "open count");
            assertEq(owed, locked, "locked == unsettled tranches");
        }
    }
}

contract KeptVaultActorsInvariantTest is ActorsBase {
    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 100
    function invariant_teamTokensConserved() public view {
        _teamTokensConserved();
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 100
    function invariant_imdConserved() public view {
        _imdConserved();
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 100
    function invariant_rulesHold() public view {
        _rulesHold();
    }

    /// forge-config: default.invariant.runs = 64
    /// forge-config: default.invariant.depth = 100
    function invariant_openCountMatches() public view {
        _openCountMatches();
    }
}

/// @dev Proves the handler reaches the paths the invariants talk about, so they are not vacuous.
contract ActorsHandlerReachTest is ActorsBase {
    function test_handlerReachesEveryPath() public {
        // seed 0: creator 0, beneficiary 0, teamA, all GitHub templates.
        handler.create(0, 2, 1e18, 2 hours, 2 ether);
        // seed 4 << 0: teamB; seed 8: IMD token.
        handler.create(8, 1, 5e17, 2 hours, 1 ether);
        handler.donate(1 ether);
        handler.check(1, 0, 0, false); // outsider: refused
        handler.check(1, 0, 2, false); // beneficiary
        handler.answer(1, true, 1);
        assertEq(handler.keptVerdicts(), 1);
        handler.settle(1, 0);
        handler.check(2, 0, 2, true);
        handler.answer(2, true, 0); // forged: refused
        handler.rotate(42);
        handler.wait(3 days);
        handler.wait(3 days);
        handler.settle(1, 1);
        handler.settle(2, 0);
        handler.withdraw(1);
        handler.withdraw(2);
        assertGt(handler.payouts(), 0, "payout");
        assertGt(handler.burns(), 0, "burn");
        assertGt(handler.imdReturned(), 0, "refund");
        assertEq(handler.rotations(), 1);
        _teamTokensConserved();
        _imdConserved();
        _rulesHold();
        _openCountMatches();
    }
}
