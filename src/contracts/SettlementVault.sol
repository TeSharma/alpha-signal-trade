// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRiskView {
    function minimumCoverageBps() external view returns (uint256);
    function currentMaxProtoLiab() external view returns (uint256);
    function status() external view returns (uint8);
}

/**
 * @title SettlementVault — Phase 1 accounting core (Model-B target architecture).
 * @notice Sole custodian of protocol-owned settlement capital, safety reserve
 *         and ops allocation as three explicit accounting ledgers over one
 *         physical USDC balance. User margin NEVER enters this vault.
 * @dev Phase 1: settlement outflows are live. transferLedger enforces the
 *      governance coverage guard `S' * 10000 >= Cmin * L0` on settlement-ledger
 *      outflows (reserve/ops movements are governed separately and never enter
 *      the coverage numerator); emergencyTransferLedger (EMERGENCY_ROLE)
 *      bypasses the guard with a reason and records post-action coverage and
 *      status; settleProfit (SETTLER_ROLE, V3-only via role) applies the
 *      absolute `gross <= settlementLedger` check and pushes both legs
 *      atomically (Option B: treasury fee leaves the vault immediately);
 *      retainSurplus (SETTLER_ROLE) pulls realized loss surplus into
 *      settlementLedger. Post-close coverage (post-close L') is enforced by
 *      ProtocolRiskManager.authorizeSettle inside the V3 close path (Phase 3).
 *      Treasury convention B: fees transfer immediately to the external
 *      treasury wallet and never accrue inside the vault; opsLedger holds
 *      seeded operating capital only. External hedge coverage is exactly 0
 *      (no setter exists for hedgeCommitted).
 */
