// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ProtocolRiskManager — Phase 0 scaffold (Model-B target architecture).
 * @notice Authoritative on-chain admission gate for TradingPlatformV3.
 *         Frontend/Supabase checks are advisory only; this contract's
 *         authorizeOpen / authorizeSettle views decide inside the tx path.
 * @dev Phase 0: storage, roles and view stubs only. All admission logic
 *      reverts NotImplemented until Phase 2. Approved math (binding):
 *      admit open  <=> (S + X) * 10000 >= Cmin * (L0 + M_new)
 *      allow settle <=> pnlGross <= S AND S' * 10000 >= Cmin * L',
 *        where S' = S - pnlGross, L' = L0 - closingM, closingM <= L0.
 *      External coverage X is exactly 0 until a verified provider exists.
 */
contract ProtocolRiskManager is AccessControl {
    error NotImplemented();

    address public vault;
    address public platform;
    address public hedgeManager;

    uint256 public minimumCoverageBps;
    uint256 public capPerPair;
    uint256 public capPerCorrGroup;
    bool public paused;
    bool public admissionHalted;

    event RiskParamsUpdated(uint256 minimumCoverageBps, uint256 capPerPair, uint256 capPerCorrGroup);
    event AdmissionBlocked(bytes32 indexed pairId, string reason, uint256 coverageBps);
    event SettlementBlocked(uint256 indexed positionId, string reason);
    event SettlementInsolvent(uint256 indexed positionId, uint256 pnlGross, uint256 settlementAvailable);

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

    function setPaused(bool _paused) external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = _paused;
    }

    function setAdmissionHalted(bool _halted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        admissionHalted = _halted;
    }

    function authorizeOpen(bytes32, uint256, uint256) external pure returns (bool) {
        revert NotImplemented();
    }

    // Phase-0 stubs are declared `view` per spec (Phase 2 reads vault state).
    // Each body performs one genuine storage read so solc enforces `view`
    // instead of suggesting `pure`; every path still reverts NotImplemented.

    function authorizeSettle(uint256, uint256) external view returns (bool) {
        if (vault == address(0)) revert NotImplemented();
        revert NotImplemented();
    }

    function maxPermittedLiability() external view returns (uint256) {
        if (minimumCoverageBps == 0) revert NotImplemented();
        revert NotImplemented();
    }

    function coverageMaxBps() external view returns (uint256) {
        if (vault == address(0)) revert NotImplemented();
        revert NotImplemented();
    }

    function status() external view returns (uint8) {
        if (paused || admissionHalted) revert NotImplemented();
        revert NotImplemented();
    }
}
