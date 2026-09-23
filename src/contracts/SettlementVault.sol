// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SettlementVault — Phase 0 scaffold (Model-B target architecture).
 * @notice Sole custodian of protocol-owned settlement capital, safety reserve
 *         and ops allocation as three explicit accounting ledgers over one
 *         physical USDC balance. User margin NEVER enters this vault.
 * @dev Phase 0: storage, roles, events, governance seeding path and the
 *      physical-balance invariant view are live. Settlement outflows
 *      (settleProfit/retainSurplus/transferLedger/emergency) are declared
 *      stubs reverting NotImplemented until Phase 1. Treasury convention B:
 *      fees transfer immediately to the external treasury wallet and never
 *      accrue inside the vault; opsLedger holds seeded operating capital only.
 */
contract SettlementVault is AccessControl {
    error NotImplemented();

    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    bytes32 public constant LEDGER_SETTLEMENT = keccak256("LEDGER_SETTLEMENT");
    bytes32 public constant LEDGER_RESERVE = keccak256("LEDGER_RESERVE");
    bytes32 public constant LEDGER_OPS = keccak256("LEDGER_OPS");

    IERC20 public immutable usdc;
    address public treasury;

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
    event LedgerTransfer(bytes32 indexed fromLedger, bytes32 indexed toLedger, uint256 amount, string reason);
    event EmergencyLedgerTransfer(
        bytes32 indexed fromLedger,
        bytes32 indexed toLedger,
        uint256 amount,
        string reason,
        uint256 coverageBpsAfter,
        uint8 statusAfter
    );
    event TransferBlocked(bytes32 indexed fromLedger, uint256 amount, uint256 coverageBps, string reason);
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
        emit CapitalSeeded(msg.sender, settlement, reserve, ops);
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
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

    function transferLedger(bytes32, bytes32, uint256, string calldata) external pure {
        revert NotImplemented();
    }

    function emergencyTransferLedger(bytes32, bytes32, uint256, string calldata) external pure {
        revert NotImplemented();
    }

    function settleProfit(address, address, uint256, uint256, uint256) external pure {
        revert NotImplemented();
    }

    function retainSurplus(uint256, uint256) external pure {
        revert NotImplemented();
    }
}
