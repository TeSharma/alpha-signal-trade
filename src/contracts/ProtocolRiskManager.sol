// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./IHedgeManager.sol";

interface IVaultView {
    function settlementLedger() external view returns (uint256);
}

/**
 * @title ProtocolRiskManager — Phase 2 admission/settlement gate (Model-B target architecture).
 * @notice Authoritative on-chain admission decision for TradingPlatformV3.
 *         Frontend/Supabase checks are advisory only; V3 calls these views
 *         inside the transaction path.
 * @dev Approved math (binding):
 *      admit open  <=>  (S + X) * 10000 >= Cmin * (L0 + M_new)
 *        NEVER `S * threshold` (the inverted form). S = vault settlement ledger,
 *        X = verifiable external coverage (exactly 0 today), Cmin =
 *        minimumCoverageBps, L0 = currentMaxProtoLiab = sum of M_i where
 *        M_i = m_i * maxProfitBps / 10000 (gross, close fee NOT deducted —
 *        the close fee is funded from the same settlement capital).
 *        Example: S = $70,000, Cmin = 15000 -> max permitted liability
 *        = 70,000 * 10000 / 15000 = $46,666.67.
 *      allow settle <=> closingM <= L0
 *                       AND pnlGross <= S             (absolute check first)
 *                       AND (S - pnlGross) * 10000 >= Cmin * (L0 - closingM)
 *      Stress red-lines (planning only, never stored): $70k/4 ~= $17,500 gross
 *      stress margin; $70k/3 ~= $23,333 profit-only margin capacity.
 *      External coverage X is exactly 0 until a verified provider exists —
 *      IHedgeManager is interface-only and `hedgeManager` has no setter here.
 *      Liability registration (L0 / per-pair / per-corr-group) is platform-only
 *      (TradingPlatformV3 from Phase 3). Trust boundary: only the platform may
 *      register liability.
 *      AdmissionBlocked / SettlementBlocked / SettlementInsolvent events are
 *      REMOVED: these functions are `view` (cannot emit) and a reverting
 *      transaction discards its logs anyway — the boolean return / custom-error
 *      revert is the authoritative failure signal (same ruling as the vault's
 *      removed TransferBlocked event).
 *      `notional` is a reserved ABI parameter: no approved notional-denominated
 *      admission check exists yet, so it is intentionally unused.
 */
