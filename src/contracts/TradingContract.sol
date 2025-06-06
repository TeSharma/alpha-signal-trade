// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TradingContract {
    // Mapping to store user positions
    mapping(address => mapping(string => Position)) public userPositions;

    // Structure to represent a trading position
    struct Position {
        string pair;
        uint256 amount;
        uint256 entryPrice;
        uint256 stopLoss;
        uint256 takeProfit;
        bool isOpen;
    }

    // Event emitted when a new position is opened
    event PositionOpened(address indexed user, string pair, uint256 amount, uint256 entryPrice);

    // Event emitted when a position is closed
    event PositionClosed(address indexed user, string pair, uint256 amount, uint256 exitPrice);

    // Function to open a new trading position
    function openPosition(string memory _pair, uint256 _amount, uint256 _entryPrice, uint256 _stopLoss, uint256 _takeProfit) public {
        require(_amount > 0, "Amount must be greater than 0");
        require(!userPositions[msg.sender][_pair].isOpen, "Position already exists");

        userPositions[msg.sender][_pair] = Position(_pair, _amount, _entryPrice, _stopLoss, _takeProfit, true);
        emit PositionOpened(msg.sender, _pair, _amount, _entryPrice);
    }

    // Function to close an existing trading position
    function closePosition(string memory _pair) public {
        require(userPositions[msg.sender][_pair].isOpen, "Position does not exist or is already closed");

        userPositions[msg.sender][_pair].isOpen = false;
        emit PositionClosed(msg.sender, _pair, userPositions[msg.sender][_pair].amount, 0); // Assuming 0 as exit price for simplicity
    }
}