contract SettlementVault is AccessControl {
    error SameLedger();
    error ZeroAmount();
    error ZeroAddress();
    error UnknownLedger(bytes32 id);
    error InsufficientLedger(uint256 requested, uint256 available);
    error InsufficientSettlement(uint256 required, uint256 available);
    error CoverageBreach(uint256 postSettlement, uint256 minCoverageBps, uint256 liability);
    error RiskManagerNotSet();
    error TreasuryMismatch();
    error ReasonRequired();
    error PhysicalInvariantBroken();

    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    bytes32 public constant LEDGER_SETTLEMENT = keccak256("LEDGER_SETTLEMENT");
    bytes32 public constant LEDGER_RESERVE = keccak256("LEDGER_RESERVE");
    bytes32 public constant LEDGER_OPS = keccak256("LEDGER_OPS");
    /// @dev External physical-exit sink: USDC is transferred to `treasury`.
    bytes32 public constant LEDGER_TREASURY = keccak256("LEDGER_TREASURY");

    IERC20 public immutable usdc;
    address public treasury;
    /// @dev IRiskView (ProtocolRiskManager in Phase 2+; MockProtocolRiskManager in tests).
    address public riskManager;

    uint256 public settlementLedger;
    uint256 public settlementSeeded;
    uint256 public settlementSurplusRetained;
    uint256 public reserveLedger;
    uint256 public reserveTarget;
    uint256 public opsLedger;
    uint256 public v2BackstopReceivable;
    uint256 public hedgeCommitted;

    event CapitalSeeded(address indexed seeder, uint256 settlement, uint256 reserve, uint256 ops);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RiskManagerUpdated(address indexed riskManager);
    event LedgerTransfer(bytes32 indexed fromLedger, bytes32 indexed toLedger, uint256 amount, string reason);
    event EmergencyLedgerTransfer(
        bytes32 indexed fromLedger,
        bytes32 indexed toLedger,
        uint256 amount,
        string reason,
        uint256 coverageBpsAfter,
        uint8 statusAfter
    );
    event SurplusRetained(uint256 indexed positionId, uint256 amount);
    event ProfitSettled(
        uint256 indexed positionId,
        address indexed trader,
        uint256 traderProfit,
        uint256 treasuryFee
    );

    constructor(address _usdc, address _treasury, address _admin) {
        require(_usdc != address(0), "Invalid USDC");
        require(_treasury != address(0), "Invalid treasury");
        require(_admin != address(0), "Invalid admin");
        usdc = IERC20(_usdc);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(EMERGENCY_ROLE, _admin);
    }

    /**
     * @notice Seed protocol-owned capital into the three ledgers.
     * @dev Funding source must be protocol-owned capital, never user
     *      collateral. Callable by governance/multisig (DEFAULT_ADMIN_ROLE).
     */
    function seedCapital(uint256 settlement, uint256 reserve, uint256 ops) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 total = settlement + reserve + ops;
        require(total > 0, "Nothing to seed");
        require(usdc.transferFrom(msg.sender, address(this), total), "Seed transfer failed");
        settlementLedger += settlement;
        settlementSeeded += settlement;
        reserveLedger += reserve;
        if (reserveTarget == 0) reserveTarget = reserve;
        opsLedger += ops;
        _assertPhysical();
        emit CapitalSeeded(msg.sender, settlement, reserve, ops);
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /**
     * @notice Wire the IRiskView provider (init-order step: Manager → Vault).
     * @dev Required before any settlement-ledger outflow (guard + emergency
     *      reporting read `minimumCoverageBps`, `currentMaxProtoLiab`, `status`).
     */
    function setRiskManager(address _riskManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_riskManager == address(0)) revert ZeroAddress();
        riskManager = _riskManager;
        emit RiskManagerUpdated(_riskManager);
    }

    /** @notice Sum of all USDC-denominated ledger claims on this vault. */
    function accountedTotal() public view returns (uint256) {
        return settlementLedger + reserveLedger + opsLedger;
    }

    /**
     * @notice Physical-balance invariant: ledgers are partitions of one
     *         physical balance, so no ledger may exceed physical USDC.
     */
    function checkPhysicalInvariant() external view returns (bool) {
        return usdc.balanceOf(address(this)) == accountedTotal();
    }

    /**
     * @notice Governance transfer between ledgers, or physical exit to treasury.
     * @dev Settlement-ledger outflows enforce the approved coverage guard
     *      `S' * 10000 >= Cmin * L0` (this action removes capital without
     *      removing liability). Reserve/ops movements are governed separately
     *      and never enter the coverage numerator.
     */
    function transferLedger(bytes32 from, bytes32 to, uint256 amount, string calldata reason)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _validateTransfer(from, to, amount);
        if (from == LEDGER_SETTLEMENT) {
            _assertPostTransferCoverage(amount);
        }
        _executeTransfer(from, to, amount);
        _assertPhysical();
        emit LedgerTransfer(from, to, amount, reason);
    }

    /**
     * @notice Emergency transfer (EMERGENCY_ROLE): bypasses the coverage guard.
     * @dev Requires a non-empty reason and a wired risk manager; reports
     *      post-action coverage and status in the event. Never automatic.
     */
    function emergencyTransferLedger(bytes32 from, bytes32 to, uint256 amount, string calldata reason)
        external
        onlyRole(EMERGENCY_ROLE)
    {
        if (bytes(reason).length == 0) revert ReasonRequired();
        if (riskManager == address(0)) revert RiskManagerNotSet();
        _validateTransfer(from, to, amount);
        _executeTransfer(from, to, amount);
        _assertPhysical();
        (uint256 coverageBpsAfter, uint8 statusAfter) = _postActionRisk();
        emit EmergencyLedgerTransfer(from, to, amount, reason, coverageBpsAfter, statusAfter);
    }

    /**
     * @notice Pay one winning close: full gross profit debit, two legs out (V3-only via SETTLER_ROLE).
     * @dev Absolute check `pnlGross <= settlementLedger` first. Option B: the
     *      treasury close-fee leg leaves the vault immediately to the governed
     *      treasury wallet and never accrues in any ledger. Post-close coverage
     *      (post-close L') is enforced by ProtocolRiskManager.authorizeSettle
     *      inside the V3 close path (Phase 3), not here.
     */
    function settleProfit(
        address trader,
        address feeDestination,
        uint256 traderProfit,
        uint256 treasuryFee,
        uint256 positionId
    ) external onlyRole(SETTLER_ROLE) {
        if (trader == address(0) || feeDestination == address(0)) revert ZeroAddress();
        if (feeDestination != treasury) revert TreasuryMismatch();
        uint256 gross = traderProfit + treasuryFee;
        if (gross == 0) revert ZeroAmount();
        if (gross > settlementLedger) revert InsufficientSettlement(gross, settlementLedger);
        settlementLedger -= gross;
        if (traderProfit > 0) {
            require(usdc.transfer(trader, traderProfit), "Trader payout failed");
        }
        if (treasuryFee > 0) {
            require(usdc.transfer(feeDestination, treasuryFee), "Treasury fee failed");
        }
        _assertPhysical();
        emit ProfitSettled(positionId, trader, traderProfit, treasuryFee);
    }

    /**
     * @notice Pull realized loss surplus into settlementLedger (V3-only via SETTLER_ROLE).
     * @dev Caller (V3 collateral store) must hold and approve the USDC; the
     *      dollar moves once — from user-collateral custody into settlement
     *      capital — never double-counted.
     */
    function retainSurplus(uint256 amount, uint256 positionId) external onlyRole(SETTLER_ROLE) {
        if (amount == 0) revert ZeroAmount();
        require(usdc.transferFrom(msg.sender, address(this), amount), "Surplus pull failed");
        settlementLedger += amount;
        settlementSurplusRetained += amount;
        _assertPhysical();
        emit SurplusRetained(positionId, amount);
    }

    // ————— internals —————

    function _validateTransfer(bytes32 from, bytes32 to, uint256 amount) internal view {
        if (from == to) revert SameLedger();
        if (amount == 0) revert ZeroAmount();
        if (from != LEDGER_SETTLEMENT && from != LEDGER_RESERVE && from != LEDGER_OPS) {
            revert UnknownLedger(from);
        }
        if (to != LEDGER_SETTLEMENT && to != LEDGER_RESERVE && to != LEDGER_OPS && to != LEDGER_TREASURY) {
            revert UnknownLedger(to);
        }
        uint256 bal = _ledgerBal(from);
        if (bal < amount) revert InsufficientLedger(amount, bal);
    }

    /// @dev Governance guard: post-transfer settlement must still cover open liability.
    function _assertPostTransferCoverage(uint256 amount) internal view {
        if (riskManager == address(0)) revert RiskManagerNotSet();
        IRiskView rm = IRiskView(riskManager);
        uint256 post = settlementLedger - amount;
        uint256 cmin = rm.minimumCoverageBps();
        uint256 l0 = rm.currentMaxProtoLiab();
        if (post * 10000 < cmin * l0) revert CoverageBreach(post, cmin, l0);
    }

    function _executeTransfer(bytes32 from, bytes32 to, uint256 amount) internal {
        if (from == LEDGER_SETTLEMENT) {
            settlementLedger -= amount;
        } else if (from == LEDGER_RESERVE) {
            reserveLedger -= amount;
        } else {
            opsLedger -= amount;
        }
        if (to == LEDGER_TREASURY) {
            require(usdc.transfer(treasury, amount), "Treasury transfer failed");
        } else {
            _increaseLedger(to, amount);
        }
    }

    function _ledgerBal(bytes32 id) internal view returns (uint256) {
        if (id == LEDGER_SETTLEMENT) return settlementLedger;
        if (id == LEDGER_RESERVE) return reserveLedger;
        if (id == LEDGER_OPS) return opsLedger;
        revert UnknownLedger(id);
    }

    function _increaseLedger(bytes32 id, uint256 amount) internal {
        if (id == LEDGER_SETTLEMENT) {
            settlementLedger += amount;
        } else if (id == LEDGER_RESERVE) {
            reserveLedger += amount;
        } else if (id == LEDGER_OPS) {
            opsLedger += amount;
        } else {
            revert UnknownLedger(id);
        }
    }

    /**
     * @dev Post-action coverage/status for the emergency report. With L0 == 0
     *      there is no liability to cover; coverage is reported as 0 and the
     *      authoritative band comes from the risk manager's status().
     */
    function _postActionRisk() internal view returns (uint256 coverageBps, uint8 statusAfter) {
        IRiskView rm = IRiskView(riskManager);
        uint256 l0 = rm.currentMaxProtoLiab();
        coverageBps = l0 == 0 ? 0 : settlementLedger * 10000 / l0;
        statusAfter = rm.status();
    }

    function _assertPhysical() internal view {
        if (usdc.balanceOf(address(this)) != accountedTotal()) revert PhysicalInvariantBroken();
    }
}