contract ProtocolRiskManager is AccessControl {
    error PlatformOnly();
    error LiabilityUnderflow();
    error LiabilityRegistered();
    error InvalidCoverageBands();

    address public vault;
    address public platform;
    /// @dev No setter by design in Phase 2: external coverage is exactly 0.
    address public hedgeManager;

    uint256 public minimumCoverageBps;
    uint256 public capPerPair;
    uint256 public capPerCorrGroup;
    bool public paused;
    bool public admissionHalted;

    // Status bands = approved example policy parameters, governance-configurable
    // (initial example policy only): GREEN >= 150%, WARNING 125%-150%,
    // RESTRICTED 110%-125%, CRITICAL < 110%.
    uint256 public greenCoverageBps;
    uint256 public warningCoverageBps;
    uint256 public criticalCoverageBps;

    uint256 public currentMaxProtoLiab;
    mapping(bytes32 => uint256) public pairMaxProfitLiab;
    mapping(bytes8 => uint256) public corrGroupLiab;
    mapping(bytes32 => bytes8) public pairCorrGroup;

    event RiskParamsUpdated(uint256 minimumCoverageBps, uint256 capPerPair, uint256 capPerCorrGroup);
    event CoverageBandsUpdated(uint256 greenBps, uint256 warningBps, uint256 criticalBps);
    event PlatformUpdated(address indexed platform);

    constructor(
        address _vault,
        address _platform,
        address _admin,
        uint256 _minimumCoverageBps
    ) {
        require(_vault != address(0), "Invalid vault");
        require(_admin != address(0), "Invalid admin");
        vault = _vault;
        platform = _platform;
        minimumCoverageBps = _minimumCoverageBps;
        greenCoverageBps = 15000;
        warningCoverageBps = 12500;
        criticalCoverageBps = 11000;
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
    }
    function setRiskParams(
        uint256 _minimumCoverageBps,
        uint256 _capPerPair,
        uint256 _capPerCorrGroup
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minimumCoverageBps = _minimumCoverageBps;
        capPerPair = _capPerPair;
        capPerCorrGroup = _capPerCorrGroup;
        emit RiskParamsUpdated(_minimumCoverageBps, _capPerPair, _capPerCorrGroup);
    }

    function setCoverageBands(
        uint256 _greenBps,
        uint256 _warningBps,
        uint256 _criticalBps
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!(_greenBps >= _warningBps && _warningBps >= _criticalBps)) {
            revert InvalidCoverageBands();
        }
        greenCoverageBps = _greenBps;
        warningCoverageBps = _warningBps;
        criticalCoverageBps = _criticalBps;
        emit CoverageBandsUpdated(_greenBps, _warningBps, _criticalBps);
    }

    function setPaused(bool _paused) external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = _paused;
    }

    function setAdmissionHalted(bool _halted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        admissionHalted = _halted;
    }

    /// @notice Init order: manager deploys before V3; V3 address wired here after.
    function setPlatform(address _platform) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_platform != address(0), "Invalid platform");
        platform = _platform;
        emit PlatformUpdated(_platform);
    }

    /// @notice Correlation groups must be configured BEFORE liability exists for
    ///         the pair; a pair with registered liability may not be regrouped
    ///         (would corrupt corrGroupLiab accounting).
    function setPairCorrGroup(bytes32 pairId, bytes8 group) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (pairMaxProfitLiab[pairId] != 0) {
            revert LiabilityRegistered();
        }
        pairCorrGroup[pairId] = group;
    }

    /// @notice Platform-only liability registration (V3 calls inside open path).
    function registerOpen(bytes32 pairId, uint256 maxProfitNet) external {
        if (msg.sender != platform) revert PlatformOnly();
        currentMaxProtoLiab += maxProfitNet;
        pairMaxProfitLiab[pairId] += maxProfitNet;
        bytes8 group = pairCorrGroup[pairId];
        if (group != bytes8(0)) {
            corrGroupLiab[group] += maxProfitNet;
        }
    }

    /// @notice Platform-only liability release (V3 calls atomically in close path).
    function registerClose(bytes32 pairId, uint256 maxProfitNet) external {
        if (msg.sender != platform) revert PlatformOnly();
        if (pairMaxProfitLiab[pairId] < maxProfitNet || currentMaxProtoLiab < maxProfitNet) {
            revert LiabilityUnderflow();
        }
        bytes8 group = pairCorrGroup[pairId];
        if (group != bytes8(0)) {
            if (corrGroupLiab[group] < maxProfitNet) {
                revert LiabilityUnderflow();
            }
            corrGroupLiab[group] -= maxProfitNet;
        }
        pairMaxProfitLiab[pairId] -= maxProfitNet;
        currentMaxProtoLiab -= maxProfitNet;
    }

    // ---------------------------------------------------------------------
    // Approved admission math (authoritative; view only — cannot emit events).
    // ---------------------------------------------------------------------

    /// @notice Authoritative open-admission decision (called by V3 in tx path).
    /// @dev Checks in approved order: halt/pause -> coverage inequality ->
    ///      pair cap -> correlated-group cap. `notional` reserved (see header).
    function authorizeOpen(
        bytes32 pairId,
        uint256 newMaxProfitNet,
        uint256 /* notional */
    ) external view returns (bool) {
        if (paused || admissionHalted) return false;

        uint256 l1 = currentMaxProtoLiab + newMaxProfitNet;
        (uint256 s, uint256 x) = _settlementAndExternal();

        // Authoritative inequality: S * 10000 >= Cmin * L1 (never S * threshold).
        if ((s + x) * 10000 < minimumCoverageBps * l1) return false;

        if (pairMaxProfitLiab[pairId] + newMaxProfitNet > capPerPair) return false;

        bytes8 group = pairCorrGroup[pairId];
        if (group != bytes8(0)) {
            if (corrGroupLiab[group] + newMaxProfitNet > capPerCorrGroup) return false;
        }

        return true;
    }

    /// @notice Authoritative settlement decision (V3 calls inside close path).
    /// @dev Validates closingM <= L0 before subtraction (no underflow /
    ///      liability corruption), then absolute pnlGross <= S (absolute
    ///      insolvency check BEFORE coverage), then post-close coverage
    ///      S' * 10000 >= Cmin * L' with L' = L0 - closingM, S' = S - pnlGross.
    ///      NO pause/halt gate: settlements must proceed regardless (approved).
    function authorizeSettle(uint256 closingM, uint256 pnlGross) external view returns (bool) {
        uint256 l0 = currentMaxProtoLiab;
        if (closingM > l0) return false;

        (uint256 s, uint256 x) = _settlementAndExternal();
        if (pnlGross > s + x) return false;

        uint256 lPrime = l0 - closingM;
        uint256 sPrime = (s + x) - pnlGross;
        return sPrime * 10000 >= minimumCoverageBps * lPrime;
    }

    /// @notice Max post-open liability permitted at current policy:
    ///         (S + X) * 10000 / Cmin. Cmin == 0 => no coverage bound => max.
    function maxPermittedLiability() external view returns (uint256) {
        uint256 cmin = minimumCoverageBps;
        if (cmin == 0) return type(uint256).max;
        (uint256 s, uint256 x) = _settlementAndExternal();
        return (s + x) * 10000 / cmin;
    }

    /// @notice Current coverage in bps = (S + X) * 10000 / L0.
    ///         L0 == 0 => vacuously fully covered => type(uint256).max.
    function coverageMaxBps() public view returns (uint256) {
        uint256 l0 = currentMaxProtoLiab;
        if (l0 == 0) return type(uint256).max;
        (uint256 s, uint256 x) = _settlementAndExternal();
        return (s + x) * 10000 / l0;
    }

    /// @notice 0 = GREEN, 1 = WARNING, 2 = RESTRICTED, 3 = CRITICAL.
    ///         Coverage-band only; paused/admissionHalted are separate public flags.
    function status() external view returns (uint8) {
        uint256 cov = coverageMaxBps();
        if (cov >= greenCoverageBps) return 0;
        if (cov >= warningCoverageBps) return 1;
        if (cov >= criticalCoverageBps) return 2;
        return 3;
    }

    /// @dev S = vault settlement ledger; X = verifiable external coverage,
    ///      exactly 0 while hedgeManager is unset (no setter exists in Phase 2).
    function _settlementAndExternal() internal view returns (uint256 s, uint256 x) {
        s = IVaultView(vault).settlementLedger();
        if (hedgeManager != address(0)) {
            x = IHedgeManager(hedgeManager).committedCoverage();
        }
    }
}
