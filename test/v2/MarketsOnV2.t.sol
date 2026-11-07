// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {KeptVaultV2 as KeptVault} from "../../src/v2/KeptVaultV2.sol";
import {KeptMarkets} from "../../src/KeptMarkets.sol";
import {OracleAttestation} from "../../src/OracleAttestation.sol";
import {QuestionsV2 as Questions} from "../../src/v2/QuestionsV2.sol";
import {VaultFixtureV2 as VaultFixture} from "./VaultFixtureV2.sol";

/// Markets on a v2 vault: a partial delivery pays NO; a full one pays YES.
contract MarketsOnV2Test is VaultFixture {
    KeptMarkets internal markets;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    uint64 internal constant DEADLINE = T0 + 7 days;

    function setUp() public override {
        super.setUp();
        markets = new KeptMarkets(address(vault), owner, 1_000 ether);
        address[2] memory who = [alice, bob];
        for (uint256 i; i < 2; ++i) {
            imd.mint(who[i], 1_000 ether);
            vm.prank(who[i]);
            imd.approve(address(markets), type(uint256).max);
        }
    }

    function _scaledPledge() internal returns (uint256 id) {
        KeptVault.MilestoneInput memory m = _value(DEADLINE, 150 ether, address(team), 5 ether);
        m.kind = Questions.Kind.ValueScaled;
        m.a = "collected()";
        id = _create(_one(m), 10 ether);
    }

    function _score(uint256 id, uint256 value) internal {
        vm.warp(DEADLINE + 1 hours);
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        a.answerType = OracleAttestation.ANSWER_UINT256;
        a.answer = abi.encode(value);
        (bool ok,,) = intake.deliver(rid, a, _sign(a, signerKey));
        assertTrue(ok);
    }

    function _bets(uint256 id) internal {
        vm.prank(alice);
        markets.bet(id, 0, true, 100 ether);
        vm.prank(bob);
        markets.bet(id, 0, false, 100 ether);
    }

    function test_partialPaysNo() public {
        uint256 id = _scaledPledge();
        _bets(id);
        _score(id, 3 ether); // 60%
        markets.resolve(id, 0);
        assertEq(uint8(markets.market(id, 0).state), uint8(KeptMarkets.State.No));
        vm.prank(bob);
        assertEq(markets.claim(id, 0), 100 ether + 98 ether);
    }

    function test_fullScorePaysYes() public {
        uint256 id = _scaledPledge();
        _bets(id);
        _score(id, 5 ether);
        markets.resolve(id, 0);
        assertEq(uint8(markets.market(id, 0).state), uint8(KeptMarkets.State.Yes));
    }
}
