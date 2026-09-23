// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TradingPlatformV3 — Phase 0 scaffold (Model-B target architecture).
 * @notice V3 preserves approved V2 P&L, liquidation-price, profit-cap, loss-cap
 *         and fee mathematics for parity testing. V3 does NOT copy V2
 *         custody/liquidity assumptions because V3 intentionally separates
 *         user collateral (held here) from SettlementVault capital.
 * @dev Phase 0: constructor, wiring, flags and hook call-sites only.
 *      Trading/settlement economics are NOT implemented yet — every
 *      state-changing trading entry point reverts NotImplemented until
 *      Phase 3. Authoritative admission happens via ProtocolRiskManager
 *      inside the tx path; winning closes settle via
 *      SettlementVault.settleProfit(trader, treasury, traderProfit,
 *      treasuryFee, positionId) atomically with liability removal.
 */
contract TradingPlatformV3 is Ownable {
    error NotImplemented();

    address public oracle;
    address public collateralToken;
    address public settlementVault;
    address public riskManager;

    bool public paused;
    bool public admissionHalted;

    event RiskManagerUpdated(address indexed oldManager, address indexed newManager);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event PausedSet(bool paused);
    event AdmissionHaltedSet(bool halted);

    constructor(
        address _oracle,
        address _collateral,
        address _vault,
        address _riskManager,
        address _owner
    ) Ownable(_owner) {
        require(_oracle != address(0), "Invalid oracle");
        require(_collateral != address(0), "Invalid collateral");
        require(_vault != address(0), "Invalid vault");
        require(_riskManager != address(0), "Invalid risk manager");
        require(_owner != address(0), "Invalid owner");
        oracle = _oracle;
        collateralToken = _collateral;
        settlementVault = _vault;
        riskManager = _riskManager;
    }

    function setRiskManager(address _manager) external onlyOwner {
        require(_manager != address(0), "Invalid manager");
        address oldManager = riskManager;
        riskManager = _manager;
        emit RiskManagerUpdated(oldManager, _manager);
    }

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault");
        address oldVault = settlementVault;
        settlementVault = _vault;
        emit VaultUpdated(oldVault, _vault);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setAdmissionHalted(bool _halted) external onlyOwner {
        admissionHalted = _halted;
        emit AdmissionHaltedSet(_halted);
    }

    /// @notice Phase 3: authorizeOpen hook + margin pull + position open.
    function openPosition(bytes32, bool, uint256, uint256, uint256, uint256) external pure returns (uint256) {
        revert NotImplemented();
    }

    /// @notice Phase 3: trader-owned close; win leg via settleProfit, loss leg via retainSurplus.
    function closePosition(uint256) external pure {
        revert NotImplemented();
    }

    /// @notice Phase 3: permissionless liquidation; 30% caller / 70% treasury; vault untouched.
    function liquidate(uint256) external pure {
        revert NotImplemented();
    }

    /// @notice Phase 3: keeper-only SL/TP trigger close through the same settlement path.
    function closeWithTrigger(uint256) external pure {
        revert NotImplemented();
    }
}
