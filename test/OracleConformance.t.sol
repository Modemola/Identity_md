// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {KeptVault} from "../src/KeptVault.sol";
import {OracleAttestation} from "../src/OracleAttestation.sol";
import {Questions} from "../src/libraries/Questions.sol";
import {MockIntake} from "./mocks/MockIntake.sol";
import {FeeToken} from "./mocks/FeeToken.sol";

/// @dev Test-only exposure of the unchanged verifier, to accept the protocol's bytes32[] vector.
contract KeptConformanceHarness is KeptVault {
    constructor(address intake_, address imd_, address signer_)
        KeptVault(msg.sender, intake_, imd_, bytes32("oracle.request@oracle-1"), signer_, 5, 4)
    {}

    function verifyVector(OracleAttestation.Attestation calldata a, bytes calldata signature) external view {
        _verifyAttestation(a, signature);
    }
}

/// @title The IMD oracle-consumer conformance test, applied to KEPT
/// @notice Uses the protocol's own vector (values, digest and a signature made by `oracle-eip712.ts`,
/// as shipped with the `oracle-consumer` skill and AskOracle, launch 976). A consumer whose struct,
/// type string or EIP-712 domain differs from the protocol's passes self-signed tests and fails these.
contract OracleConformanceTest is Test {
    // ---- the protocol's vector: do not change these ----
    uint256 constant VECTOR_CHAIN = 11155111;
    address constant VECTOR_CONSUMER = 0x0000000000000000000000000000000000002748;
    bytes32 constant VECTOR_DIGEST = 0x95fefa8b7c529852f4e2b6aec888930eb2bf5078e6443a85808e36df19e1325c;
    bytes constant VECTOR_SIGNATURE =
        hex"a26b14918607eb565af126beb54d3c5d19e923c41506def500b3521a4f9aa6d603ab44fd22f15dd2191732961a7131e4641244add8b0f09f20e6ae64381be8481b";
    /// @dev anvil's second account: the vector's attester. A test key, never a real one.
    address constant SIGNER = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    uint256 constant SIGNER_KEY = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint64 constant ISSUED_AT = 1800000000;
    uint64 constant EXPIRES_AT = 1800003600;
    string constant CALLBACK =
        "onOracleResult(bytes32,(bytes32,uint256,bytes32,uint8,bytes,uint256,uint64,uint64,bytes32,bytes32,uint16,uint16,uint16,uint64,uint64),bytes)";

    MockIntake intake;
    FeeToken imd;
    FeeToken team;
    KeptConformanceHarness consumer;

    function setUp() public {
        vm.chainId(VECTOR_CHAIN);
        vm.warp(ISSUED_AT);
        intake = new MockIntake(address(0x717E));
        imd = new FeeToken(false);
        team = new FeeToken(false);
        deployCodeTo(
            "OracleConformance.t.sol:KeptConformanceHarness",
            abi.encode(address(intake), address(imd), SIGNER),
            VECTOR_CONSUMER
        );
        consumer = KeptConformanceHarness(VECTOR_CONSUMER);
    }

    function vector() internal pure returns (OracleAttestation.Attestation memory a) {
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = bytes32(uint256(1));
        a = OracleAttestation.Attestation({
            requestId: 0x0000000000004000800000000000000100000000000000000000000000000000,
            chainId: 1,
            questionHash: 0x2117f4362ebfa37aa8a8c0fed548604fe09ac46faf8ae7559cd64780f26a46fb,
            answerType: OracleAttestation.ANSWER_BYTES32_LIST,
            answer: abi.encode(ids),
            figure: 12345,
            fromBlock: 100,
            toBlock: 200,
            blockHash: bytes32(uint256(7)),
            panelJobId: 0x0000000000004000800000000000000200000000000000000000000000000000,
            panelSize: 5,
            quorum: 4,
            agreed: 5,
            issuedAt: ISSUED_AT,
            expiresAt: EXPIRES_AT
        });
    }

    function test_digestMatchesTheProtocol() public view {
        assertEq(consumer.attestationDigest(vector()), VECTOR_DIGEST, "struct, type string or domain differs");
    }

    function test_callbackSelectorIsCanonical() public view {
        assertEq(consumer.onOracleResult.selector, bytes4(keccak256(bytes(CALLBACK))));
    }

    function test_acceptsTheProtocolSignature() public view {
        consumer.verifyVector(vector(), VECTOR_SIGNATURE);
    }

    /// @notice A full KEPT round trip with a fresh signature from the vector's key, through the Intake.
    function test_keptVerdictFromTheVectorKey() public {
        team.approve(address(consumer), type(uint256).max);
        imd.approve(address(consumer), type(uint256).max);
        KeptVault.MilestoneInput[] memory ms = new KeptVault.MilestoneInput[](1);
        ms[0].kind = Questions.Kind.ContractDeployed;
        ms[0].deadline = ISSUED_AT + 1 days;
        ms[0].amount = 1 ether;
        ms[0].chainId = 1;
        ms[0].target = address(0xBEEF);
        ms[0].title = "Deployed";
        uint256 id = consumer.createPledge(IERC20(address(team)), address(0xB0B), "vector", ms, 1 ether);
        bytes32 rid = consumer.check(id, 0);

        OracleAttestation.Attestation memory a = vector();
        a.answerType = OracleAttestation.ANSWER_BOOL;
        a.answer = abi.encode(true);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, consumer.attestationDigest(a));
        (bool ok,,) = intake.deliver(rid, a, abi.encodePacked(r, s, v));
        assertTrue(ok);
        consumer.settle(id, 0);
        assertEq(team.balanceOf(address(0xB0B)), 1 ether);
    }
}
