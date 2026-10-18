// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVault} from "../src/KeptVault.sol";
import {OracleAttestation} from "../src/OracleAttestation.sol";
import {Questions} from "../src/libraries/Questions.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";
import {MockIntake} from "./mocks/MockIntake.sol";

/// @notice Regression coverage for the imported deadline, attempt and price findings.
contract KeptVaultAuditTest is VaultFixture {
    function _snapshot(uint8 kind, uint64 deadline) internal view returns (KeptVault.MilestoneInput memory) {
        if (kind == 1) return _page(deadline, 100 ether);
        if (kind == 2) return _deployed(deadline, 100 ether, 4663, address(team));
        return _value(deadline, 100 ether, address(team), 1 ether);
    }

    // 402848657cad: grace must not make a missed snapshot deadline payable.
    function testFuzz_snapshotCheckClosesAtDeadline(uint8 kind, uint32 lateBy) public {
        kind = uint8(bound(kind, 1, 3));
        uint64 deadline = T0 + 7 days;
        uint256 id = _create(_one(_snapshot(kind, deadline)), 10 ether);
        vm.warp(uint256(deadline) + bound(lateBy, 1, 3 days));
        (bool open, bool funded) = vault.checkOpen(id, 0);
        assertFalse(open);
        assertFalse(funded);
        vm.startPrank(beneficiary);
        vm.expectRevert(KeptVault.CheckWindowClosed.selector);
        vault.check(id, 0);
        vm.expectRevert(KeptVault.CheckWindowClosed.selector);
        vault.check(id, 0, PRICE);
        vm.stopPrank();
        assertEq(_budget(id), 10 ether);
        (,,,,,, uint8 attempts,,) = vault.milestone(id, 0);
        assertEq(attempts, 0);
        vm.warp(uint256(deadline) + 5 days);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 0);
        assertEq(team.balanceOf(vault.BURN()), 100 ether);
    }

    function testFuzz_snapshotRejectsVerdictIssuedAfterDeadline(uint8 kind, uint32 lateBy) public {
        kind = uint8(bound(kind, 1, 3));
        uint64 deadline = T0 + 7 days;
        uint256 id = _create(_one(_snapshot(kind, deadline)), 10 ether);
        vm.prank(stranger);
        vault.fundReferee(PRICE);
        vm.warp(deadline - 1 minutes);
        bytes32 rid = _check(id, 0, beneficiary);
        vm.warp(uint256(deadline) + bound(lateBy, 1, 3 days));
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        (bool ok,, bytes memory reason) = intake.deliver(rid, a, _sign(a, signerKey));
        assertFalse(ok, "a pending ask must not accept a late snapshot");
        assertEq(reason, abi.encodeWithSelector(KeptVault.InvalidAttestation.selector));
        assertFalse(vault.consumed(a.requestId));
        (KeptVault.Outcome outcome,) = _outcome(id, 0);
        assertEq(uint8(outcome), uint8(KeptVault.Outcome.Open));
        assertEq(vault.refereeFund(), PRICE, "no rebate for a refused verdict");
        vm.warp(uint256(deadline) + 5 days);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 0);
        assertEq(team.balanceOf(vault.BURN()), 100 ether);
    }

    function testFuzz_snapshotSignedAtDeadlineCanArriveLater(uint8 kind, uint32 delay) public {
        kind = uint8(bound(kind, 1, 3));
        uint64 deadline = T0 + 7 days;
        uint256 id = _create(_one(_snapshot(kind, deadline)), 10 ether);
        vm.prank(stranger);
        vault.fundReferee(PRICE);
        vm.warp(deadline);
        (bool open, bool funded) = vault.checkOpen(id, 0);
        assertTrue(open && funded, "deadline is inclusive");
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        bytes memory signature = _sign(a, signerKey);
        vm.warp(uint256(deadline) + bound(delay, 1, 1 days));
        (bool ok, uint256 used,) = intake.deliver(rid, a, signature);
        assertTrue(ok, "timely signed evidence survives delayed delivery");
        assertLt(used, 200_000);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 100 ether);
        assertEq(_budget(id), 10 ether, "rebate remains available");
    }

    function test_githubPublicationDeadlineStillAllowsGraceCheck() public {
        uint256 id = _standard();
        vm.warp(T0 + 9 days);
        (bool open, bool funded) = vault.checkOpen(id, 0);
        assertTrue(open && funded);
        bytes32 rid = _check(id, 0, beneficiary);
        _deliver(id, 0, rid, true);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 100 ether);
    }

    // fb69143f635a: the depositor cannot consume a different beneficiary's attempts.
    function test_creatorCannotExhaustBeneficiaryAttempts() public {
        uint64 deadline = T0 + 30 days;
        uint256 id = _create(_one(_release(deadline, 100 ether)), 5 ether);
        for (uint256 i; i < 3; ++i) {
            vm.warp(T0 + i * 1 days);
            vm.prank(creator);
            vm.expectRevert(KeptVault.NotAllowed.selector);
            vault.check(id, 0);
        }
        (,,,,,, uint8 attempts,,) = vault.milestone(id, 0);
        assertEq(attempts, 0);
        assertEq(_budget(id), 5 ether);
        vm.warp(deadline - 1 hours);
        bytes32 rid = _check(id, 0, beneficiary);
        _deliver(id, 0, rid, true);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 100 ether);
    }

    function test_creatorCanCheckWhenAlsoBeneficiary() public {
        vm.prank(creator);
        uint256 id = vault.createPledge(
            IERC20(address(team)), creator, "self funded", _one(_release(T0 + 7 days, 100 ether)), 1 ether
        );
        bytes32 rid = _check(id, 0, creator);
        _deliver(id, 0, rid, true);
        uint256 before = team.balanceOf(creator);
        vault.settle(id, 0);
        assertEq(team.balanceOf(creator) - before, 100 ether);
    }

    function test_creatorCannotUseExplicitPriceCheckOrClearStaleAsSideEffect() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        vm.warp(T0 + 1 days);
        vm.prank(creator);
        vm.expectRevert(KeptVault.NotAllowed.selector);
        vault.check(id, 0, PRICE);
        (,,,,,, uint8 attempts, bytes32 inFlight,) = vault.milestone(id, 0);
        assertEq(inFlight, rid);
        assertEq(attempts, 1);
        assertEq(_budget(id), 10 ether - PRICE);
    }

    // dab3a05f3869: both entry points enforce a price ceiling before spending anything.
    function test_defaultPriceCapRejectsRepricedIntake() public {
        uint256 id = _standard();
        intake.setPrice(10 ether);
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.PriceAboveLimit.selector, 10 ether, PRICE));
        vault.check(id, 0);
        assertEq(_budget(id), 10 ether);
        assertEq(vault.totalBudgets(), 10 ether);
        assertEq(imd.balanceOf(treasury), 0);
        assertEq(imd.allowance(address(vault), address(intake)), 0);
        assertEq(intake.nonce(), 0);
        (,,,,,, uint8 attempts,,) = vault.milestone(id, 0);
        assertEq(attempts, 0);
    }

    function test_defaultPriceCapSurvivesTimelockedIntakeReplacement() public {
        uint256 id = _create(_one(_release(T0 + 30 days, 100 ether)), 100 ether);
        MockIntake replacement = new MockIntake(treasury);
        replacement.setPrice(100 ether);
        vm.prank(owner);
        vault.proposeProtocol(address(replacement), ACTION, signer);
        vm.warp(T0 + 7 days);
        vault.executeProtocol();
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.PriceAboveLimit.selector, 100 ether, PRICE));
        vault.check(id, 0);
        assertEq(_budget(id), 100 ether);
        assertEq(imd.balanceOf(treasury), 0);
        assertEq(imd.allowance(address(vault), address(replacement)), 0);
    }

    function testFuzz_explicitPriceLimit(uint96 price, uint96 maxPrice) public {
        price = uint96(bound(price, 1, 100 ether));
        maxPrice = uint96(bound(maxPrice, 0, 100 ether));
        uint256 id = _create(_one(_release(T0 + 7 days, 100 ether)), 100 ether);
        intake.setPrice(price);
        (bool open, bool funded) = vault.checkOpen(id, 0, maxPrice);
        assertTrue(open);
        assertEq(funded, price <= maxPrice);
        vm.prank(beneficiary);
        if (price > maxPrice) {
            vm.expectRevert(abi.encodeWithSelector(KeptVault.PriceAboveLimit.selector, price, maxPrice));
            vault.check(id, 0, maxPrice);
            assertEq(_budget(id), 100 ether);
            assertEq(imd.balanceOf(treasury), 0);
        } else {
            bytes32 rid = vault.check(id, 0, maxPrice);
            assertTrue(rid != bytes32(0));
            assertEq(_budget(id), 100 ether - price);
            assertEq(imd.balanceOf(treasury), price, "pay the quote, not the ceiling");
        }
        assertEq(imd.allowance(address(vault), address(intake)), 0);
    }

    function test_explicitCapCanAcceptNewPriceAndRebateActualPrice() public {
        uint256 id = _standard();
        intake.setPrice(1 ether);
        vm.prank(stranger);
        vault.fundReferee(2 ether);
        vm.prank(beneficiary);
        bytes32 rid = vault.check(id, 0, 2 ether);
        assertEq(_budget(id), 9 ether);
        _deliver(id, 0, rid, true);
        assertEq(_budget(id), 10 ether);
        assertEq(vault.refereeFund(), 1 ether);
        assertEq(imd.balanceOf(treasury), 1 ether);
    }

    function test_priceCapFailureDoesNotClearStaleCheck() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        vm.warp(T0 + 1 days);
        intake.setPrice(1 ether);
        vm.prank(beneficiary);
        vm.expectRevert(abi.encodeWithSelector(KeptVault.PriceAboveLimit.selector, 1 ether, PRICE));
        vault.check(id, 0);
        (,,,,,, uint8 attempts, bytes32 inFlight,) = vault.milestone(id, 0);
        assertEq(inFlight, rid);
        assertEq(attempts, 1);
        assertEq(_budget(id), 10 ether - PRICE);
    }

    function test_checkOpenDistinguishesDefaultAndExplicitPriceCaps() public {
        uint256 id = _standard();
        intake.setPrice(1 ether);
        (bool open, bool funded) = vault.checkOpen(id, 0);
        assertTrue(open);
        assertFalse(funded);
        (open, funded) = vault.checkOpen(id, 0, 1 ether);
        assertTrue(open && funded);
    }

    function test_zeroQuoteRemainsInvalidEvenWithExplicitCap() public {
        uint256 id = _standard();
        intake.setPrice(0);
        vm.prank(beneficiary);
        vm.expectRevert(KeptVault.InvalidConfiguration.selector);
        vault.check(id, 0, PRICE);
    }
}
