// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {KeptVault} from "../src/KeptVault.sol";
import {OracleAttestation, OracleAttestationConsumer} from "../src/OracleAttestation.sol";
import {Questions} from "../src/libraries/Questions.sol";
import {MockIntake} from "./mocks/MockIntake.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

/// @notice Team token that calls back into the vault on every transfer out of it, to prove the
/// vault's `nonReentrant` guards hold while a payout is moving.
contract ReentrantToken is ERC20 {
    KeptVault public vault;
    bytes public payload;
    bool public attempted;
    bool public reentered;
    bytes public reentryError;

    constructor() ERC20("Reenter", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(KeptVault vault_, bytes calldata payload_) external {
        vault = vault_;
        payload = payload_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (address(vault) != address(0) && from == address(vault) && payload.length != 0) {
            attempted = true;
            bytes memory err;
            (reentered, err) = address(vault).call(payload);
            reentryError = err;
        }
    }
}

/// @notice Failure paths and boundaries the lifecycle suite does not pin.
contract KeptVaultFailurePathsTest is VaultFixture {
    uint256 internal constant GRACE = 3 days;
    uint256 internal constant TIMEOUT = 1 days;
    uint256 internal constant SECP256K1_N =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    // ---------------------------------------------------------------- constructor

    function test_constructorRejectsMissingAddresses() public {
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        new KeptVault(address(0), address(intake), address(imd), ACTION, signer, 9, 7);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        new KeptVault(owner, address(intake), address(0), ACTION, signer, 9, 7);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        new KeptVault(owner, address(0), address(imd), ACTION, signer, 9, 7);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        new KeptVault(owner, address(intake), address(imd), bytes32(0), signer, 9, 7);
        vm.expectRevert(OracleAttestationConsumer.ZeroSigner.selector);
        new KeptVault(owner, address(intake), address(imd), ACTION, address(0), 9, 7);
    }

    function test_constructorPanelEdges() public {
        uint16[7] memory badSize = [uint16(4), 5, 101, 9, 100, 0, 9];
        uint16[7] memory badQuorum = [uint16(3), 2, 51, 10, 50, 0, 4];
        for (uint256 i; i < badSize.length; ++i) {
            vm.expectRevert(KeptVault.InvalidConfiguration.selector);
            new KeptVault(owner, address(intake), address(imd), ACTION, signer, badSize[i], badQuorum[i]);
        }
        uint16[4] memory goodSize = [uint16(5), 5, 100, 100];
        uint16[4] memory goodQuorum = [uint16(3), 5, 51, 100];
        for (uint256 i; i < goodSize.length; ++i) {
            KeptVault v = new KeptVault(
                owner, address(intake), address(imd), ACTION, signer, goodSize[i], goodQuorum[i]
            );
            assertEq(v.panelSize(), goodSize[i]);
            assertEq(v.quorum(), goodQuorum[i]);
        }
    }

    /// forge-config: default.fuzz.runs = 1000
    function testFuzz_setPanelAcceptsExactlyAStrictMajority(uint16 size, uint16 q) public {
        size = uint16(bound(size, 0, 120));
        q = uint16(bound(q, 0, 120));
        bool valid = size >= 5 && size <= 100 && 2 * uint256(q) > size && q <= size;
        vm.prank(owner);
        if (!valid) vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        vault.setPanel(size, q);
        if (valid) {
            assertEq(vault.panelSize(), size);
            assertEq(vault.quorum(), q);
        } else {
            assertEq(vault.panelSize(), 9);
            assertEq(vault.quorum(), 7);
        }
    }

    // ---------------------------------------------------------------- admin

    function test_adminFunctionsAreOwnerOnly() public {
        vm.startPrank(stranger);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.setPanel(9, 7);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.setOwner(stranger);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.cancelProtocol();
        vm.stopPrank();
        assertEq(vault.owner(), owner);
    }

    function test_renouncedOwnerCannotAdminister() public {
        vm.prank(owner);
        vault.setOwner(address(0));
        vm.startPrank(owner);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.proposeProtocol(makeAddr("i"), ACTION, signer);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.setPanel(9, 7);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.setOwner(owner);
        vm.stopPrank();
    }

    function test_ownerHandoverMovesTheRole() public {
        address next = makeAddr("next");
        vm.prank(owner);
        vault.setOwner(next);
        vm.prank(owner);
        vm.expectRevert(KeptVault.OnlyOwner.selector);
        vault.setPanel(15, 11);
        vm.prank(next);
        vault.setPanel(15, 11);
        assertEq(vault.panelSize(), 15);
    }

    function test_proposeRejectsZeroFields() public {
        vm.startPrank(owner);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        vault.proposeProtocol(address(0), ACTION, signer);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        vault.proposeProtocol(address(intake), bytes32(0), signer);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        vault.proposeProtocol(address(intake), ACTION, address(0));
        vm.stopPrank();
    }

    function test_cancelAndExecuteNeedAPendingChange() public {
        vm.expectRevert(KeptVault.NothingPending.selector);
        vault.executeProtocol();
        vm.prank(owner);
        vm.expectRevert(KeptVault.NothingPending.selector);
        vault.cancelProtocol();

        vm.prank(owner);
        vault.proposeProtocol(makeAddr("intake2"), ACTION, makeAddr("signer2"));
        vm.prank(owner);
        vault.cancelProtocol();
        vm.warp(T0 + 30 days);
        vm.expectRevert(KeptVault.NothingPending.selector);
        vault.executeProtocol();
        assertEq(address(vault.intake()), address(intake));
        assertEq(vault.oracleSigner(), signer);
    }

    function test_reproposalRestartsTheDelayAndExecutesOnce() public {
        address i2 = makeAddr("intake2");
        address i3 = makeAddr("intake3");
        vm.prank(owner);
        vault.proposeProtocol(i2, ACTION, signer);
        vm.warp(T0 + 6 days);
        vm.prank(owner);
        vault.proposeProtocol(i3, ACTION, signer);
        vm.warp(T0 + 7 days);
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.executeProtocol();
        vm.warp(T0 + 13 days);
        vm.prank(stranger);
        vault.executeProtocol();
        assertEq(address(vault.intake()), i3);
        vm.expectRevert(KeptVault.NothingPending.selector);
        vault.executeProtocol();
    }

    // ---------------------------------------------------------------- funding

    function test_fundFailurePaths() public {
        vm.prank(stranger);
        vm.expectRevert(KeptVault.UnknownPledge.selector);
        vault.fund(1, 1 ether);
        uint256 id = _standard();
        vm.prank(stranger);
        vm.expectRevert(KeptVault.InvalidPledge.selector);
        vault.fund(id, 0);
        vm.warp(T0 + 7 days + GRACE + 1);
        vault.settle(id, 0);
        vm.prank(stranger);
        vm.expectRevert(KeptVault.InvalidPledge.selector);
        vault.fund(id, 1 ether);
        vm.prank(stranger);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        vault.fundReferee(0);
    }

    function test_withdrawUnknownPledgeAndEmptyBudget() public {
        vm.expectRevert(KeptVault.UnknownPledge.selector);
        vault.withdrawBudget(1);
        uint256 id = _create(_one(_release(T0 + 7 days, 1 ether)), 0);
        vm.warp(T0 + 7 days + GRACE + 1);
        vault.settle(id, 0);
        vm.expectRevert(KeptVault.NothingPending.selector);
        vault.withdrawBudget(id);
    }

    function test_creatorWithoutAllowanceCannotCreate() public {
        address poor = makeAddr("poor");
        team.mint(poor, 10 ether);
        vm.prank(poor);
        vm.expectRevert();
        vault.createPledge(IERC20(address(team)), beneficiary, "x", _one(_release(T0 + 7 days, 1 ether)), 0);
        assertEq(vault.pledgeCount(), 0);
    }

    // ---------------------------------------------------------------- checks

    function test_checkUnknownPledgeOrMilestone() public {
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.UnknownPledge.selector);
        vault.check(0, 0);
        uint256 id = _standard();
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.UnknownPledge.selector);
        vault.check(id + 1, 0);
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.UnknownMilestone.selector);
        vault.check(id, 1);
        vm.expectRevert(KeptVault.UnknownMilestone.selector);
        vault.settle(id, 255);
        vm.expectRevert(KeptVault.UnknownMilestone.selector);
        vault.clearStale(id, 1);
        vm.expectRevert(KeptVault.UnknownPledge.selector);
        vault.checkOpen(id + 1, 0);
    }

    function test_checkRefusedOnceKeptOrSettled() public {
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](2);
        ms[0] = _release(T0 + 7 days, 1 ether);
        ms[1] = _release(T0 + 7 days, 1 ether);
        uint256 id = _create(ms, 5 ether);
        bytes32 rid = _check(id, 0, beneficiary);
        _deliver(id, 0, rid, true);
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.NotOpen.selector);
        vault.check(id, 0);
        (bool open, bool funded) = vault.checkOpen(id, 0);
        assertFalse(open || funded);
        vault.settle(id, 0);
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.NotOpen.selector);
        vault.check(id, 0);

        vm.warp(T0 + 7 days + GRACE + 1);
        vault.settle(id, 1);
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.NotOpen.selector);
        vault.check(id, 1);
    }

    function test_zeroQuoteRefusesCheckAndSpendsNothing() public {
        uint256 id = _standard();
        intake.setPrice(0);
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        vault.check(id, 0);
        assertEq(_budget(id), 10 ether);
        (bool open, bool funded) = vault.checkOpen(id, 0);
        assertTrue(open);
        assertFalse(funded);
    }

    function test_threeNoVerdictsExhaustAttempts() public {
        uint256 id = _standard();
        for (uint256 i; i < 3; ++i) {
            bytes32 rid = _check(id, 0, beneficiary);
            _deliver(id, 0, rid, false);
            (KeptVault.Outcome o, bool settled) = _outcome(id, 0);
            assertEq(uint8(o), uint8(KeptVault.Outcome.Open), "a no is stored, not final");
            assertFalse(settled);
        }
        assertEq(_budget(id), 10 ether - 3 * PRICE, "no rebate for a no");
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.AttemptsExhausted.selector);
        vault.check(id, 0);
        (bool open,) = vault.checkOpen(id, 0);
        assertFalse(open);
        // The tranche can only burn now, and only after grace.
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.settle(id, 0);
        vm.warp(T0 + 7 days + GRACE + 1);
        vault.settle(id, 0);
        assertEq(team.balanceOf(vault.BURN()), 100 ether);
    }

    function test_noThenKeptPaysOutAndRebatesOnlyTheKeptCheck() public {
        vm.prank(stranger);
        vault.fundReferee(5 ether);
        uint256 id = _standard();
        bytes32 r1 = _check(id, 0, beneficiary);
        _deliver(id, 0, r1, false);
        bytes32 r2 = _check(id, 0, beneficiary);
        _deliver(id, 0, r2, true);
        assertEq(_budget(id), 10 ether - PRICE, "second check rebated, first not");
        assertEq(vault.refereeFund(), 5 ether - PRICE);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 100 ether);
    }

    // ---------------------------------------------------------------- stale checks

    function test_clearStaleFailurePathsAndBoundary() public {
        uint256 id = _standard();
        vm.expectRevert(KeptVault.NoCheckInFlight.selector);
        vault.clearStale(id, 0);
        bytes32 rid = _check(id, 0, beneficiary);
        vm.warp(T0 + TIMEOUT - 1);
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.clearStale(id, 0);
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.CheckInFlight.selector);
        vault.check(id, 0);
        vm.warp(T0 + TIMEOUT);
        vm.prank(stranger);
        vault.clearStale(id, 0);
        (,,,,,, uint8 attempts, bytes32 inFlight,) = vault.milestone(id, 0);
        assertEq(attempts, 1, "a cleared check still counts");
        assertEq(inFlight, bytes32(0));
        assertEq(_budget(id), 10 ether - PRICE, "a cleared check is not refunded");
        vm.expectRevert(KeptVault.NoCheckInFlight.selector);
        vault.clearStale(id, 0);

        // The late answer to the cleared check can no longer land.
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        (bool ok,, bytes memory reason) = intake.deliver(rid, a, _sign(a, signerKey));
        assertFalse(ok);
        assertEq(reason, abi.encodeWithSelector(KeptVault.UnknownRequest.selector));
    }

    function test_lateAnswerAfterBurnIsRefused() public {
        uint256 id = _standard();
        vm.warp(T0 + 7 days - 2 hours);
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory sig = _sign(a, signerKey);
        vm.warp(T0 + 7 days + GRACE + 1);
        vault.settle(id, 0);
        (KeptVault.Outcome o, bool settled) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Broken));
        assertTrue(settled);
        vm.prank(address(intake));
        vm.expectRevert(KeptVault.UnknownRequest.selector);
        vault.onOracleResult(rid, a, sig);
    }

    // ---------------------------------------------------------------- settlement

    function test_settleBoundaryIsStrictlyAfterGrace() public {
        uint256 id = _standard();
        vm.warp(T0 + 7 days + GRACE);
        vm.expectRevert(KeptVault.TooEarly.selector);
        vault.settle(id, 0);
        vm.warp(T0 + 7 days + GRACE + 1);
        vm.prank(stranger);
        vault.settle(id, 0);
        assertEq(team.balanceOf(vault.BURN()), 100 ether);
        assertEq(team.balanceOf(address(vault)), 0);
        vm.expectRevert(KeptVault.AlreadySettled.selector);
        vault.settle(id, 0);
    }

    function test_keptSettlementByAnyoneAlwaysPaysTheBeneficiary() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        _deliver(id, 0, rid, true);
        vm.prank(stranger);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 100 ether);
        assertEq(team.balanceOf(stranger), 0);
    }

    // ---------------------------------------------------------------- callback guards

    function test_duplicateDeliveryIsRefused() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, false);
        bytes memory sig = _sign(a, signerKey);
        (bool ok,,) = intake.deliver(rid, a, sig);
        assertTrue(ok);
        // Same request id, fresh attestation: the check is no longer in flight.
        OracleAttestation.Attestation memory b = _attestation(id, 0, true);
        (bool ok2,, bytes memory reason) = intake.deliver(rid, b, _sign(b, signerKey));
        assertFalse(ok2);
        assertEq(reason, abi.encodeWithSelector(KeptVault.UnknownRequest.selector));
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Open));
    }

    function test_retiredIntakeCannotAnswerTheNewIntakesRequests() public {
        uint256 id = _create(_one(_release(T0 + 30 days, 1 ether)), 5 ether);
        MockIntake intake2 = new MockIntake(treasury);
        vm.prank(owner);
        vault.proposeProtocol(address(intake2), ACTION, signer);
        vm.warp(T0 + 7 days);
        vault.executeProtocol();
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory sig = _sign(a, signerKey);
        vm.prank(address(intake));
        vm.expectRevert(KeptVault.OnlyIntake.selector);
        vault.onOracleResult(rid, a, sig);
        vm.prank(address(intake2));
        vault.onOracleResult(rid, a, sig);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
    }

    function test_attackerIntakeCannotDeliver() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        MockIntake rogue = new MockIntake(stranger);
        // The rogue intake forwards a perfectly signed attestation for the real request id.
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory sig = _sign(a, signerKey);
        vm.prank(address(rogue));
        vm.expectRevert(KeptVault.OnlyIntake.selector);
        vault.onOracleResult(rid, a, sig);
    }

    function test_attestationIssuedTooFarInTheFutureIsRefused() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        a.issuedAt = uint64(block.timestamp + 5 minutes + 1);
        a.expiresAt = a.issuedAt + 1 days;
        bytes memory sig = _sign(a, signerKey);
        vm.prank(address(intake));
        vm.expectRevert(
            abi.encodeWithSelector(OracleAttestationConsumer.AttestationNotYetValid.selector, a.issuedAt)
        );
        vault.onOracleResult(rid, a, sig);
        // Within the tolerance it is accepted.
        a.issuedAt = uint64(block.timestamp + 5 minutes);
        a.expiresAt = a.issuedAt + 1 days;
        sig = _sign(a, signerKey);
        vm.prank(address(intake));
        vault.onOracleResult(rid, a, sig);
    }

    function test_expiryBeforeIssueIsRefused() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        // Not expired yet and issued within the tolerance, but the signed window is inverted.
        a.issuedAt = uint64(block.timestamp + 60);
        a.expiresAt = uint64(block.timestamp + 30);
        bytes memory sig = _sign(a, signerKey);
        vm.prank(address(intake));
        vm.expectRevert(KeptVault.InvalidAttestation.selector);
        vault.onOracleResult(rid, a, sig);
    }

    function test_emptyAndMalleatedSignaturesAreRefused() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        vm.prank(address(intake));
        vm.expectRevert(OracleAttestationConsumer.BadSignature.selector);
        vault.onOracleResult(rid, a, "");

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, this.digestOf(a));
        bytes memory high =
            abi.encodePacked(r, bytes32(SECP256K1_N - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        vm.prank(address(intake));
        vm.expectRevert(OracleAttestationConsumer.BadSignature.selector);
        vault.onOracleResult(rid, a, high);

        // A "no" signature does not survive flipping the answer to "yes".
        OracleAttestation.Attestation memory b = _attestation(id, 0, false);
        bytes memory sigB = _sign(b, signerKey);
        b.answer = abi.encode(true);
        vm.prank(address(intake));
        vm.expectRevert(OracleAttestationConsumer.BadSignature.selector);
        vault.onOracleResult(rid, b, sigB);
    }

    function test_signatureForAnotherVaultIsRefused() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        KeptVault other = new KeptVault(owner, address(intake), address(imd), ACTION, signer, 9, 7);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, this.otherDigest(other, a));
        vm.prank(address(intake));
        vm.expectRevert(OracleAttestationConsumer.BadSignature.selector);
        vault.onOracleResult(rid, a, abi.encodePacked(r, s, v));
    }

    function otherDigest(KeptVault other, OracleAttestation.Attestation calldata a)
        external
        view
        returns (bytes32)
    {
        return other.attestationDigest(a);
    }

    /// @dev The worst-case callback (8 milestones, longest strings, rebate path) fits the Intake's
    /// 200k stipend.
    function test_worstCaseCallbackFitsTheStipend() public {
        vm.prank(stranger);
        vault.fundReferee(10 ether);
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](8);
        for (uint256 i; i < 8; ++i) {
            ms[i] = _page(uint64(T0 + 7 days + i), 1 ether);
            ms[i].title =
                "Title that is exactly one hundred and twenty characters long so that storage is as wide as allowed xxxxxxxxxxxxxxxxxxxxx";
            ms[i].b = "Eighty printable characters of literal search text for the KEPT page template xx";
        }
        assertEq(bytes(ms[0].title).length, 120);
        assertEq(bytes(ms[0].b).length, 80);
        uint256 id = _create(ms, 10 ether);
        bytes32 rid = _check(id, 7, beneficiary);
        uint256 used = _deliver(id, 7, rid, true);
        assertLt(used, 200_000);
        (KeptVault.Outcome o,) = _outcome(id, 7);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
    }

    // ---------------------------------------------------------------- custody

    function test_imdAsPledgeTokenStaysApartFromBudgets() public {
        vm.prank(creator);
        uint256 id = vault.createPledge(
            IERC20(address(imd)), beneficiary, "imd pledge", _one(_release(T0 + 7 days, 100 ether)), 0
        );
        assertEq(imd.balanceOf(address(vault)), 100 ether);
        assertEq(vault.totalBudgets(), 0);
        // Locked IMD can never pay for a check.
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.InsufficientBudget.selector, 0, PRICE));
        vault.check(id, 0);
        vm.prank(stranger);
        vault.fund(id, 1 ether);
        bytes32 rid = _check(id, 0, beneficiary);
        assertEq(imd.balanceOf(address(vault)), 100 ether + 0.5 ether);
        _deliver(id, 0, rid, true);
        vault.settle(id, 0);
        assertEq(imd.balanceOf(beneficiary), 100 ether);
        vault.withdrawBudget(id);
        assertEq(imd.balanceOf(address(vault)), 0);
    }

    function test_pledgesAreIsolated() public {
        uint256 a = _standard();
        uint256 b = _create(_one(_release(T0 + 7 days, 50 ether)), 1 ether);
        // Draining b's budget does not touch a's.
        bytes32 rid = _check(b, 0, beneficiary);
        _deliver(b, 0, rid, false);
        rid = _check(b, 0, beneficiary);
        vm.warp(T0 + TIMEOUT);
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.InsufficientBudget.selector, 0, PRICE));
        vault.check(b, 0);
        assertEq(_budget(a), 10 ether);
        bytes32 ridA = _check(a, 0, beneficiary);
        _deliver(a, 0, ridA, true);
        vault.settle(a, 0);
        (,,,,,,, uint128 lockedB,,,) = vault.pledge(b);
        assertEq(lockedB, 50 ether);
        assertEq(team.balanceOf(address(vault)), 50 ether);
    }

    function test_reentrantTokenCannotReenterSettle() public {
        ReentrantToken bad = new ReentrantToken();
        bad.mint(creator, 10 ether);
        vm.prank(creator);
        bad.approve(address(vault), type(uint256).max);
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](2);
        ms[0] = _release(T0 + 7 days, 1 ether);
        ms[1] = _release(T0 + 7 days, 1 ether);
        vm.prank(creator);
        uint256 id = vault.createPledge(IERC20(address(bad)), beneficiary, "re", ms, 1 ether);
        bytes32 rid = _check(id, 0, beneficiary);
        _deliver(id, 0, rid, true);
        bad.arm(vault, abi.encodeCall(KeptVault.settle, (id, 0)));
        vault.settle(id, 0);
        assertTrue(bad.attempted());
        assertFalse(bad.reentered(), "nested settle must fail");
        assertEq(bad.balanceOf(beneficiary), 1 ether, "paid exactly once");

        vm.warp(T0 + 7 days + GRACE + 1);
        bad.arm(vault, abi.encodeCall(KeptVault.withdrawBudget, (id)));
        vault.settle(id, 1);
        assertFalse(bad.reentered(), "nested withdraw must fail");
        (,,,,,, uint8 open,, uint256 budget,,) = vault.pledge(id);
        assertEq(open, 0);
        assertEq(budget, 1 ether - PRICE);
    }

    /// forge-config: default.fuzz.runs = 500
    function testFuzz_settlementSplitsExactly(uint8 n, uint256 seed, uint96 amount) public {
        n = uint8(bound(n, 1, 8));
        uint128 amt = uint128(bound(amount, 1, 1e24));
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](n);
        for (uint256 i; i < n; ++i) {
            ms[i] = _release(uint64(T0 + 2 days + i * 1 hours), uint128(amt + i));
        }
        uint256 id = _create(ms, uint256(n) * PRICE);
        uint256 expectPaid;
        uint256 expectBurned;
        for (uint8 i; i < n; ++i) {
            bool kept = (seed >> i) & 1 == 1;
            bytes32 rid = _check(id, i, beneficiary);
            _deliver(id, i, rid, kept);
            if (kept) expectPaid += amt + i;
            else expectBurned += amt + i;
        }
        vm.warp(T0 + 2 days + 8 hours + GRACE + 1);
        for (uint8 i; i < n; ++i) {
            vault.settle(id, i);
        }
        assertEq(team.balanceOf(beneficiary), expectPaid);
        assertEq(team.balanceOf(vault.BURN()), expectBurned);
        assertEq(team.balanceOf(address(vault)), 0);
        (,,,,,, uint8 open, uint128 locked, uint256 budget,,) = vault.pledge(id);
        assertEq(open, 0);
        assertEq(locked, 0);
        assertEq(budget, 0, "every check was paid from the exact budget");
        vm.expectRevert(KeptVault.NothingPending.selector);
        vault.withdrawBudget(id);
    }
}
