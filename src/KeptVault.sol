// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {OracleAttestation, OracleAttestationConsumer} from "./OracleAttestation.sol";
import {IIntake} from "./interfaces/IIntake.sol";
import {Questions} from "./libraries/Questions.sol";

/// @title KEPT: promises the IMD swarm enforces
/// @notice A team locks tokens behind milestones. At each deadline the IMD reasoning oracle checks
/// the milestone and signs a verdict for this contract. A kept milestone releases its tranche to the
/// team's beneficiary; a milestone nobody proves by `deadline + GRACE` is burned.
/// @dev The oracle callback only verifies and records (it gets 200k gas, once); tokens move in
/// `settle`. Nothing can move locked tokens except a verdict or a missed deadline.
contract KeptVault is OracleAttestationConsumer, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Outcome {
        Open,
        Kept,
        Broken
    }

    struct MilestoneInput {
        Questions.Kind kind;
        uint64 deadline;
        uint128 amount;
        uint64 chainId;
        address target;
        uint256 threshold;
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
    address public constant BURN = 0x000000000000000000000000000000000000dEaD;

    /// @notice The IMD token on this chain: pays for checks. Immutable so budgets keep their meaning.
    IERC20 public immutable imd;

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
    error TransferMismatch();
    error OnlyIntake();
    error UnknownRequest();
    error InvalidAttestation();
    error AlreadySettled();
    error NothingPending();

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
        uint16 quorum_
    ) OracleAttestationConsumer(signer_) {
        if (owner_ == address(0) || imd_ == address(0)) revert InvalidConfiguration();
        owner = owner_;
        imd = IERC20(imd_);
        _setProtocol(intake_, action_, signer_);
        _setPanel(panelSize_, quorum_);
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
            Questions.Spec memory spec = Questions.Spec(m.kind, m.chainId, m.target, m.threshold, m.a, m.b);
            Questions.validate(spec);
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

    /// @notice Buys one oracle check for a milestone, paid from the pledge budget.
    /// @dev Only the creator or beneficiary may ask: unproven means broken, so a check can only ever
    /// help the team, and nobody else can spend the pledge's attempts or budget. Open from creation
    /// (to prove early delivery) until `deadline + GRACE`.
    function check(uint256 pledgeId, uint8 index) external nonReentrant returns (bytes32 requestId) {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        if (m.outcome != Outcome.Open || m.settled) revert NotOpen();
        if (m.inFlight != bytes32(0)) {
            if (block.timestamp < uint256(m.askedAt) + ANSWER_TIMEOUT) revert CheckInFlight();
            _clear(pledgeId, index, m);
        }
        if (block.timestamp > uint256(m.deadline) + GRACE) revert CheckWindowClosed();
        if (msg.sender != p.creator && msg.sender != p.beneficiary) revert NotAllowed();
        if (m.attempts >= MAX_ATTEMPTS) revert AttemptsExhausted();

        IIntake target = intake;
        uint256 price = target.priceOf(action, address(imd));
        if (price == 0) revert InvalidConfiguration();
        if (p.budget < price) revert InsufficientBudget(p.budget, price);
        p.budget -= price;
        totalBudgets -= price;
        m.attempts += 1;

        bytes memory body = Questions.body(m.spec, m.deadline, p.panelSize, p.quorum, VALID_FOR);
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
        emit CheckRequested(pledgeId, index, requestId, m.attempts, price);
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
        if (
            a.chainId != Questions.questionChain(m.spec) || a.panelSize < p.panelSize || a.quorum < p.quorum
                || a.quorum > a.panelSize || (!chainEvidence && a.agreed < a.quorum) || a.agreed > a.panelSize
                || a.issuedAt < m.askedAt || a.expiresAt < a.issuedAt || a.answer.length != 32
        ) revert InvalidAttestation();
        bool kept = decodeBool(a);
        _consume(a.requestId);

        uint256 price = m.inFlightPrice;
        m.inFlight = bytes32(0);
        m.inFlightIntake = address(0);
        m.inFlightSigner = address(0);
        m.inFlightPrice = 0;
        emit Verdict(t.pledgeId, t.index, a.requestId, kept, a.agreed, a.quorum, a.panelSize);
        if (!kept) return;

        // Kept is final, so this runs at most once per milestone.
        m.outcome = Outcome.Kept;
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

        address to;
        if (m.outcome == Outcome.Kept) {
            to = p.beneficiary;
        } else {
            if (block.timestamp <= uint256(m.deadline) + GRACE) revert TooEarly();
            if (m.inFlight != bytes32(0)) {
                if (block.timestamp < uint256(m.askedAt) + ANSWER_TIMEOUT) revert CheckInFlight();
                _clear(pledgeId, index, m);
            }
            m.outcome = Outcome.Broken;
            to = BURN;
        }

        uint128 amount = m.amount;
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

    function milestoneSpec(uint256 pledgeId, uint8 index) external view returns (Questions.Spec memory) {
        Pledge storage p = _pledge(pledgeId);
        return _milestone(p, pledgeId, index).spec;
    }

    /// @notice The exact oracle body a check of this milestone sends, for review or a free preflight.
    function questionOf(uint256 pledgeId, uint8 index) external view returns (string memory) {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        return string(Questions.body(m.spec, m.deadline, p.panelSize, p.quorum, VALID_FOR));
    }

    /// @notice The body a milestone would send, before creating it. Reverts on invalid input.
    function previewQuestion(MilestoneInput calldata m) external view returns (string memory) {
        Questions.Spec memory spec = Questions.Spec(m.kind, m.chainId, m.target, m.threshold, m.a, m.b);
        Questions.validate(spec);
        return string(Questions.body(spec, m.deadline, panelSize, quorum, VALID_FOR));
    }

    /// @notice Whether the team can call `check` right now, and if the budget covers it.
    function checkOpen(uint256 pledgeId, uint8 index) external view returns (bool open, bool funded) {
        Pledge storage p = _pledge(pledgeId);
        Milestone storage m = _milestone(p, pledgeId, index);
        if (m.outcome != Outcome.Open || m.settled || m.attempts >= MAX_ATTEMPTS) return (false, false);
        if (m.inFlight != bytes32(0) && block.timestamp < uint256(m.askedAt) + ANSWER_TIMEOUT) {
            return (false, false);
        }
        if (block.timestamp > uint256(m.deadline) + GRACE) return (false, false);
        open = true;
        uint256 price = intake.priceOf(action, address(imd));
        funded = price != 0 && p.budget >= price;
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
