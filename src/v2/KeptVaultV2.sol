// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {OracleAttestation, OracleAttestationConsumer} from "../OracleAttestation.sol";
import {IIntake} from "../interfaces/IIntake.sol";
import {QuestionsV2 as Questions} from "./QuestionsV2.sol";
import {KeptQuestionsV2} from "./KeptQuestionsV2.sol";

/// @title KEPT v2: promises the IMD swarm enforces
/// @notice v1 with three changes (docs/VAULT_V2.md): partial credit for numeric milestones
/// (`ValueScaled`), chain questions pinned to the deadline's block so they can be checked after it,
/// and one appeal per milestone to a 15-agent panel. Pledge numbers start at 1001.
/// A team locks tokens behind milestones. At each deadline the IMD reasoning oracle checks
/// the milestone and signs a verdict for this contract. A kept milestone releases its tranche to the
/// team's beneficiary; a milestone nobody proves by `deadline + GRACE` is burned.
/// @dev The oracle callback only verifies and records (it gets 200k gas, once); tokens move in
/// `settle`. Nothing can move locked tokens except a verdict or a missed deadline.
contract KeptVaultV2 is OracleAttestationConsumer, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Outcome {
        Open,
        Kept,
        Broken,
        /// @dev ValueScaled only: part of the tranche unlocks (`shareBps`), the rest burns.
        Partial
    }

    struct MilestoneInput {
        Questions.Kind kind;
        uint64 deadline;
        uint128 amount;
        uint64 chainId;
        address target;
        uint256 threshold;
        uint256 floor;
        string title;
        string a;
        string b;
    }

    struct Milestone {
        Questions.Spec spec;
        string title;
        uint64 deadline;
        uint128 amount;
        Outcome outcome;
        bool settled;
        uint8 attempts;
        uint64 askedAt;
        bytes32 inFlight;
        address inFlightIntake;
        /// @dev The oracle signer when the check was asked: a later rotation cannot strand it.
        address inFlightSigner;
        uint256 inFlightPrice;
        /// @dev Basis points of the tranche that unlock: 10000 when kept, between for a partial score.
        uint16 shareBps;
        /// @dev The last answer was "not delivered", which is what an appeal answers.
        bool lastNo;
        bool appealed;
        bool inFlightAppeal;
    }

    struct Pledge {
        address creator;
        address beneficiary;
        IERC20 token;
        uint64 createdAt;
        uint16 panelSize;
        uint16 quorum;
        uint8 count;
        uint8 open;
        uint128 locked;
        uint256 budget;
        string name;
    }

    struct Ticket {
        uint256 pledgeId;
        uint8 index;
    }

    /// @notice How long after a deadline the swarm may still confirm a milestone.
    uint256 public constant GRACE = 3 days;
    /// @notice Checks one milestone may buy in total.
    uint8 public constant MAX_ATTEMPTS = 3;
    uint8 public constant MAX_MILESTONES = 8;
    uint256 public constant MIN_LEAD = 1 hours;
    uint256 public constant MAX_LEAD = 3 * 365 days;
    /// @notice After this long without a callback a check can be cleared and retried.
    uint256 public constant ANSWER_TIMEOUT = 1 days;
    uint256 public constant PROTOCOL_DELAY = 7 days;
    uint32 public constant VALID_FOR = 1 days;
    /// @notice Ceiling for the two-argument check: 0.5 IMD (18 decimals). Use an explicit cap for repricing.
    uint256 public constant DEFAULT_MAX_PRICE = 0.5 ether;
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;
    /// @notice v2 pledges are numbered from here, so they never share a number with v1's.
    uint256 public constant FIRST_PLEDGE = 1001;
    /// @notice An appeal goes to a bigger panel: IMD's own proposal for a 15-agent panel.
    uint16 public constant APPEAL_PANEL = 15;
    uint16 public constant APPEAL_QUORUM = 11;
    /// @notice Ceiling for the one-argument appeal: twice a check.
    uint256 public constant DEFAULT_APPEAL_PRICE = 1 ether;
    uint16 public constant FULL = 10_000;

    /// @notice The IMD token on this chain: pays for checks. Immutable so budgets keep their meaning.
    IERC20 public immutable imd;
    /// @notice The question builder deployed with this vault (validation and oracle bodies).
    KeptQuestionsV2 public immutable questions;

    address public owner;
    IIntake public intake;
    bytes32 public action;
    uint16 public panelSize;
    uint16 public quorum;

    struct ProtocolChange {
        address intake;
        bytes32 action;
        address signer;
        uint64 readyAt;
    }

    ProtocolChange public pendingProtocol;

    uint256 public pledgeCount;
    /// @notice IMD donated to rebate checks for milestones that turn out kept.
    uint256 public refereeFund;
    /// @notice IMD held for pledge budgets and checks, so donations and budgets never mix.
    uint256 public totalBudgets;

    mapping(uint256 => Pledge) private _pledges;
    mapping(uint256 => mapping(uint256 => Milestone)) private _milestones;
    /// @dev intake => intake request id => ticket. Keyed by the intake that took the request.
    mapping(address => mapping(bytes32 => Ticket)) private _tickets;
    mapping(address => mapping(bytes32 => bool)) private _known;

    error OnlyOwner();
    error InvalidConfiguration();
    error InvalidPledge();
    error InvalidMilestone(uint256 index);
    error UnknownPledge();
    error UnknownMilestone();
    error NotOpen();
    error CheckInFlight();
    error NoCheckInFlight();
    error CheckWindowClosed();
    error TooEarly();
    error NotAllowed();
    error AttemptsExhausted();
    error InsufficientBudget(uint256 budget, uint256 price);
    error PriceAboveLimit(uint256 price, uint256 maxPrice);
    error TransferMismatch();
    error OnlyIntake();
    error UnknownRequest();
    error InvalidAttestation();
    error AlreadySettled();
    error NothingPending();
    error NotAppealable();

    event OwnerChanged(address indexed owner);
    event ProtocolProposed(address intake, bytes32 action, address signer, uint64 readyAt);
    event ProtocolSet(address indexed intake, bytes32 action, address indexed signer);
    event PanelSet(uint16 panelSize, uint16 quorum);
    event PledgeCreated(
        uint256 indexed pledgeId,
        address indexed creator,
        address indexed token,
        address beneficiary,
        string name,
        uint256 locked,
        uint8 milestones
    );
    event MilestoneAdded(
        uint256 indexed pledgeId,
        uint8 indexed index,
        Questions.Kind kind,
        uint64 deadline,
        uint128 amount,
        string title
    );
    event BudgetFunded(uint256 indexed pledgeId, address indexed from, uint256 amount);
    event RefereeFunded(address indexed from, uint256 amount);
    event CheckRequested(
        uint256 indexed pledgeId,
        uint8 indexed index,
        bytes32 indexed intakeRequestId,
        uint8 attempt,
        uint256 price
    );
    event Verdict(
        uint256 indexed pledgeId,
        uint8 indexed index,
        bytes32 indexed oracleRequestId,
        bool kept,
        uint16 agreed,
        uint16 quorum,
        uint16 panelSize
    );
    event CheckCleared(uint256 indexed pledgeId, uint8 indexed index, bytes32 intakeRequestId);
    /// @notice A ValueScaled verdict: the value read at the deadline and the share that unlocks.
    event Scored(uint256 indexed pledgeId, uint8 indexed index, bytes32 indexed oracleRequestId, uint256 value, uint16 shareBps);
    event Appealed(uint256 indexed pledgeId, uint8 indexed index, bytes32 indexed intakeRequestId, uint256 price);
    /// @notice The part of a partial tranche that burns; the paid part is in `Settled`.
    event Burned(uint256 indexed pledgeId, uint8 indexed index, uint256 amount);
    event Rebated(uint256 indexed pledgeId, uint8 indexed index, uint256 amount);
    event Settled(uint256 indexed pledgeId, uint8 indexed index, Outcome outcome, address to, uint256 amount);
    event BudgetReturned(uint256 indexed pledgeId, address indexed to, uint256 amount);

    constructor(
        address owner_,
        address intake_,
        address imd_,
        bytes32 action_,
        address signer_,
        uint16 panelSize_,
        uint16 quorum_,
        address questions_
    ) OracleAttestationConsumer(signer_) {
        if (owner_ == address(0) || imd_ == address(0) || questions_.code.length == 0) revert InvalidConfiguration();
        owner = owner_;
        imd = IERC20(imd_);
        questions = KeptQuestionsV2(questions_);
        _setProtocol(intake_, action_, signer_);
        _setPanel(panelSize_, quorum_);
        pledgeCount = FIRST_PLEDGE - 1;
        emit OwnerChanged(owner_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    // ------------------------------------------------------------------ pledges

    /// @notice Locks `token` behind `milestones` and funds the pledge's check budget with IMD.
    /// @param budget IMD for checks, pulled from the caller. Anyone can add more with `fund`.
    function createPledge(
        IERC20 token,
        address beneficiary,
        string calldata name,
        MilestoneInput[] calldata milestones,
        uint256 budget
    ) external nonReentrant returns (uint256 id) {
        uint256 n = milestones.length;
        if (
            address(token) == address(0) || beneficiary == address(0) || n == 0 || n > MAX_MILESTONES
                || bytes(name).length == 0 || bytes(name).length > 64
        ) revert InvalidPledge();

        id = ++pledgeCount;
        Pledge storage p = _pledges[id];
        p.creator = msg.sender;
        p.beneficiary = beneficiary;
        p.token = token;
        p.createdAt = uint64(block.timestamp);
        p.panelSize = panelSize;
        p.quorum = quorum;
        p.count = uint8(n);
        p.open = uint8(n);
        p.name = name;

        uint256 total;
        for (uint256 i; i < n; ++i) {
            MilestoneInput calldata m = milestones[i];
            if (
                m.amount == 0 || m.deadline < block.timestamp + MIN_LEAD
                    || m.deadline > block.timestamp + MAX_LEAD || bytes(m.title).length == 0
                    || bytes(m.title).length > 120
            ) revert InvalidMilestone(i);
            Questions.Spec memory spec = Questions.Spec(m.kind, m.chainId, m.target, m.threshold, m.floor, m.a, m.b);
            questions.validate(spec);
            Milestone storage s = _milestones[id][i];
            s.spec = spec;
            s.title = m.title;
            s.deadline = m.deadline;
            s.amount = m.amount;
            total += m.amount;
            emit MilestoneAdded(id, uint8(i), m.kind, m.deadline, m.amount, m.title);
        }
        if (total > type(uint128).max) revert InvalidPledge();
        p.locked = uint128(total);

        _pullExact(token, total);
        emit PledgeCreated(id, msg.sender, address(token), beneficiary, name, total, uint8(n));
        if (budget != 0) _fund(id, budget);
    }

    /// @notice Adds IMD to a pledge's check budget.
    function fund(uint256 pledgeId, uint256 amount) external nonReentrant {
        if (_pledges[pledgeId].creator == address(0)) revert UnknownPledge();
        if (_pledges[pledgeId].open == 0 || amount == 0) revert InvalidPledge();
        _fund(pledgeId, amount);
    }

    /// @notice Donates IMD to the Referee Fund, which rebates one check for every kept milestone.
    function fundReferee(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidConfiguration();
        _pullExact(imd, amount);
        refereeFund += amount;
        emit RefereeFunded(msg.sender, amount);
    }

    // ------------------------------------------------------------------ checks

    /// @notice Buys one oracle check for at most DEFAULT_MAX_PRICE, paid from the pledge budget.
    function check(uint256 pledgeId, uint8 index) external nonReentrant returns (bytes32 requestId) {
        return _check(pledgeId, index, DEFAULT_MAX_PRICE);
    }

    /// @notice Buys one oracle check for at most `maxPrice` IMD atomic units.
    /// @dev Only the beneficiary may spend attempts. Checks open at creation to prove early delivery.
    /// Snapshot templates close at the deadline; GitHub releases explicitly pin publication time,
    /// so their checks may still be bought during GRACE.
    function check(uint256 pledgeId, uint8 index, uint256 maxPrice)
        external
        nonReentrant
        returns (bytes32 requestId)
    {
        return _check(pledgeId, index, maxPrice);
    }

    /// @notice After a "not delivered" verdict on a GitHub release or a page, asks once more, of a
    /// 15-agent panel with a quorum of 11, within the same window the milestone can be checked. Final.
    /// Chain questions have no appeal: IMD reruns the same call and would give the same answer.
    /// @param maxPrice The most IMD this appeal may cost (DEFAULT_APPEAL_PRICE is twice a check).
    function appeal(uint256 pledgeId, uint8 index, uint256 maxPrice) external nonReentrant returns (bytes32 requestId) {
        return _ask(pledgeId, index, maxPrice, true);
    }

    function _check(uint256 pledgeId, uint8 index, uint256 maxPrice) private returns (bytes32 requestId) {
        return _ask(pledgeId, index, maxPrice, false);
    }

    function _ask(uint256 pledgeId, uint8 index, uint256 maxPrice, bool isAppeal) private returns (bytes32 requestId) {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        if (m.outcome != Outcome.Open || m.settled) revert NotOpen();
        if (m.inFlight != bytes32(0)) {
            if (block.timestamp < uint256(m.askedAt) + ANSWER_TIMEOUT) revert CheckInFlight();
            _clear(pledgeId, index, m);
        }
        if (block.timestamp > _checkDeadline(m)) revert CheckWindowClosed();
        // a scaled milestone is read once, at its deadline: asking earlier would score a moving number
        if (m.spec.kind == Questions.Kind.ValueScaled && block.timestamp <= m.deadline) revert TooEarly();
        if (msg.sender != p.beneficiary) revert NotAllowed();
        if (isAppeal) {
            if (m.appealed || !m.lastNo || Questions.isChainEvidence(m.spec.kind)) revert NotAppealable();
            m.appealed = true;
        } else {
            // the appeal's answer is final
            if (m.appealed) revert NotAppealable();
            if (m.attempts >= MAX_ATTEMPTS) revert AttemptsExhausted();
        }

        IIntake target = intake;
        uint256 price = target.priceOf(action, address(imd));
        if (price == 0) revert InvalidConfiguration();
        if (price > maxPrice) revert PriceAboveLimit(price, maxPrice);
        if (p.budget < price) revert InsufficientBudget(p.budget, price);
        p.budget -= price;
        totalBudgets -= price;
        m.attempts += 1;

        (uint16 ps, uint16 q) = isAppeal ? (APPEAL_PANEL, APPEAL_QUORUM) : (p.panelSize, p.quorum);
        bytes memory body = questions.body(m.spec, m.deadline, _readAt(m), ps, q, VALID_FOR);
        uint256 before = imd.balanceOf(address(this));
        imd.forceApprove(address(target), price);
        requestId = target.request(
            action, body, IIntake.Callback(address(this), this.onOracleResult.selector), address(imd), price
        );
        imd.forceApprove(address(target), 0);
        if (imd.balanceOf(address(this)) + price != before) revert TransferMismatch();
        if (requestId == bytes32(0) || _known[address(target)][requestId]) revert UnknownRequest();

        _known[address(target)][requestId] = true;
        _tickets[address(target)][requestId] = Ticket(pledgeId, index);
        m.inFlight = requestId;
        m.inFlightIntake = address(target);
        m.inFlightSigner = oracleSigner;
        m.inFlightPrice = price;
        m.askedAt = uint64(block.timestamp);
        m.inFlightAppeal = isAppeal;
        emit CheckRequested(pledgeId, index, requestId, m.attempts, price);
        if (isAppeal) emit Appealed(pledgeId, index, requestId, price);
    }

    /// @notice The Intake's callback with the oracle's signed verdict.
    function onOracleResult(
        bytes32 requestId,
        OracleAttestation.Attestation calldata a,
        bytes calldata signature
    ) external nonReentrant {
        if (!_known[msg.sender][requestId]) {
            if (msg.sender != address(intake)) revert OnlyIntake();
            revert UnknownRequest();
        }
        Ticket memory t = _tickets[msg.sender][requestId];
        Pledge storage p = _pledges[t.pledgeId];
        Milestone storage m = _milestones[t.pledgeId][t.index];
        if (m.inFlight != requestId || m.inFlightIntake != msg.sender) revert UnknownRequest();

        _verifyWith(a, signature, m.inFlightSigner);
        // Panel evidence needs the panel's own agreement. Chain evidence may be signed with
        // `agreed < quorum` when members split and the deployer's rerun of the recipe settled it,
        // which is the protocol's documented behaviour; the rerun is the stronger evidence there.
        bool chainEvidence = Questions.isChainEvidence(m.spec.kind);
        (uint16 needPanel, uint16 needQuorum) = m.inFlightAppeal ? (APPEAL_PANEL, APPEAL_QUORUM) : (p.panelSize, p.quorum);
        if (
            a.chainId != Questions.questionChain(m.spec) || a.panelSize < needPanel || a.quorum < needQuorum
                || a.quorum > a.panelSize || (!chainEvidence && a.agreed < a.quorum) || a.agreed > a.panelSize
                || a.issuedAt < m.askedAt || a.expiresAt < a.issuedAt || a.answer.length != 32
        ) revert InvalidAttestation();
        // A page is read when the panel fetches it: a verdict signed after the deadline can't speak
        // for the page at the deadline. Chain questions read a pinned block and a release carries its
        // publication time, so their verdicts may land after the deadline.
        if (m.spec.kind == Questions.Kind.PageContains && a.issuedAt > m.deadline) {
            revert InvalidAttestation();
        }
        uint16 share;
        if (m.spec.kind == Questions.Kind.ValueScaled) {
            uint256 value = decodeUint256(a);
            share = _share(value, m.spec.floor, m.spec.threshold);
            emit Scored(t.pledgeId, t.index, a.requestId, value, share);
        } else {
            share = decodeBool(a) ? FULL : 0;
        }
        _consume(a.requestId);

        uint256 price = m.inFlightPrice;
        m.inFlight = bytes32(0);
        m.inFlightIntake = address(0);
        m.inFlightSigner = address(0);
        m.inFlightPrice = 0;
        m.inFlightAppeal = false;
        emit Verdict(t.pledgeId, t.index, a.requestId, share == FULL, a.agreed, a.quorum, a.panelSize);
        if (share == 0) {
            // A scaled milestone read at zero is final: the number at the deadline won't change.
            if (m.spec.kind == Questions.Kind.ValueScaled) m.outcome = Outcome.Broken;
            else m.lastNo = true;
            return;
        }

        // Kept or partial is final, so this runs at most once per milestone.
        m.shareBps = share;
        m.outcome = share == FULL ? Outcome.Kept : Outcome.Partial;
        if (price != 0 && refereeFund >= price) {
            refereeFund -= price;
            p.budget += price;
            totalBudgets += price;
            emit Rebated(t.pledgeId, t.index, price);
        }
    }

    /// @notice Frees a check that got no answer within `ANSWER_TIMEOUT`. The attempt still counts.
    function clearStale(uint256 pledgeId, uint8 index) external nonReentrant {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        if (m.inFlight == bytes32(0)) revert NoCheckInFlight();
        if (block.timestamp < uint256(m.askedAt) + ANSWER_TIMEOUT) revert TooEarly();
        _clear(pledgeId, index, m);
    }

    // ------------------------------------------------------------------ settlement

    /// @notice Pays out a kept milestone, or burns one that was not proven by `deadline + GRACE`.
    function settle(uint256 pledgeId, uint8 index) external nonReentrant {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        if (m.settled) revert AlreadySettled();

        uint128 amount = m.amount;
        if (m.outcome == Outcome.Partial) {
            uint128 paid = uint128((uint256(amount) * m.shareBps) / FULL);
            m.settled = true;
            p.locked -= amount;
            p.open -= 1;
            p.token.safeTransfer(p.beneficiary, paid);
            p.token.safeTransfer(BURN, amount - paid);
            emit Settled(pledgeId, index, Outcome.Partial, p.beneficiary, paid);
            emit Burned(pledgeId, index, amount - paid);
            return;
        }

        address to;
        if (m.outcome == Outcome.Kept) {
            to = p.beneficiary;
        } else if (m.outcome == Outcome.Broken) {
            // scored zero at the deadline: nothing left to prove
            to = BURN;
        } else {
            if (block.timestamp <= uint256(m.deadline) + GRACE) revert TooEarly();
            if (m.inFlight != bytes32(0)) {
                if (block.timestamp < uint256(m.askedAt) + ANSWER_TIMEOUT) revert CheckInFlight();
                _clear(pledgeId, index, m);
            }
            m.outcome = Outcome.Broken;
            to = BURN;
        }

        m.settled = true;
        p.locked -= amount;
        p.open -= 1;
        p.token.safeTransfer(to, amount);
        emit Settled(pledgeId, index, m.outcome, to, amount);
    }

    /// @notice Returns a finished pledge's unused check budget to its creator. Anyone may trigger it;
    /// the IMD always goes to the creator. Kept apart from `settle` so a refund can never block a payout.
    function withdrawBudget(uint256 pledgeId) external nonReentrant returns (uint256 left) {
        Pledge storage p = _pledge(pledgeId);
        if (p.open != 0) revert NotOpen();
        left = p.budget;
        if (left == 0) revert NothingPending();
        p.budget = 0;
        totalBudgets -= left;
        imd.safeTransfer(p.creator, left);
        emit BudgetReturned(pledgeId, p.creator, left);
    }

    // ------------------------------------------------------------------ views

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
        )
    {
        Pledge storage p = _pledge(pledgeId);
        return (
            p.creator,
            p.beneficiary,
            address(p.token),
            p.name,
            p.createdAt,
            p.count,
            p.open,
            p.locked,
            p.budget,
            p.panelSize,
            p.quorum
        );
    }

    function milestone(uint256 pledgeId, uint8 index)
        external
        view
        returns (
            Questions.Kind kind,
            string memory title,
            uint64 deadline,
            uint128 amount,
            Outcome outcome,
            bool settled,
            uint8 attempts,
            bytes32 inFlight,
            uint64 askedAt
        )
    {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        return
            (
                m.spec.kind,
                m.title,
                m.deadline,
                m.amount,
                m.outcome,
                m.settled,
                m.attempts,
                m.inFlight,
                m.askedAt
            );
    }

    /// @notice v2 state the v1-shaped `milestone` view leaves out.
    function milestoneV2(uint256 pledgeId, uint8 index)
        external
        view
        returns (uint16 shareBps, bool lastNo, bool appealed, bool inFlightAppeal, uint64 checkBy)
    {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        return (m.shareBps, m.lastNo, m.appealed, m.inFlightAppeal, uint64(_checkDeadline(m)));
    }

    /// @notice Whether the beneficiary can appeal now.
    function appealOpen(uint256 pledgeId, uint8 index) external view returns (bool) {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        return m.outcome == Outcome.Open && !m.settled && m.lastNo && !m.appealed
            && !Questions.isChainEvidence(m.spec.kind) && block.timestamp <= _checkDeadline(m)
            && (m.inFlight == bytes32(0) || block.timestamp >= uint256(m.askedAt) + ANSWER_TIMEOUT);
    }

    function milestoneSpec(uint256 pledgeId, uint8 index) external view returns (Questions.Spec memory) {
        Pledge storage p = _pledge(pledgeId);
        return _milestone(p, pledgeId, index).spec;
    }

    /// @notice The exact oracle body a check of this milestone sends, for review or a free preflight.
    function questionOf(uint256 pledgeId, uint8 index) external view returns (string memory) {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        return string(questions.body(m.spec, m.deadline, _readAt(m), p.panelSize, p.quorum, VALID_FOR));
    }

    // previewQuestion lives on the question builder (questions.body), to keep this vault under the size limit.

    /// @notice Whether the beneficiary can check now, and the quote fits the budget and default cap.
    function checkOpen(uint256 pledgeId, uint8 index) external view returns (bool open, bool funded) {
        return _checkOpen(pledgeId, index, DEFAULT_MAX_PRICE);
    }

    /// @notice Check availability with the caller's explicit price ceiling.
    function checkOpen(uint256 pledgeId, uint8 index, uint256 maxPrice)
        external
        view
        returns (bool open, bool funded)
    {
        return _checkOpen(pledgeId, index, maxPrice);
    }

    function _checkOpen(uint256 pledgeId, uint8 index, uint256 maxPrice)
        private
        view
        returns (bool open, bool funded)
    {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        if (m.outcome != Outcome.Open || m.settled || m.attempts >= MAX_ATTEMPTS || m.appealed) return (false, false);
        if (m.spec.kind == Questions.Kind.ValueScaled && block.timestamp <= m.deadline) return (false, false);
        if (m.inFlight != bytes32(0) && block.timestamp < uint256(m.askedAt) + ANSWER_TIMEOUT) {
            return (false, false);
        }
        if (block.timestamp > _checkDeadline(m)) return (false, false);
        open = true;
        uint256 price = intake.priceOf(action, address(imd));
        funded = price != 0 && price <= maxPrice && p.budget >= price;
    }

    // ------------------------------------------------------------------ admin

    /// @notice Starts a public 7-day wait before the Intake, action id or oracle signer change.
    function proposeProtocol(address intake_, bytes32 action_, address signer_) external onlyOwner {
        if (intake_ == address(0) || action_ == bytes32(0) || signer_ == address(0)) {
            revert InvalidConfiguration();
        }
        uint64 readyAt = uint64(block.timestamp + PROTOCOL_DELAY);
        pendingProtocol = ProtocolChange(intake_, action_, signer_, readyAt);
        emit ProtocolProposed(intake_, action_, signer_, readyAt);
    }

    function cancelProtocol() external onlyOwner {
        if (pendingProtocol.readyAt == 0) revert NothingPending();
        delete pendingProtocol;
        emit ProtocolProposed(address(0), bytes32(0), address(0), 0);
    }

    /// @notice Anyone may apply a proposed change once its wait is over.
    function executeProtocol() external {
        ProtocolChange memory c = pendingProtocol;
        if (c.readyAt == 0) revert NothingPending();
        if (block.timestamp < c.readyAt) revert TooEarly();
        delete pendingProtocol;
        _setProtocol(c.intake, c.action, c.signer);
    }

    /// @notice Panel settings for pledges created from now on. Existing pledges keep theirs.
    function setPanel(uint16 panelSize_, uint16 quorum_) external onlyOwner {
        _setPanel(panelSize_, quorum_);
    }

    /// @notice Hands the admin role to `next`, or renounces it with the zero address.
    function setOwner(address next) external onlyOwner {
        owner = next;
        emit OwnerChanged(next);
    }

    // ------------------------------------------------------------------ internals

    /// @dev Everything but a page can be checked until the end of the grace window: chain questions
    /// read the deadline's block and a release carries its publication time. A page is read live.
    function _checkDeadline(Milestone storage m) private view returns (uint256) {
        return uint256(m.deadline) + (m.spec.kind == Questions.Kind.PageContains ? 0 : GRACE);
    }

    /// @dev The moment a chain question reads: now while the deadline is ahead (an early proof), the
    /// deadline after it (a fixed past block).
    function _readAt(Milestone storage m) private view returns (uint64) {
        return block.timestamp < m.deadline ? uint64(block.timestamp) : m.deadline;
    }

    /// @dev Basis points of the tranche earned by `value` between `floor` (none) and `target` (all).
    function _share(uint256 value, uint256 floor, uint256 target) private pure returns (uint16) {
        if (value <= floor) return 0;
        if (value >= target) return FULL;
        // mulDiv: no overflow however large the target, and the result is below FULL here
        return uint16(Math.mulDiv(value - floor, FULL, target - floor));
    }

    function _fund(uint256 pledgeId, uint256 amount) private {
        _pullExact(imd, amount);
        _pledges[pledgeId].budget += amount;
        totalBudgets += amount;
        emit BudgetFunded(pledgeId, msg.sender, amount);
    }

    function _pullExact(IERC20 token, uint256 amount) private {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) != before + amount) revert TransferMismatch();
    }

    function _clear(uint256 pledgeId, uint8 index, Milestone storage m) private {
        emit CheckCleared(pledgeId, index, m.inFlight);
        m.inFlight = bytes32(0);
        m.inFlightIntake = address(0);
        m.inFlightSigner = address(0);
        m.inFlightPrice = 0;
    }

    /// @dev `_verifyAttestation`, against the signer a check was asked under rather than the current one.
    function _verifyWith(OracleAttestation.Attestation calldata a, bytes calldata signature, address signer)
        private
        view
    {
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > a.expiresAt) revert AttestationExpired(a.expiresAt);
        // forge-lint: disable-next-line(block-timestamp)
        if (a.issuedAt > block.timestamp + ISSUED_AT_TOLERANCE) revert AttestationNotYetValid(a.issuedAt);
        if (!SignatureChecker.isValidSignatureNowCalldata(signer, attestationDigest(a), signature)) {
            revert BadSignature();
        }
    }

    function _setProtocol(address intake_, bytes32 action_, address signer_) private {
        if (intake_ == address(0) || action_ == bytes32(0)) revert InvalidConfiguration();
        intake = IIntake(intake_);
        action = action_;
        _setOracleSigner(signer_);
        emit ProtocolSet(intake_, action_, signer_);
    }

    function _setPanel(uint16 panelSize_, uint16 quorum_) private {
        if (panelSize_ < 5 || panelSize_ > 100 || quorum_ <= panelSize_ / 2 || quorum_ > panelSize_) {
            revert InvalidConfiguration();
        }
        panelSize = panelSize_;
        quorum = quorum_;
        emit PanelSet(panelSize_, quorum_);
    }

    function _pledge(uint256 pledgeId) private view returns (Pledge storage p) {
        p = _pledges[pledgeId];
        if (p.creator == address(0)) revert UnknownPledge();
    }

    function _milestone(Pledge storage p, uint256 pledgeId, uint8 index)
        private
        view
        returns (Milestone storage)
    {
        if (index >= p.count) revert UnknownMilestone();
        return _milestones[pledgeId][index];
    }
}
