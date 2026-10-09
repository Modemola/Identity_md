// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIntake} from "../../src/interfaces/IIntake.sol";
import {OracleAttestation} from "../../src/OracleAttestation.sol";

/// @notice Behaves like the IMD Intake: pulls exactly the price, emits nothing we rely on, and later
/// delivers the answer through a 200k-gas callback inside a try, so a reverting consumer cannot
/// block the write. `deliver` reports whether the callback succeeded and the gas it used.
contract MockIntake is IIntake {
    uint256 public price = 0.5 ether;
    address public immutable treasury;
    uint256 public nonce;
    bytes public lastBody;
    bool public skipPull;
    bool public repeatId;
    bytes32 public lastId;
    mapping(bytes32 => Callback) public callbacks;

    constructor(address treasury_) {
        treasury = treasury_;
    }

    function setPrice(uint256 value) external {
        price = value;
    }

    function setSkipPull(bool value) external {
        skipPull = value;
    }

    function setRepeatId(bool value) external {
        repeatId = value;
    }

    function priceOf(bytes32, address) external view returns (uint256) {
        return price;
    }

    function request(bytes32, bytes calldata body, Callback calldata callback, address asset, uint256 amount)
        external
        payable
        returns (bytes32 requestId)
    {
        require(amount >= price, "PriceNotMet");
        if (!skipPull) IERC20(asset).transferFrom(msg.sender, treasury, amount);
        lastBody = body;
        requestId = repeatId && lastId != bytes32(0) ? lastId : keccak256(abi.encode(address(this), ++nonce));
        lastId = requestId;
        callbacks[requestId] = callback;
    }

    function deliver(bytes32 requestId, OracleAttestation.Attestation calldata a, bytes calldata signature)
        external
        returns (bool ok, uint256 gasUsed, bytes memory reason)
    {
        Callback memory c = callbacks[requestId];
        bytes memory data = abi.encodeWithSelector(c.selector, requestId, a, signature);
        uint256 start = gasleft();
        (ok, reason) = c.target.call{gas: 200_000}(data);
        gasUsed = start - gasleft();
    }
}
