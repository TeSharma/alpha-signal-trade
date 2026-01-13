// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TUSDFaucet
 * @notice Testnet-only faucet for distributing test tUSD tokens
 * @dev This contract should be granted MINTER_ROLE on the TokenizedCurrency (tUSD) contract
 *      MUST BE DISABLED/REMOVED FOR MAINNET - Mainnet minting via bridge/treasury only
 */
interface ITokenizedCurrency {
    function mint(address to, uint256 amount, string calldata reason) external;
}

contract TUSDFaucet is Ownable {
    ITokenizedCurrency public tUSD;
    
    // 1000 tUSD per claim (6 decimals)
    uint256 public claimAmount = 1000 * 10**6;
    
    // 24 hour cooldown between claims
    uint256 public claimCooldown = 24 hours;
    
    // Track last claim time per address
    mapping(address => uint256) public lastClaimTime;
    
    // Emergency pause
    bool public paused;
    
    event Claimed(address indexed user, uint256 amount);
    event ClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event CooldownUpdated(uint256 oldCooldown, uint256 newCooldown);
    event Paused(bool isPaused);
    
    error FaucetPaused();
    error CooldownNotElapsed(uint256 timeRemaining);
    error InvalidAmount();
    
    constructor(address _tUSD) Ownable(msg.sender) {
        tUSD = ITokenizedCurrency(_tUSD);
    }
    
    /**
     * @notice Claim test tUSD tokens
     * @dev Users can claim once every 24 hours
     */
    function claim() external {
        if (paused) revert FaucetPaused();
        
        uint256 timeSinceLastClaim = block.timestamp - lastClaimTime[msg.sender];
        
        if (timeSinceLastClaim < claimCooldown) {
            revert CooldownNotElapsed(claimCooldown - timeSinceLastClaim);
        }
        
        lastClaimTime[msg.sender] = block.timestamp;
        tUSD.mint(msg.sender, claimAmount, "Faucet claim");
        
        emit Claimed(msg.sender, claimAmount);
    }
    
    /**
     * @notice Check if an address can claim
     * @param user Address to check
     * @return bool True if user can claim
     */
    function canClaim(address user) external view returns (bool) {
        if (paused) return false;
        return block.timestamp >= lastClaimTime[user] + claimCooldown;
    }
    
    /**
     * @notice Get time remaining until next claim
     * @param user Address to check
     * @return uint256 Seconds until next claim (0 if can claim now)
     */
    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 nextClaimTime = lastClaimTime[user] + claimCooldown;
        if (block.timestamp >= nextClaimTime) {
            return 0;
        }
        return nextClaimTime - block.timestamp;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Update the amount of tUSD distributed per claim
     * @param _amount New claim amount (with 6 decimals)
     */
    function setClaimAmount(uint256 _amount) external onlyOwner {
        if (_amount == 0) revert InvalidAmount();
        emit ClaimAmountUpdated(claimAmount, _amount);
        claimAmount = _amount;
    }
    
    /**
     * @notice Update the cooldown period between claims
     * @param _cooldown New cooldown in seconds
     */
    function setCooldown(uint256 _cooldown) external onlyOwner {
        emit CooldownUpdated(claimCooldown, _cooldown);
        claimCooldown = _cooldown;
    }
    
    /**
     * @notice Pause or unpause the faucet
     * @param _paused True to pause, false to unpause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
    
    /**
     * @notice Update the tUSD contract address
     * @param _tUSD New tUSD contract address
     */
    function setTUSDContract(address _tUSD) external onlyOwner {
        tUSD = ITokenizedCurrency(_tUSD);
    }
}
