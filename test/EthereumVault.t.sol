// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {KeptVault} from "../src/KeptVault.sol";
import {OracleAttestation} from "../src/OracleAttestation.sol";
import {Questions} from "../src/libraries/Questions.sol";
import {VaultFixture} from "./helpers/VaultFixture.sol";

/// The same source deployed on Ethereum: panel questions are pinned to Ethereum, verdicts must say
/// so, chain-evidence questions keep the chain they name, and a Robinhood verdict cannot be replayed.
contract EthereumVaultTest is VaultFixture {
    function setUp() public override {
        vm.chainId(1);
        super.setUp();
    }

    function _contains(string memory hay, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i <= h.length - n.length; i++) {
            bool hit = true;
            for (uint256 j; j < n.length && hit; j++) {
                if (h[i + j] != n[j]) hit = false;
            }
            if (hit) return true;
        }
        return false;
    }

    function test_panelQuestionsArePinnedToEthereum() public {
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](2);
        ms[0] = _release(T0 + 7 days, 50 ether);
        ms[1] = _page(T0 + 7 days, 50 ether);
        uint256 id = _create(ms, 10 ether);
        for (uint8 i; i < 2; i++) {
            string memory body = vault.questionOf(id, i);
            assertTrue(_contains(body, '"chainId":1,'), "panel body names Ethereum");
            assertFalse(_contains(body, "4663"), "and never Robinhood");
            assertEq(Questions.questionChain(vault.milestoneSpec(id, i)), 1);
        }
    }

    function test_chainEvidenceKeepsTheChainItNames() public {
        uint256 id = _create(_one(_deployed(T0 + 7 days, 100 ether, 8453, address(0xBEEF))), 10 ether);
        assertTrue(_contains(vault.questionOf(id, 0), '"chainId":8453,'), "a Base contract stays a Base question");
    }

    function test_keptOnEthereumPaysTheBeneficiary() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        _deliver(id, 0, rid, true);
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Kept));
        vm.prank(stranger);
        vault.settle(id, 0);
        assertEq(team.balanceOf(beneficiary), 100 ether);
    }

    function test_rejectsAVerdictAboutRobinhood() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        a.chainId = 4663;
        (bool ok,, bytes memory reason) = intake.deliver(rid, a, _sign(a, signerKey));
        assertFalse(ok);
        assertEq(bytes4(reason), KeptVault.InvalidAttestation.selector);
    }

    function test_rejectsASignatureMadeForTheRobinhoodVault() public {
        uint256 id = _standard();
        bytes32 rid = _check(id, 0, beneficiary);
        OracleAttestation.Attestation memory a = _attestation(id, 0, true);
        // the same verdict signed under Robinhood's domain (chain id 4663): EIP-712 binds the chain
        vm.chainId(4663);
        bytes memory robinhoodSig = _sign(a, signerKey);
        vm.chainId(1);
        (bool ok,,) = intake.deliver(rid, a, robinhoodSig);
        assertFalse(ok, "a signature for another chain's vault is refused");
        (KeptVault.Outcome o,) = _outcome(id, 0);
        assertEq(uint8(o), uint8(KeptVault.Outcome.Open));
    }
}
