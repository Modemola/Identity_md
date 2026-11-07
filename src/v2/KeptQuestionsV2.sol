// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {QuestionsV2} from "./QuestionsV2.sol";

/// @title KEPT v2 question builder
/// @notice Validates milestone inputs and writes the oracle body for KeptVaultV2. It holds no state
/// and no tokens: it is the vault's sentence and date code, deployed beside it to keep the vault
/// under the 24 KB contract size limit. The vault takes its address at deploy and never changes it.
contract KeptQuestionsV2 {
    function validate(QuestionsV2.Spec calldata s) external pure {
        QuestionsV2.validate(s);
    }

    function body(QuestionsV2.Spec calldata s, uint64 deadline, uint64 at, uint16 panelSize, uint16 quorum, uint32 validFor)
        external
        view
        returns (bytes memory)
    {
        return QuestionsV2.body(s, deadline, at, panelSize, quorum, validFor);
    }

    function question(QuestionsV2.Spec calldata s, uint64 deadline, uint64 at) external pure returns (string memory) {
        return QuestionsV2.question(s, deadline, at);
    }
}
