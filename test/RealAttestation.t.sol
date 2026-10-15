// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {OracleAttestation} from "../src/OracleAttestation.sol";

/// @title A production IMD oracle signature, verified with KEPT's attestation code
/// @notice Robinhood Chain request 2cbdce1f-1eb9-4a87-ba4c-2ec8ce244392, attested 2026-10-08T21:41Z,
/// read from https://api.imd.fun/oracle/requests/2cbdce1f-1eb9-4a87-ba4c-2ec8ce244392/attestation.
/// It was bought over HTTP, so its domain names no consumer (verifyingContract = 0). The struct hash
/// is KEPT's own `OracleAttestation.hashStruct`; recovering the live signer from it proves the struct,
/// type string and domain name/version KEPT verifies are byte-for-byte what the oracle signs today.
contract RealAttestationTest is Test {
    address constant LIVE_SIGNER = 0x5598Aa9146215Bc13eb26f2c692Ad1461Fd32982;
    bytes constant SIGNATURE =
        hex"81669356f8b9d2e3b5854303a193d4414a3e6dac47ab6df1972920fb6845e859135d8ef89115581fea756ee5264e787f87b4f9874bf31e34baa64fae21cbc77b1b";

    function attestation() internal pure returns (OracleAttestation.Attestation memory a) {
        a = OracleAttestation.Attestation({
            requestId: 0x2cbdce1f1eb94a87ba4c2ec8ce24439200000000000000000000000000000000,
            chainId: 4663,
            questionHash: 0x5314705c02b03f154a7c1633d3eb4784f89e15b91c444787eac4d7a51fa3308e,
            answerType: OracleAttestation.ANSWER_UINT256,
            answer: abi.encode(uint256(209)),
            figure: 209,
            fromBlock: 83589740,
            toBlock: 83607333,
            blockHash: 0x9ff64874996e35de3bbefa662cfcd826a8bc745e78a120e509f8b5850330a9c6,
            panelJobId: 0x80fb156863ef40dbb74e08bc8da9932900000000000000000000000000000000,
            panelSize: 200,
            quorum: 140,
            agreed: 139,
            issuedAt: 1791495679,
            expiresAt: 1791517279
        });
    }

    function structHash(OracleAttestation.Attestation calldata a) external pure returns (bytes32) {
        return OracleAttestation.hashStruct(a);
    }

    function test_liveSignatureRecoversTheLiveSigner() public view {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(OracleAttestation.DOMAIN_NAME)),
                keccak256(bytes(OracleAttestation.DOMAIN_VERSION)),
                uint256(4663),
                address(0)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domain, this.structHash(attestation())));
        bytes memory sig = SIGNATURE;
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly ("memory-safe") {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        assertEq(ecrecover(digest, v, r, s), LIVE_SIGNER);
    }
}
