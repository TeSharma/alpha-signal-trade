// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPriceOracleV2 {
    function getPrice(bytes32 pairId) external view returns (uint256 price, uint256 updatedAt);
}

interface ISettlementVault {
    function settleProfit(
        address trader,
        address feeDestination,
        uint256 traderProfit,
        uint256 treasuryFee,
        uint256 positionId
    ) external;

    function retainSurplus(uint256 amount, uint256 positionId) external;

    function treasury() external view returns (address);
}

interface IProtocolRiskManager {
    function authorizeOpen(
        bytes32 pairId,
        uint256 newMaxProfitNet,
        uint256 notional
    ) external view returns (bool);

    function authorizeSettle(uint256 closingM, uint256 pnlGross) external view returns (bool);

    function registerOpen(bytes32 pairId, uint256 maxProfitNet) external;

    function registerClose(bytes32 pairId, uint256 maxProfitNet) external;

    function currentMaxProtoLiab() external view returns (uint256);

    function pairMaxProfitLiab(bytes32 pairId) external view returns (uint256);

    function corrGroupLiab(bytes8 group) external view returns (uint256);
}

/**
 * @title TradingPlatformV3 — Model-B Phase 3 Execution Engine
 * @notice Separates user collateral custody (held here) from SettlementVault capital.
 *         Wires atomic liability tracking to ProtocolRiskManager.
 */
