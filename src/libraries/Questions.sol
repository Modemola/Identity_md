// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Builds the oracle body for a KEPT milestone and validates the strings that go into it.
/// @dev Every user string is checked against a narrow character set before it is placed in the
/// question, so no input can close the JSON string, inject a field or rewrite the sentence with
/// quotes. The body follows the IMD `oracle body` shape that `POST /requests/check` accepts.
library Questions {
    enum Kind {
        GithubRelease,
        PageContains,
        ContractDeployed,
        ValueAtLeast
    }

    struct Spec {
        Kind kind;
        uint64 chainId;
        address target;
        uint256 threshold;
        string a;
        string b;
    }

    error BadParameter(uint8 field);
    error UnsupportedChain(uint64 chainId);

    uint64 internal constant HOME_CHAIN = 4663;

    /// @notice The chain the question is about, which the attestation's `chainId` must equal.
    function questionChain(Spec memory s) internal pure returns (uint64) {
        return s.kind == Kind.ContractDeployed || s.kind == Kind.ValueAtLeast ? s.chainId : HOME_CHAIN;
    }

    function isChainEvidence(Kind kind) internal pure returns (bool) {
        return kind == Kind.ContractDeployed || kind == Kind.ValueAtLeast;
    }

    /// @notice Reverts unless the spec can produce a well-formed, unambiguous question.
    function validate(Spec memory s) internal pure {
        if (s.kind == Kind.GithubRelease) {
            if (!_isRepo(bytes(s.a))) revert BadParameter(0);
            if (!_isToken(bytes(s.b), 1, 64)) revert BadParameter(1);
        } else if (s.kind == Kind.PageContains) {
            if (!_isUrl(bytes(s.a))) revert BadParameter(0);
            if (!_isText(bytes(s.b))) revert BadParameter(1);
        } else if (s.kind == Kind.ContractDeployed) {
            _chain(s.chainId);
            if (s.target == address(0)) revert BadParameter(2);
            if (bytes(s.a).length != 0 || bytes(s.b).length != 0) revert BadParameter(0);
        } else {
            _chain(s.chainId);
            if (s.target == address(0)) revert BadParameter(2);
            if (!_isViewCall(bytes(s.a))) revert BadParameter(0);
            if (bytes(s.b).length != 0) revert BadParameter(1);
        }
    }

    /// @notice The compact UTF-8 JSON oracle body for one check.
    function body(Spec memory s, uint64 deadline, uint16 panelSize, uint16 quorum, uint32 validFor)
        internal
        pure
        returns (bytes memory)
    {
        return bytes(
            string.concat(
                '{"v":1,"question":"',
                question(s, deadline),
                '","chainId":',
                Strings.toString(questionChain(s)),
                ',"window":{"hours":1},"answerType":"bool","evidence":"',
                isChainEvidence(s.kind) ? "chain" : "panel",
                '","panelSize":',
                Strings.toString(panelSize),
                ',"quorum":',
                Strings.toString(quorum),
                ',"validForSeconds":',
                Strings.toString(validFor),
                "}"
            )
        );
    }

    /// @notice The question sentence. Contains no double quotes or backslashes by construction.
    function question(Spec memory s, uint64 deadline) internal pure returns (string memory) {
        string memory lead = "KEPT milestone check. ";
        if (s.kind == Kind.GithubRelease) {
            return string.concat(
                lead,
                "Does the public GitHub repository https://github.com/",
                s.a,
                " have a published GitHub Release (not a draft, not only a git tag) whose tag name is exactly '",
                s.b,
                "', published at or before ",
                isoDate(deadline),
                "? Answer true only if such a release exists and meets every condition; otherwise answer false."
            );
        }
        if (s.kind == Kind.PageContains) {
            return string.concat(
                lead,
                "Fetch ",
                s.a,
                " now. Does it respond successfully and contain the exact text '",
                s.b,
                "' (case-sensitive) in the returned content? Answer true only if it does; otherwise answer false."
            );
        }
        if (s.kind == Kind.ContractDeployed) {
            return string.concat(
                lead,
                "On chain id ",
                Strings.toString(s.chainId),
                ", does the address ",
                Strings.toHexString(s.target),
                " have deployed contract bytecode (code size greater than zero) at the window's closing block?",
                " Answer true or false."
            );
        }
        return string.concat(
            lead,
            "On chain id ",
            Strings.toString(s.chainId),
            ", call the view function ",
            s.a,
            " on the contract ",
            Strings.toHexString(s.target),
            " at the window's closing block. Is the returned uint256 greater than or equal to ",
            Strings.toString(s.threshold),
            "? Answer false if the call reverts or does not return a uint256. Answer true or false."
        );
    }

    /// @notice `YYYY-MM-DDTHH:MM:SSZ` for a Unix timestamp (proleptic Gregorian, UTC).
    function isoDate(uint256 ts) internal pure returns (string memory) {
        uint256 secs = ts % 86400;
        // Howard Hinnant's civil_from_days, shifted so the era arithmetic stays unsigned.
        uint256 z = ts / 86400 + 719468;
        uint256 era = z / 146097;
        uint256 doe = z - era * 146097;
        uint256 yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
        uint256 doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        uint256 mp = (5 * doy + 2) / 153;
        uint256 d = doy - (153 * mp + 2) / 5 + 1;
        uint256 m = mp < 10 ? mp + 3 : mp - 9;
        uint256 y = yoe + era * 400 + (m <= 2 ? 1 : 0);
        return string.concat(
            _pad(y, 4),
            "-",
            _pad(m, 2),
            "-",
            _pad(d, 2),
            "T",
            _pad(secs / 3600, 2),
            ":",
            _pad((secs % 3600) / 60, 2),
            ":",
            _pad(secs % 60, 2),
            "Z"
        );
    }

    function _pad(uint256 v, uint256 width) private pure returns (string memory out) {
        out = Strings.toString(v);
        while (bytes(out).length < width) out = string.concat("0", out);
    }

    function _chain(uint64 id) private pure {
        if (id != 1 && id != 56 && id != 4663 && id != 8453 && id != 42161) revert UnsupportedChain(id);
    }

    function _alnum(bytes1 c) private pure returns (bool) {
        return (c >= "0" && c <= "9") || (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
    }

    /// @dev Letters, digits and `extra`, length within [min, max].
    function _isToken(bytes memory s, uint256 min, uint256 max) private pure returns (bool) {
        if (s.length < min || s.length > max) return false;
        for (uint256 i; i < s.length; ++i) {
            bytes1 c = s[i];
            if (!_alnum(c) && c != "." && c != "-" && c != "_" && c != "+") return false;
        }
        return true;
    }

    /// @dev `owner/name`: one slash, each side 1–100 of [A-Za-z0-9._-], no leading dot.
    function _isRepo(bytes memory s) private pure returns (bool) {
        if (s.length < 3 || s.length > 140) return false;
        uint256 slash = type(uint256).max;
        for (uint256 i; i < s.length; ++i) {
            bytes1 c = s[i];
            if (c == "/") {
                if (slash != type(uint256).max) return false;
                slash = i;
            } else if (!_alnum(c) && c != "." && c != "-" && c != "_") {
                return false;
            }
        }
        if (slash == type(uint256).max || slash == 0 || slash == s.length - 1) return false;
        return s[0] != "." && s[slash + 1] != ".";
    }

    /// @dev `https://` followed by 4–200 URL characters, no quotes, spaces, backslashes or controls.
    function _isUrl(bytes memory s) private pure returns (bool) {
        bytes memory scheme = bytes("https://");
        if (s.length < scheme.length + 4 || s.length > 200) return false;
        for (uint256 i; i < scheme.length; ++i) {
            if (s[i] != scheme[i]) return false;
        }
        for (uint256 i = scheme.length; i < s.length; ++i) {
            bytes1 c = s[i];
            if (_alnum(c)) continue;
            if (
                c != "." && c != "-" && c != "_" && c != "~" && c != "/" && c != "?" && c != "=" && c != "&"
                    && c != "#" && c != "%" && c != ":" && c != "+" && c != "@" && c != "!" && c != ","
            ) return false;
        }
        return true;
    }

    /// @dev 1–80 printable ASCII characters, no quotes, apostrophes, backslashes or controls.
    function _isText(bytes memory s) private pure returns (bool) {
        if (s.length == 0 || s.length > 80) return false;
        if (s[0] == " " || s[s.length - 1] == " ") return false;
        for (uint256 i; i < s.length; ++i) {
            bytes1 c = s[i];
            if (c < 0x20 || c > 0x7e || c == '"' || c == "'" || c == "\\" || c == "`") return false;
        }
        return true;
    }

    /// @dev A zero-argument view signature such as `totalSupply()`: identifier then `()`.
    function _isViewCall(bytes memory s) private pure returns (bool) {
        if (s.length < 3 || s.length > 64) return false;
        if (s[s.length - 2] != "(" || s[s.length - 1] != ")") return false;
        bytes1 first = s[0];
        if (!((first >= "a" && first <= "z") || (first >= "A" && first <= "Z") || first == "_")) {
            return false;
        }
        for (uint256 i = 1; i < s.length - 2; ++i) {
            bytes1 c = s[i];
            if (!_alnum(c) && c != "_") return false;
        }
        return true;
    }
}
