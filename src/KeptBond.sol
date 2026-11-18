// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @dev The parts of KeptVaultV2 a bond reads. Outcomes there are final once they leave Open.
interface IKeptVaultV2Read {
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
            uint16 panelSize_,
            uint16 quorum_
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

    function milestoneV2(uint256 pledgeId, uint8 index)
        external
        view
        returns (uint16 shareBps, bool lastNo, bool appealed, bool inFlightAppeal, uint64 checkBy);
}

/// @title KEPT bonds: ETH behind a promise, paid to holders when it breaks
/// @notice Anyone, usually the team, can post ETH behind a milestone of a KeptVaultV2 pledge. The
/// vault's own verdict decides what happens to it:
/// - Kept: every bonder takes its ETH back.
/// - Partial: bonders take back the share that was delivered; the rest is forfeited.
/// - Broken: all of it is forfeited.
/// Forfeited ETH buys the pledge's token from whoever sells it, through a rising-bid auction, and
/// every token bought is burned. Holders who want out get a buyer the team paid for; everyone
/// else holds a larger share of a smaller supply.
/// @dev The auction needs no oracle and no router. The bond is the buyer, so its bid starts low,
/// at the price where the whole forfeit would buy the whole supply, which is below any real
/// market, and doubles every DOUBLING. Holders sell once the bid reaches what their tokens are
/// worth, so the bond pays about the market price and nobody can take it all for one token. The
/// bid stops rising at `maxPrice`, where one whole token would take the entire forfeit. Bonds
/// cannot be withdrawn early, and the contract has no owner. ETH nobody sells for within
/// AUCTION_MAX goes to `leftoverTo`, fixed at deploy, so it can never be stuck.
contract KeptBond is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 internal constant OPEN = 0;
    uint8 internal constant KEPT = 1;
    uint8 internal constant BROKEN = 2;
    uint8 internal constant PARTIAL = 3;

    uint256 public constant BPS = 10_000;
    uint256 public constant DOUBLING = 1 hours;
    uint256 public constant AUCTION_MAX = 30 days;
    /// @notice Where bought tokens go. Many tokens have no burn(), so they are sent here instead.
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    /// @notice The smallest bond, so a bond is never dust that clutters a pledge page.
    uint256 public constant MIN_BOND = 0.001 ether;

    IKeptVaultV2Read public immutable vault;
    /// @notice Receives auction ETH that nobody sold for within AUCTION_MAX.
    address public immutable leftoverTo;

    struct Bond {
        uint128 total; // ETH posted
        uint128 refundable; // ETH bonders may take back after the verdict
        uint128 forfeit; // ETH in the auction, still unspent
        uint256 startPrice; // the opening bid: wei per token base unit, 1e18 fixed point
        uint256 maxPrice; // the highest bid: one whole token for the entire forfeit
        uint64 auctionStart; // 0 until resolved with a forfeit
        uint16 shareBps; // the delivered share, from the vault
        bool resolved;
    }

    mapping(uint256 => mapping(uint8 => Bond)) internal _bonds;
    mapping(uint256 => mapping(uint8 => mapping(address => uint256))) public bondOf;

    event Bonded(uint256 indexed pledgeId, uint8 indexed index, address indexed bonder, uint256 amount);
    event Resolved(uint256 indexed pledgeId, uint8 indexed index, uint16 shareBps, uint256 refundable, uint256 forfeit);
    event Refunded(uint256 indexed pledgeId, uint8 indexed index, address indexed bonder, uint256 amount);
    event Bought(uint256 indexed pledgeId, uint8 indexed index, address indexed seller, uint256 tokens, uint256 eth);
    event Swept(uint256 indexed pledgeId, uint8 indexed index, uint256 eth);

    error TooSmall();
    error TooLate();
    error NotResolvable();
    error AlreadyResolved();
    error NotResolved();
    error NothingToRefund();
    error AuctionClosed();
    error AuctionStillOpen();
    error SlippageExceeded();
    error ZeroAmount();
    error TransferFailed();
    error ZeroAddress();

    constructor(address vault_, address leftoverTo_) {
        if (vault_ == address(0) || leftoverTo_ == address(0)) revert ZeroAddress();
        vault = IKeptVaultV2Read(vault_);
        leftoverTo = leftoverTo_;
    }

    // ------------------------------------------------------------------ bonding

    /// @notice Posts ETH behind milestone `index` of `pledgeId`. Allowed until its deadline, while
    /// the milestone is still open. A bond can't be withdrawn: only the verdict releases it.
    function bond(uint256 pledgeId, uint8 index) external payable nonReentrant {
        if (msg.value < MIN_BOND) revert TooSmall();
        (,, uint64 deadline,, uint8 outcome,,,,) = vault.milestone(pledgeId, index);
        if (outcome != OPEN || block.timestamp > deadline) revert TooLate();
        Bond storage b = _bonds[pledgeId][index];
        b.total += uint128(msg.value);
        bondOf[pledgeId][index][msg.sender] += msg.value;
        emit Bonded(pledgeId, index, msg.sender, msg.value);
    }

    /// @notice Reads the vault's final verdict and splits the bond: the delivered share back to
    /// bonders, the rest into the auction. Anyone can call it once the verdict exists.
    function resolve(uint256 pledgeId, uint8 index) external nonReentrant {
        Bond storage b = _bonds[pledgeId][index];
        if (b.resolved) revert AlreadyResolved();
        if (b.total == 0) revert NotResolvable();
        (,,,, uint8 outcome,,,,) = vault.milestone(pledgeId, index);
        uint256 share;
        if (outcome == KEPT) share = BPS;
        else if (outcome == BROKEN) share = 0;
        else if (outcome == PARTIAL) (share,,,,) = _shareOf(pledgeId, index);
        else revert NotResolvable();

        uint256 refundable = Math.mulDiv(b.total, share, BPS);
        uint256 forfeit = b.total - refundable;
        b.resolved = true;
        b.shareBps = uint16(share);
        b.refundable = uint128(refundable);
        b.forfeit = uint128(forfeit);
        if (forfeit > 0) {
            (,, address token,,,,,,,,) = vault.pledge(pledgeId);
            uint256 maxPrice = Math.mulDiv(forfeit, 1e18, 10 ** _decimals(token));
            uint256 supply = _supply(token);
            // the whole forfeit for the whole supply: below any real market; see the contract note
            uint256 startPrice = supply == 0 ? maxPrice : Math.mulDiv(forfeit, 1e18, supply);
            b.startPrice = startPrice == 0 ? 1 : startPrice > maxPrice ? maxPrice : startPrice;
            b.maxPrice = maxPrice;
            b.auctionStart = uint64(block.timestamp);
        }
        emit Resolved(pledgeId, index, uint16(share), refundable, forfeit);
    }

    /// @notice Takes back a bonder's share of the bond after the verdict.
    function refund(uint256 pledgeId, uint8 index) external nonReentrant {
        Bond storage b = _bonds[pledgeId][index];
        if (!b.resolved) revert NotResolved();
        uint256 posted = bondOf[pledgeId][index][msg.sender];
        uint256 amount = Math.mulDiv(posted, b.shareBps, BPS);
        if (amount == 0) revert NothingToRefund();
        bondOf[pledgeId][index][msg.sender] = 0;
        b.refundable -= uint128(amount);
        _sendEth(msg.sender, amount);
        emit Refunded(pledgeId, index, msg.sender, amount);
    }

    // ------------------------------------------------------------------ the auction

    /// @notice The bond's bid now: wei per token base unit, 1e18 fixed point. Doubles every
    /// DOUBLING, rising in a straight line between doublings, up to `maxPrice`. Zero when no
    /// auction is running.
    function priceNow(uint256 pledgeId, uint8 index) public view returns (uint256) {
        Bond storage b = _bonds[pledgeId][index];
        if (b.auctionStart == 0 || b.forfeit == 0 || block.timestamp > uint256(b.auctionStart) + AUCTION_MAX) return 0;
        uint256 t = block.timestamp - b.auctionStart;
        uint256 k = t / DOUBLING;
        uint256 cap = b.maxPrice;
        // past the doubling that reaches the cap, the bid stays at the cap
        if (k >= 255 || b.startPrice > cap >> k) return cap;
        uint256 lo = b.startPrice << k;
        uint256 hi = lo << 1;
        uint256 p = lo + Math.mulDiv(hi - lo, t % DOUBLING, DOUBLING);
        return p > cap ? cap : p;
    }

    /// @notice Sells up to `amount` of the pledge's token to the bond for ETH at the current price.
    /// Takes only what the ETH left can pay for, sends the tokens to DEAD, and pays the seller.
    /// @param minEth the least ETH to accept, or the sale reverts
    /// @return sold tokens taken from the seller
    /// @return eth ETH paid
    function sell(uint256 pledgeId, uint8 index, uint256 amount, uint256 minEth)
        external
        nonReentrant
        returns (uint256 sold, uint256 eth)
    {
        if (amount == 0) revert ZeroAmount();
        Bond storage b = _bonds[pledgeId][index];
        uint256 price = priceNow(pledgeId, index);
        if (price == 0) revert AuctionClosed();
        sold = amount;
        eth = Math.mulDiv(sold, price, 1e18);
        if (eth > b.forfeit) {
            eth = b.forfeit;
            // the fewest tokens that pay for the rest, rounded up in the bond's favour
            sold = Math.mulDiv(eth, 1e18, price, Math.Rounding.Ceil);
            if (sold > amount) sold = amount;
        }
        if (eth == 0) revert ZeroAmount();
        if (eth < minEth) revert SlippageExceeded();
        b.forfeit -= uint128(eth);
        (,, address token,,,,,,,,) = vault.pledge(pledgeId);
        IERC20(token).safeTransferFrom(msg.sender, DEAD, sold);
        _sendEth(msg.sender, eth);
        emit Bought(pledgeId, index, msg.sender, sold, eth);
    }

    /// @notice After AUCTION_MAX, sends ETH nobody sold for to `leftoverTo`.
    function sweep(uint256 pledgeId, uint8 index) external nonReentrant {
        Bond storage b = _bonds[pledgeId][index];
        if (b.auctionStart == 0 || block.timestamp <= uint256(b.auctionStart) + AUCTION_MAX) revert AuctionStillOpen();
        uint256 eth = b.forfeit;
        if (eth == 0) revert ZeroAmount();
        b.forfeit = 0;
        _sendEth(leftoverTo, eth);
        emit Swept(pledgeId, index, eth);
    }

    // ------------------------------------------------------------------ views

    function bondInfo(uint256 pledgeId, uint8 index)
        external
        view
        returns (
            uint256 total,
            uint256 refundable,
            uint256 forfeit,
            uint256 startPrice,
            uint256 maxPrice,
            uint64 auctionStart,
            uint16 shareBps,
            bool resolved,
            uint256 price
        )
    {
        Bond storage b = _bonds[pledgeId][index];
        return (b.total, b.refundable, b.forfeit, b.startPrice, b.maxPrice, b.auctionStart, b.shareBps, b.resolved, priceNow(pledgeId, index));
    }

    /// @notice What `refund` would pay `who` now.
    function refundOf(uint256 pledgeId, uint8 index, address who) external view returns (uint256) {
        Bond storage b = _bonds[pledgeId][index];
        if (!b.resolved) return 0;
        return Math.mulDiv(bondOf[pledgeId][index][who], b.shareBps, BPS);
    }

    // ------------------------------------------------------------------ internal

    function _shareOf(uint256 pledgeId, uint8 index) internal view returns (uint256, bool, bool, bool, uint64) {
        (uint16 shareBps, bool a, bool c, bool d, uint64 e) = vault.milestoneV2(pledgeId, index);
        return (uint256(shareBps) > BPS ? BPS : shareBps, a, c, d, e);
    }

    function _supply(address token) internal view returns (uint256) {
        try IERC20(token).totalSupply() returns (uint256 s) {
            return s;
        } catch {
            return 0;
        }
    }

    function _decimals(address token) internal view returns (uint8) {
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            return d > 36 ? 18 : d;
        } catch {
            return 18;
        }
    }

    function _sendEth(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