contract TradingPlatformV3 is Ownable, ReentrancyGuard {
    error PositionClosedAlready();
    error NotPositionOwner();
    error NotAuthorisedKeeper();
    error TriggerNotReached();
    error NoTriggerSet();
    error NotLiquidatable();
    error AdmissionDenied();
    error SettlementDenied();
    error StalePrice();
    error InvalidPrice();
    error MarginTooLow();
    error InvalidLeverage();
    error MarginTooSmallForFees();
    error TransferFailed();
    error FeeTransferFailed();
    error LiquidatorRewardFailed();
    error ProtocolFeeFailed();
    error PlatformPaused();
    error AdmissionHaltedActive();

    struct Position {
        address trader;
        bytes32 pairId;
        bool isLong;
        uint256 margin;         // Net margin after open fee
        uint256 leverage;
        uint256 notional;
        uint256 entryPrice;
        uint256 liquidationPrice;
        uint256 stopLoss;
        uint256 takeProfit;
        uint256 maxProfitLiab;  // Registered liability M_i
        bool isOpen;
    }

    IERC20 public immutable collateralToken;
    IPriceOracleV2 public oracle;
    ISettlementVault public settlementVault;
    IProtocolRiskManager public riskManager;

    uint256 public maxLeverage = 50;              // 50x
    uint256 public maintenanceMarginBps = 1000;   // 10%
    uint256 public maxProfitBps = 30000;          // 300%
    uint256 public priceTimeout = 120;            // 2 minutes

    uint256 public nextPositionId = 1;

    address public treasury;
    uint256 public openFeeBps = 8;      // 0.08%
    uint256 public closeFeeBps = 8;     // 0.08%
    uint256 public liquidatorRewardBps = 3000; // 30%

    bool public paused;
    bool public admissionHalted;

    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) public userPositions;
    mapping(address => bool) public keepers;

    event PositionOpened(
        uint256 indexed id,
        address indexed trader,
        bytes32 pairId,
        bool isLong,
        uint256 margin,
        uint256 leverage,
        uint256 entryPrice,
        uint256 maxProfitLiab
    );

    event PositionClosed(
        uint256 indexed id,
        address indexed trader,
        uint256 exitPrice,
        int256 pnl
    );

    event PositionLiquidated(
        uint256 indexed id,
        address indexed trader,
        address indexed liquidator,
        uint256 price,
        uint256 penalty
    );

    event PositionTriggerClosed(
        uint256 indexed id,
        address indexed trader,
        address indexed keeper,
        uint256 price,
        bool isStopLoss
    );

    event ProtocolFeeCollected(
        uint256 indexed positionId,
        address indexed trader,
        uint256 amount,
        string feeType
    );

    event RiskManagerUpdated(address indexed oldManager, address indexed newManager);
    event VaultUpdated(address indexed oldVault, address indexed newVault);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TradingFeesUpdated(uint256 openFeeBps, uint256 closeFeeBps);
    event LiquidatorRewardUpdated(uint256 rewardBps);
    event KeeperUpdated(address indexed keeper, bool allowed);
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

        oracle = IPriceOracleV2(_oracle);
        collateralToken = IERC20(_collateral);
        settlementVault = ISettlementVault(_vault);
        riskManager = IProtocolRiskManager(_riskManager);
        treasury = _owner;
    }


    /*//////////////////////////////////////////////////////////////
                          POSITION MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function openPosition(
        bytes32 pairId,
        bool isLong,
        uint256 margin,
        uint256 leverage,
        uint256 stopLoss,
        uint256 takeProfit
    ) external nonReentrant returns (uint256 id) {
        if (paused) revert PlatformPaused();
        if (admissionHalted) revert AdmissionHaltedActive();
        if (margin == 0) revert MarginTooLow();
        if (leverage == 0 || leverage > maxLeverage) revert InvalidLeverage();

        uint256 openFee = (margin * openFeeBps) / 10_000;
        uint256 netMargin = margin - openFee;
        if (netMargin == 0) revert MarginTooSmallForFees();

        (uint256 price, uint256 updatedAt) = oracle.getPrice(pairId);
        if (price == 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > priceTimeout) revert StalePrice();

        // Transfer collateral from user into V3 (user custody stays here)
        if (!collateralToken.transferFrom(msg.sender, address(this), margin)) {
            revert TransferFailed();
        }

        id = nextPositionId++;

        // Transfer fee to treasury
        if (openFee > 0 && treasury != address(0)) {
            if (!collateralToken.transfer(treasury, openFee)) {
                revert FeeTransferFailed();
            }
            emit ProtocolFeeCollected(id, msg.sender, openFee, "open");
        }

        // M_i = netMargin * maxProfitBps / 10000
        uint256 maxProfitLiab = (netMargin * maxProfitBps) / 10000;

        // Authoritative admission check (pre-registration)
        if (!riskManager.authorizeOpen(pairId, maxProfitLiab, netMargin * leverage)) {
            revert AdmissionDenied();
        }

        // Atomic liability registration on ProtocolRiskManager
        riskManager.registerOpen(pairId, maxProfitLiab);

        Position storage p = positions[id];
        p.trader = msg.sender;
        p.pairId = pairId;
        p.isLong = isLong;
        p.margin = netMargin;
        p.leverage = leverage;
        p.notional = netMargin * leverage;
        p.entryPrice = price;
        p.liquidationPrice = _calcLiquidationPrice(price, leverage, isLong);
        p.stopLoss = stopLoss;
        p.takeProfit = takeProfit;
        p.maxProfitLiab = maxProfitLiab;
        p.isOpen = true;

        userPositions[msg.sender].push(id);

        emit PositionOpened(
            id,
            msg.sender,
            pairId,
            isLong,
            netMargin,
            leverage,
            price,
            maxProfitLiab
        );
    }

    function closePosition(uint256 id) external nonReentrant {
        Position storage p = positions[id];
        if (!p.isOpen) revert PositionClosedAlready();
        if (p.trader != msg.sender) revert NotPositionOwner();

        (uint256 price, uint256 updatedAt) = oracle.getPrice(p.pairId);
        if (price == 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > priceTimeout) revert StalePrice();

        _closePosition(id, price);
    }


    function closeWithTrigger(uint256 id) external nonReentrant {
        if (!keepers[msg.sender]) revert NotAuthorisedKeeper();

        Position storage p = positions[id];
        if (!p.isOpen) revert PositionClosedAlready();
        if (p.stopLoss == 0 && p.takeProfit == 0) revert NoTriggerSet();

        (uint256 price, uint256 updatedAt) = oracle.getPrice(p.pairId);
        if (price == 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > priceTimeout) revert StalePrice();

        bool slHit;
        bool tpHit;

        if (p.isLong) {
            slHit = p.stopLoss > 0 && price <= p.stopLoss;
            tpHit = p.takeProfit > 0 && price >= p.takeProfit;
        } else {
            slHit = p.stopLoss > 0 && price >= p.stopLoss;
            tpHit = p.takeProfit > 0 && price <= p.takeProfit;
        }

        if (!slHit && !tpHit) revert TriggerNotReached();

        address trader = p.trader;
        uint256 exitPrice = slHit ? p.stopLoss : p.takeProfit;

        _closePosition(id, exitPrice);

        emit PositionTriggerClosed(id, trader, msg.sender, exitPrice, slHit);
    }

    function liquidate(uint256 id) external nonReentrant {
        Position storage p = positions[id];
        if (!p.isOpen) revert PositionClosedAlready();

        (uint256 price, uint256 updatedAt) = oracle.getPrice(p.pairId);
        if (price == 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > priceTimeout) revert StalePrice();

        bool liquidatable = p.isLong
            ? price <= p.liquidationPrice
            : price >= p.liquidationPrice;

        if (!liquidatable) revert NotLiquidatable();

        p.isOpen = false;

        // Atomically remove liability from ProtocolRiskManager
        riskManager.registerClose(p.pairId, p.maxProfitLiab);

        uint256 penalty = p.margin;
        uint256 liquidatorReward = (penalty * liquidatorRewardBps) / 10_000;
        uint256 protocolFee = penalty - liquidatorReward;

        if (liquidatorReward > 0) {
            if (!collateralToken.transfer(msg.sender, liquidatorReward)) {
                revert LiquidatorRewardFailed();
            }
        }

        if (protocolFee > 0 && treasury != address(0)) {
            if (!collateralToken.transfer(treasury, protocolFee)) {
                revert ProtocolFeeFailed();
            }
            emit ProtocolFeeCollected(id, p.trader, protocolFee, "liquidation");
        }

        emit PositionLiquidated(id, p.trader, msg.sender, price, penalty);
    }


    /*//////////////////////////////////////////////////////////////
                           INTERNAL SETTLEMENT
    //////////////////////////////////////////////////////////////*/

    function _closePosition(uint256 id, uint256 price) internal {
        Position storage p = positions[id];

        int256 pnl = _calculatePnL(p, price);

        if (pnl > 0) {
            uint256 grossProfit = uint256(pnl);
            uint256 closeFee = (grossProfit * closeFeeBps) / 10_000;
            uint256 traderProfit = grossProfit - closeFee;

            // Authoritative settlement decision, evaluated BEFORE the liability
            // release so the approved inequality sees L0 still INCLUDING this
            // position (closingM <= L0, post-close L' = L0 - closingM). The
            // release + settlement below stay in the same transaction, so
            // either both happen or the whole close reverts.
            if (!riskManager.authorizeSettle(p.maxProfitLiab, grossProfit)) {
                revert SettlementDenied();
            }

            // Atomically deregister liability from ProtocolRiskManager
            p.isOpen = false;
            riskManager.registerClose(p.pairId, p.maxProfitLiab);

            // Return original margin from V3 custody
            if (p.margin > 0) {
                if (!collateralToken.transfer(p.trader, p.margin)) {
                    revert TransferFailed();
                }
            }

            // Settle profit and treasury fee via SettlementVault
            settlementVault.settleProfit(p.trader, settlementVault.treasury(), traderProfit, closeFee, id);
            if (closeFee > 0) {
                emit ProtocolFeeCollected(id, p.trader, closeFee, "close");
            }
        } else {
            p.isOpen = false;

            // Atomically deregister liability from ProtocolRiskManager
            riskManager.registerClose(p.pairId, p.maxProfitLiab);

            // Loss or breakeven: trader receives remaining margin
            uint256 loss = uint256(-pnl);
            uint256 refund = p.margin > loss ? p.margin - loss : 0;
            uint256 retainedLoss = p.margin - refund;

            if (refund > 0) {
                if (!collateralToken.transfer(p.trader, refund)) {
                    revert TransferFailed();
                }
            }

            // Send retained loss surplus to SettlementVault
            if (retainedLoss > 0) {
                if (!collateralToken.approve(address(settlementVault), retainedLoss)) {
                    revert TransferFailed();
                }
                settlementVault.retainSurplus(retainedLoss, id);
            }
        }

        emit PositionClosed(id, p.trader, price, pnl);
    }

    function _calculatePnL(
        Position memory p,
        uint256 price
    ) internal view returns (int256) {
        int256 priceDiff = p.isLong
            ? int256(price) - int256(p.entryPrice)
            : int256(p.entryPrice) - int256(price);

        int256 rawPnl = (priceDiff * int256(p.notional)) / int256(p.entryPrice);
        int256 maxProfit = int256((p.margin * maxProfitBps) / 10000);

        if (rawPnl > maxProfit) return maxProfit;
        if (rawPnl < -int256(p.margin)) return -int256(p.margin);
        return rawPnl;
    }

    function _calcLiquidationPrice(
        uint256 entryPrice,
        uint256 leverage,
        bool isLong
    ) internal view returns (uint256) {
        uint256 mm = (entryPrice * maintenanceMarginBps) / 10000 / leverage;
        return isLong ? entryPrice - mm : entryPrice + mm;
    }


    /*//////////////////////////////////////////////////////////////
                              VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getPosition(uint256 id) external view returns (Position memory) {
        return positions[id];
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    function getUserOpenPositions(address user) external view returns (Position[] memory) {
        uint256[] memory ids = userPositions[user];
        uint256 openCount = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].isOpen) {
                openCount++;
            }
        }
        Position[] memory openPositions = new Position[](openCount);
        uint256 index = 0;
        for (uint256 i = 0; i < ids.length; i++) {
            if (positions[ids[i]].isOpen) {
                openPositions[index] = positions[ids[i]];
                index++;
            }
        }
        return openPositions;
    }

    function getCurrentPnL(uint256 id) external view returns (int256) {
        Position memory p = positions[id];
        if (!p.isOpen) revert PositionClosedAlready();
        (uint256 price,) = oracle.getPrice(p.pairId);
        return _calculatePnL(p, price);
    }

    /*//////////////////////////////////////////////////////////////
                             ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        address oldOracle = address(oracle);
        oracle = IPriceOracleV2(_oracle);
        emit OracleUpdated(oldOracle, _oracle);
    }

    function setRiskManager(address _manager) external onlyOwner {
        require(_manager != address(0), "Invalid manager");
        address oldManager = address(riskManager);
        riskManager = IProtocolRiskManager(_manager);
        emit RiskManagerUpdated(oldManager, _manager);
    }

    function setVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault");
        address oldVault = address(settlementVault);
        settlementVault = ISettlementVault(_vault);
        emit VaultUpdated(oldVault, _vault);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    function setTradingFees(uint256 _openFeeBps, uint256 _closeFeeBps) external onlyOwner {
        require(_openFeeBps <= 50, "Open fee too high");
        require(_closeFeeBps <= 50, "Close fee too high");
        openFeeBps = _openFeeBps;
        closeFeeBps = _closeFeeBps;
        emit TradingFeesUpdated(_openFeeBps, _closeFeeBps);
    }

    function setLiquidatorReward(uint256 _rewardBps) external onlyOwner {
        require(_rewardBps <= 5000, "Reward too high");
        liquidatorRewardBps = _rewardBps;
        emit LiquidatorRewardUpdated(_rewardBps);
    }

    function setRiskParams(
        uint256 _maxLeverage,
        uint256 _maintenanceMarginBps,
        uint256 _maxProfitBps
    ) external onlyOwner {
        maxLeverage = _maxLeverage;
        maintenanceMarginBps = _maintenanceMarginBps;
        maxProfitBps = _maxProfitBps;
    }

    function setPriceTimeout(uint256 _timeout) external onlyOwner {
        priceTimeout = _timeout;
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        require(keeper != address(0), "Invalid keeper");
        keepers[keeper] = allowed;
        emit KeeperUpdated(keeper, allowed);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function setAdmissionHalted(bool _halted) external onlyOwner {
        admissionHalted = _halted;
        emit AdmissionHaltedSet(_halted);
    }
}

