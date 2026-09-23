// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IHedgeManager — future external liquidity/hedging abstraction.
 * @notice Model-B target architecture interface. NO implementation exists.
 * @dev Consumers must treat a zero address or a zero return as "no hedge".
 *      Countable external coverage is exactly 0 until a verified,
 *      collateral-backed provider is wired and governed. The existence of
 *      this interface never implies ShTrader is hedged.
 */
interface IHedgeManager {
    /**
     * @notice Verifiably committed, immediately countable external coverage,
     *         in collateral base units, after haircut/redemption/drawdown terms.
     * @dev Must return 0 unless collateral is posted or cryptographically
     *      locked for the protocol benefit with proof. Uncollateralized
     *      quotes count as 0.
     */
    function committedCoverage() external view returns (uint256);
}
