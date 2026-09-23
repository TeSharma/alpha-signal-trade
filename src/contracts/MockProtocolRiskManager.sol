// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockProtocolRiskManager
 * @notice Test double exposing exactly the IRiskView surface SettlementVault
 *         reads (`minimumCoverageBps`, `currentMaxProtoLiab`, `status`) so
 *         Phase 1 coverage-boundary tests can drive liability scenarios while
 *         real risk-manager logic lands in Phase 2. Test helper only — no
 *         authorization, no economics.
 */
contract MockProtocolRiskManager {
    uint256 public minimumCoverageBps;
    uint256 public currentMaxProtoLiab;
    uint8 public currentStatus;

    function setMinimumCoverageBps(uint256 value) external {
        minimumCoverageBps = value;
    }

    function setCurrentMaxProtoLiab(uint256 value) external {
        currentMaxProtoLiab = value;
    }

    function setStatus(uint8 value) external {
        currentStatus = value;
    }

    function status() external view returns (uint8) {
        return currentStatus;
    }
}