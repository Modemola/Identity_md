// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IKeptVault} from "./interfaces/IKeptVault.sol";

/// @title Will they ship? YES/NO markets on KEPT milestones
/// @notice Anyone can bet IMD on whether a team delivers a milestone. The vault's own record
/// settles the market: YES wins when the IMD swarm's verdict marks the milestone Kept, NO wins
/// when it is burned as Broken. Winners split the losing pool pro rata, less a 2% fee that goes
/// back into KEPT: half to the pledge's check budget, half to the Referee Fund.
/// @dev Parimutuel: two pools per milestone, no liquidity needed. Bets close at the deadline, at
/// the first check asked after the market opened, or once an outcome exists. The owner can only
/// pause new bets and lower the cap on the YES pool; it cannot move funds or change outcomes.
contract KeptMarkets is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        None, // no bet yet
        Open,
        Yes, // milestone kept: YES stakers win
        No, // milestone broken: NO stakers win
        Refund, // one side had no stake: every stake comes back, no fee
        Void // never resolved in time: every stake comes back, no fee
    }

    struct Market {
        uint128 yes;
        uint128 no;
        uint64 deadline;
        uint8 attemptsAtOpen;
        State state;
    }

    struct Stake {
        uint128 yes;
        uint128 no;
    }

    uint256 public constant FEE_BPS = 200; // 2% of the losing pool
    uint256 public constant BPS = 10_000;
    /// @notice A market still unresolved this long after `deadline + GRACE` is voided.
    uint256 public constant VOID_AFTER = 14 days;

    IKeptVault public immutable vault;
    IERC20 public immutable imd;
    uint256 public immutable grace;

    address public owner;
    bool public paused;
    /// @notice The most the YES pool of one market may hold: what a NO bettor can win. Bounds how
    /// much a team could gain by betting NO on itself and failing on purpose.
    uint256 public yesCap;

    mapping(uint256 => mapping(uint8 => Market)) internal _markets;
    mapping(uint256 => mapping(uint8 => mapping(address => Stake))) internal _stakes;

    event MarketOpened(uint256 indexed pledgeId, uint8 indexed index, uint64 deadline);
    event BetPlaced(uint256 indexed pledgeId, uint8 indexed index, address indexed who, bool yes, uint256 amount);
    event Resolved(uint256 indexed pledgeId, uint8 indexed index, State state, uint256 yes, uint256 no, uint256 fee);
    event Claimed(uint256 indexed pledgeId, uint8 indexed index, address indexed who, uint256 amount);
    event YesCapLowered(uint256 cap);
    event PausedSet(bool paused);
    event OwnerChanged(address indexed owner);

    error NotOwner();
    error Paused();
    error ZeroAmount();
    error BettingClosed();
    error InsiderBet();
    error CapReached();
    error UnknownMarket();
    error AlreadyResolved();
    error NotResolvable();
    error NotResolved();
    error NothingToClaim();
    error InvalidCap();
    error TransferMismatch();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address vault_, address owner_, uint256 yesCap_) {
        vault = IKeptVault(vault_);
        imd = IERC20(IKeptVault(vault_).imd());
        grace = IKeptVault(vault_).GRACE();
        owner = owner_;
        yesCap = yesCap_;
        emit OwnerChanged(owner_);
        emit YesCapLowered(yesCap_);
    }

    // ------------------------------------------------------------------ betting

    /// @notice Bets `amount` IMD on YES (the team delivers) or NO. The first bet opens the market.
    function bet(uint256 pledgeId, uint8 index, bool yes, uint256 amount) external nonReentrant {
        if (paused) revert Paused();
        if (amount == 0) revert ZeroAmount();
        if (amount > type(uint96).max) revert CapReached(); // keeps both pools far from uint128
        (address creator, address beneficiary,,,,,,,,,) = vault.pledge(pledgeId);
        if (msg.sender == creator || msg.sender == beneficiary) revert InsiderBet();

        (,, uint64 deadline,, uint8 outcome, bool settled, uint8 attempts, bytes32 inFlight,) =
            vault.milestone(pledgeId, index);
        Market storage m = _markets[pledgeId][index];
        if (m.state == State.None) {
            m.state = State.Open;
            m.deadline = deadline;
            m.attemptsAtOpen = attempts;
            emit MarketOpened(pledgeId, index, deadline);
        }
        if (m.state != State.Open) revert BettingClosed();
        if (
            block.timestamp >= deadline || outcome != 0 || settled || inFlight != bytes32(0)
                || attempts != m.attemptsAtOpen
        ) revert BettingClosed();

        if (yes) {
            if (m.yes + amount > yesCap) revert CapReached();
            m.yes += uint128(amount);
            _stakes[pledgeId][index][msg.sender].yes += uint128(amount);
        } else {
            m.no += uint128(amount);
            _stakes[pledgeId][index][msg.sender].no += uint128(amount);
        }
        _pullExact(amount);
        emit BetPlaced(pledgeId, index, msg.sender, yes, amount);
    }

    // ------------------------------------------------------------------ resolution

    /// @notice Closes a market from the vault's record. Settles the milestone first when it is
    /// past its proof window and nobody has. Anyone may call it.
    function resolve(uint256 pledgeId, uint8 index) external nonReentrant {
        Market storage m = _markets[pledgeId][index];
        if (m.state == State.None) revert UnknownMarket();
        if (m.state != State.Open) revert AlreadyResolved();

        uint8 outcome = _outcome(pledgeId, index);
        if (outcome == 0 && block.timestamp > uint256(m.deadline) + grace) {
            // a missed milestone burns in settle; if a late check is still in flight it reverts
            // and the market waits, at most ANSWER_TIMEOUT
            try vault.settle(pledgeId, index) {} catch {}
            outcome = _outcome(pledgeId, index);
        }

        State s;
        if (outcome == 1) s = State.Yes;
        // 2 Broken; 3 Partial (KeptVaultV2): the market asks whether the milestone is delivered,
        // so only a full delivery pays YES (docs/VAULT_V2.md, Markets)
        else if (outcome == 2 || outcome == 3) s = State.No;
        else if (block.timestamp > uint256(m.deadline) + grace + VOID_AFTER) s = State.Void;
        else revert NotResolvable();

        uint256 fee;
        if (s == State.Yes || s == State.No) {
            uint256 winning = s == State.Yes ? m.yes : m.no;
            uint256 losing = s == State.Yes ? m.no : m.yes;
            if (winning == 0 || losing == 0) {
                s = State.Refund;
            } else {
                fee = (losing * FEE_BPS) / BPS;
            }
        }
        m.state = s;
        emit Resolved(pledgeId, index, s, m.yes, m.no, fee);
        if (fee != 0) _payFee(pledgeId, fee);
    }

    /// @notice Pays out the caller's winnings, or their stakes when the market was refunded or voided.
    function claim(uint256 pledgeId, uint8 index) external nonReentrant returns (uint256 paid) {
        paid = owed(pledgeId, index, msg.sender);
        if (paid == 0) {
            State s = _markets[pledgeId][index].state;
            if (s == State.None || s == State.Open) revert NotResolved();
            revert NothingToClaim();
        }
        delete _stakes[pledgeId][index][msg.sender];
        imd.safeTransfer(msg.sender, paid);
        emit Claimed(pledgeId, index, msg.sender, paid);
    }

    // ------------------------------------------------------------------ views

    function market(uint256 pledgeId, uint8 index) external view returns (Market memory) {
        return _markets[pledgeId][index];
    }

    function stakeOf(uint256 pledgeId, uint8 index, address who) external view returns (Stake memory) {
        return _stakes[pledgeId][index][who];
    }

    /// @notice What `who` can claim now: 0 until the market resolves.
    function owed(uint256 pledgeId, uint8 index, address who) public view returns (uint256) {
        Market storage m = _markets[pledgeId][index];
        Stake storage st = _stakes[pledgeId][index][who];
        if (m.state == State.Refund || m.state == State.Void) return uint256(st.yes) + st.no;
        if (m.state == State.Yes) return _payout(st.yes, m.yes, m.no);
        if (m.state == State.No) return _payout(st.no, m.no, m.yes);
        return 0;
    }

    /// @notice Whether a bet would be accepted now, the YES share of the pot in basis points, and
    /// when betting closes at the latest.
    function quote(uint256 pledgeId, uint8 index)
        external
        view
        returns (bool open, uint256 yesBps, uint256 pot, uint64 closesAt)
    {
        Market storage m = _markets[pledgeId][index];
        (,, uint64 deadline,, uint8 outcome, bool settled, uint8 attempts, bytes32 inFlight,) =
            vault.milestone(pledgeId, index);
        pot = uint256(m.yes) + m.no;
        yesBps = pot == 0 ? BPS / 2 : (uint256(m.yes) * BPS) / pot;
        closesAt = deadline;
        open = !paused && block.timestamp < deadline && outcome == 0 && !settled && inFlight == bytes32(0)
            && (m.state == State.None || (m.state == State.Open && attempts == m.attemptsAtOpen));
    }

    // ------------------------------------------------------------------ owner

    /// @notice Lowers the cap on each market's YES pool. It can never be raised.
    function lowerYesCap(uint256 cap) external onlyOwner {
        if (cap >= yesCap) revert InvalidCap();
        yesCap = cap;
        emit YesCapLowered(cap);
    }

    /// @notice Pauses or resumes new bets. Resolving and claiming are never paused.
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function setOwner(address next) external onlyOwner {
        owner = next;
        emit OwnerChanged(next);
    }

    // ------------------------------------------------------------------ internals

    function _payout(uint256 stake, uint256 winning, uint256 losing) private pure returns (uint256) {
        if (stake == 0) return 0;
        uint256 prize = losing - (losing * FEE_BPS) / BPS;
        return stake + (stake * prize) / winning;
    }

    function _outcome(uint256 pledgeId, uint8 index) private view returns (uint8 outcome) {
        (,,,, outcome,,,,) = vault.milestone(pledgeId, index);
    }

    /// @dev Half to the pledge's check budget, the rest to the Referee Fund. A pledge with every
    /// milestone settled takes no budget, so then all of it goes to the Referee Fund.
    function _payFee(uint256 pledgeId, uint256 fee) private {
        uint256 half = fee / 2;
        imd.forceApprove(address(vault), fee);
        uint256 toReferee = fee;
        if (half != 0) {
            try vault.fund(pledgeId, half) {
                toReferee = fee - half;
            } catch {}
        }
        vault.fundReferee(toReferee);
        imd.forceApprove(address(vault), 0);
    }

    function _pullExact(uint256 amount) private {
        uint256 before = imd.balanceOf(address(this));
        imd.safeTransferFrom(msg.sender, address(this), amount);
        if (imd.balanceOf(address(this)) != before + amount) revert TransferMismatch();
    }
}
