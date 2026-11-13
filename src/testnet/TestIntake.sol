// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IIntake} from "../interfaces/IIntake.sol";
import {OracleAttestation} from "../OracleAttestation.sol";

/// @title KEPT test Intake, for testnets the IMD oracle does not serve
/// @notice Stands in for IMD's Intake on a testnet such as Robinhood Chain testnet (46630), where
/// vibe/vibe runs and IMD has no Intake. A vault asks it for a check exactly as it asks IMD: the
/// same `priceOf` and `request`, paid in the vault's IMD, with the same `Requested` event. The
/// answer comes from KEPT's test oracle instead of the IMD swarm: the operator delivers an
/// attestation signed by the vault's oracle signer, and the vault checks it exactly as it checks
/// IMD's. Verdicts on a vault wired to this Intake are test verdicts and must be labelled so.
/// @dev Each request is delivered at most once, and only by the operator. The callback gets 200k
/// gas, like IMD's, so a vault that passes here fits IMD's budget.
contract TestIntake is IIntake {
    using SafeERC20 for IERC20;

    event Requested(
        bytes32 indexed requestId,
        address indexed consumer,
        bytes32 indexed action,
        bytes body,
        address target,
        bytes4 selector,
        address asset,
        uint256 amount
    );
    event Delivered(bytes32 indexed requestId, bool ok, bytes reason);
    event PriceSet(uint256 price);
    event OperatorSet(address operator);

    error NotOperator();
    error PriceNotMet(uint256 amount, uint256 price);
    error UnknownRequest();

    address public operator;
    address public immutable treasury;
    uint256 public price;
    uint256 public nonce;
    mapping(bytes32 => Callback) public callbacks;

    constructor(address operator_, address treasury_, uint256 price_) {
        operator = operator_;
        treasury = treasury_;
        price = price_;
        emit OperatorSet(operator_);
        emit PriceSet(price_);
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    function priceOf(bytes32, address) external view returns (uint256) {
        return price;
    }

    function request(bytes32 action, bytes calldata body, Callback calldata callback, address asset, uint256 amount)
        external
        payable
        returns (bytes32 requestId)
    {
        if (amount < price) revert PriceNotMet(amount, price);
        IERC20(asset).safeTransferFrom(msg.sender, treasury, amount);
        requestId = keccak256(abi.encode(address(this), block.chainid, ++nonce));
        callbacks[requestId] = callback;
        emit Requested(requestId, msg.sender, action, body, callback.target, callback.selector, asset, amount);
    }

    /// @notice Hands a signed verdict to the vault that asked. The vault verifies the signature.
    function deliver(bytes32 requestId, OracleAttestation.Attestation calldata a, bytes calldata signature)
        external
        onlyOperator
        returns (bool ok, bytes memory reason)
    {
        Callback memory c = callbacks[requestId];
        if (c.target == address(0)) revert UnknownRequest();
        (ok, reason) = c.target.call{gas: 200_000}(abi.encodeWithSelector(c.selector, requestId, a, signature));
        // a refused verdict leaves the request open, so a corrected one can follow
        if (ok) delete callbacks[requestId];
        emit Delivered(requestId, ok, reason);
    }

    function setPrice(uint256 price_) external onlyOperator {
        price = price_;
        emit PriceSet(price_);
    }

    function setOperator(address operator_) external onlyOperator {
        operator = operator_;
        emit OperatorSet(operator_);
    }
}
