// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice The parts of KeptVault that KeptMarkets reads and calls. Enums travel as uint8:
/// Outcome is 0 Open, 1 Kept, 2 Broken.
interface IKeptVault {
    function imd() external view returns (address);

    function GRACE() external view returns (uint256);

    function pledge(uint256 pledgeId)
        external
        view
        returns (
            address creator,
            address beneficiary,
            address token,
            string memory name,
            uint64 createdAt,
            uint8 count,
            uint8 open,
            uint128 locked,
            uint256 budget,
            uint16 panelSize,
            uint16 quorum
        );

    function milestone(uint256 pledgeId, uint8 index)
        external
        view
        returns (
            uint8 kind,
            string memory title,
            uint64 deadline,
            uint128 amount,
            uint8 outcome,
            bool settled,
            uint8 attempts,
            bytes32 inFlight,
            uint64 askedAt
        );

    function settle(uint256 pledgeId, uint8 index) external;

    function fund(uint256 pledgeId, uint256 amount) external;

    function fundReferee(uint256 amount) external;
}
