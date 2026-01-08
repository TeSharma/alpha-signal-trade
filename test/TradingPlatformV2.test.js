const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TradingPlatformV2", function () {
  let owner, trader1, trader2, liquidator;
  let collateralToken, priceOracle, tradingPlatform;
  
  const TOKEN_DECIMALS = 6;
  const PAIR_ID = ethers.keccak256(ethers.toUtf8Bytes("EUR/USD"));
  const INITIAL_PRICE = ethers.parseUnits("1.08", 8); // EUR/USD = 1.08
  const MARGIN = ethers.parseUnits("100", TOKEN_DECIMALS); // 100 tUSD
  const LEVERAGE = 10n;

  // Mock price oracle for testing
  let MockPriceOracle;

  before(async function () {
    [owner, trader1, trader2, liquidator] = await ethers.getSigners();
  });

  beforeEach(async function () {
    // Deploy mock collateral token (tUSD) - use fully qualified name with 3 args
    const TokenizedCurrency = await ethers.getContractFactory("src/contracts/TokenizedCurrency.sol:TokenizedCurrency");
    collateralToken = await TokenizedCurrency.deploy("Test USD", "tUSD", TOKEN_DECIMALS);
    await collateralToken.waitForDeployment();

    // Deploy mock price oracle - use fully qualified name
    MockPriceOracle = await ethers.getContractFactory("src/contracts/MockPriceOracleV2.sol:MockPriceOracleV2");
    priceOracle = await MockPriceOracle.deploy();
    await priceOracle.waitForDeployment();

    // Set initial price
    await priceOracle.setPrice(PAIR_ID, INITIAL_PRICE);

    // Deploy TradingPlatformV2 - use fully qualified name
    const TradingPlatformV2 = await ethers.getContractFactory("src/contracts/TradingPlatformV2.sol:TradingPlatformV2");
    tradingPlatform = await TradingPlatformV2.deploy(
      await priceOracle.getAddress(),
      await collateralToken.getAddress()
    );
    await tradingPlatform.waitForDeployment();

    // Mint tokens to traders (with reason parameter)
    await collateralToken.mint(trader1.address, ethers.parseUnits("10000", TOKEN_DECIMALS), "test mint");
    await collateralToken.mint(trader2.address, ethers.parseUnits("10000", TOKEN_DECIMALS), "test mint");

    // Mint liquidity to trading platform for profit payouts
    await collateralToken.mint(
      await tradingPlatform.getAddress(),
      ethers.parseUnits("1000000", TOKEN_DECIMALS),
      "platform liquidity"
    );

    // Approve trading platform
    await collateralToken.connect(trader1).approve(
      await tradingPlatform.getAddress(),
      ethers.MaxUint256
    );
    await collateralToken.connect(trader2).approve(
      await tradingPlatform.getAddress(),
      ethers.MaxUint256
    );
  });

  describe("Deployment", function () {
    it("Should set the correct oracle", async function () {
      expect(await tradingPlatform.oracle()).to.equal(await priceOracle.getAddress());
    });

    it("Should set the correct collateral token", async function () {
      expect(await tradingPlatform.collateralToken()).to.equal(await collateralToken.getAddress());
    });

    it("Should set default risk parameters", async function () {
      expect(await tradingPlatform.maxLeverage()).to.equal(50);
      expect(await tradingPlatform.maintenanceMarginBps()).to.equal(1000);
      expect(await tradingPlatform.maxProfitBps()).to.equal(30000);
    });
  });

  describe("Open Position", function () {
    it("Should open a long position successfully", async function () {
      const tx = await tradingPlatform.connect(trader1).openPosition(
        PAIR_ID,
        true, // isLong
        MARGIN,
        LEVERAGE,
        0, // stopLoss
        0  // takeProfit
      );

      const receipt = await tx.wait();
      
      // Check position was created
      const position = await tradingPlatform.getPosition(1);
      expect(position.trader).to.equal(trader1.address);
      expect(position.pairId).to.equal(PAIR_ID);
      expect(position.isLong).to.be.true;
      expect(position.margin).to.equal(MARGIN);
      expect(position.leverage).to.equal(LEVERAGE);
      expect(position.isOpen).to.be.true;
    });

    it("Should open a short position successfully", async function () {
      await tradingPlatform.connect(trader1).openPosition(
        PAIR_ID,
        false, // isLong
        MARGIN,
        LEVERAGE,
        0,
        0
      );

      const position = await tradingPlatform.getPosition(1);
      expect(position.isLong).to.be.false;
    });

    it("Should revert with zero margin", async function () {
      await expect(
        tradingPlatform.connect(trader1).openPosition(PAIR_ID, true, 0, LEVERAGE, 0, 0)
      ).to.be.revertedWith("Margin too low");
    });

    it("Should revert with excessive leverage", async function () {
      await expect(
        tradingPlatform.connect(trader1).openPosition(PAIR_ID, true, MARGIN, 51, 0, 0)
      ).to.be.revertedWith("Invalid leverage");
    });

    it("Should transfer collateral from trader", async function () {
      const balanceBefore = await collateralToken.balanceOf(trader1.address);
      
      await tradingPlatform.connect(trader1).openPosition(
        PAIR_ID, true, MARGIN, LEVERAGE, 0, 0
      );

      const balanceAfter = await collateralToken.balanceOf(trader1.address);
      expect(balanceBefore - balanceAfter).to.equal(MARGIN);
    });

    it("Should emit PositionOpened event", async function () {
      await expect(
        tradingPlatform.connect(trader1).openPosition(PAIR_ID, true, MARGIN, LEVERAGE, 0, 0)
      )
        .to.emit(tradingPlatform, "PositionOpened")
        .withArgs(1, trader1.address, PAIR_ID, true, MARGIN, LEVERAGE, INITIAL_PRICE);
    });
  });

  describe("Close Position", function () {
    beforeEach(async function () {
      // Open a long position
      await tradingPlatform.connect(trader1).openPosition(
        PAIR_ID, true, MARGIN, LEVERAGE, 0, 0
      );
    });

    it("Should close position with profit", async function () {
      // Price goes up 5%
      const newPrice = INITIAL_PRICE * 105n / 100n;
      await priceOracle.setPrice(PAIR_ID, newPrice);

      const balanceBefore = await collateralToken.balanceOf(trader1.address);
      
      await tradingPlatform.connect(trader1).closePosition(1);

      const balanceAfter = await collateralToken.balanceOf(trader1.address);
      
      // With 10x leverage and 5% price increase, profit should be ~50% of margin
      expect(balanceAfter).to.be.gt(balanceBefore);
      
      const position = await tradingPlatform.getPosition(1);
      expect(position.isOpen).to.be.false;
    });

    it("Should close position with loss", async function () {
      // Price goes down 3%
      const newPrice = INITIAL_PRICE * 97n / 100n;
      await priceOracle.setPrice(PAIR_ID, newPrice);

      const balanceBefore = await collateralToken.balanceOf(trader1.address);
      
      await tradingPlatform.connect(trader1).closePosition(1);

      const balanceAfter = await collateralToken.balanceOf(trader1.address);
      
      // Trader should receive less than margin
      expect(balanceAfter - balanceBefore).to.be.lt(MARGIN);
    });

    it("Should revert if not position owner", async function () {
      await expect(
        tradingPlatform.connect(trader2).closePosition(1)
      ).to.be.revertedWith("Not owner");
    });

    it("Should revert if position already closed", async function () {
      await tradingPlatform.connect(trader1).closePosition(1);
      
      await expect(
        tradingPlatform.connect(trader1).closePosition(1)
      ).to.be.revertedWith("Position closed");
    });

    it("Should cap profit at maxProfitBps", async function () {
      // Price goes up 50% (would be 500% profit with 10x, but capped at 300%)
      const newPrice = INITIAL_PRICE * 150n / 100n;
      await priceOracle.setPrice(PAIR_ID, newPrice);

      const balanceBefore = await collateralToken.balanceOf(trader1.address);
      
      await tradingPlatform.connect(trader1).closePosition(1);

      const balanceAfter = await collateralToken.balanceOf(trader1.address);
      const payout = balanceAfter - balanceBefore;
      
      // Max profit is 300% of margin = 300 tUSD, plus margin = 400 tUSD total
      const maxPayout = MARGIN * 4n; // margin + 300% profit
      expect(payout).to.be.lte(maxPayout);
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      // Open a long position with 10x leverage
      await tradingPlatform.connect(trader1).openPosition(
        PAIR_ID, true, MARGIN, LEVERAGE, 0, 0
      );
    });

    it("Should liquidate position at liquidation price", async function () {
      const position = await tradingPlatform.getPosition(1);
      
      // Set price below liquidation price
      const liquidationPrice = position.liquidationPrice;
      await priceOracle.setPrice(PAIR_ID, liquidationPrice - 1n);

      await expect(
        tradingPlatform.connect(liquidator).liquidate(1)
      )
        .to.emit(tradingPlatform, "PositionLiquidated")
        .withArgs(1, trader1.address, liquidationPrice - 1n);

      const updatedPosition = await tradingPlatform.getPosition(1);
      expect(updatedPosition.isOpen).to.be.false;
    });

    it("Should revert liquidation if position is healthy", async function () {
      await expect(
        tradingPlatform.connect(liquidator).liquidate(1)
      ).to.be.revertedWith("Not liquidatable");
    });

    it("Should allow anyone to liquidate", async function () {
      const position = await tradingPlatform.getPosition(1);
      await priceOracle.setPrice(PAIR_ID, position.liquidationPrice - 1n);

      // Liquidator is not the position owner
      await expect(
        tradingPlatform.connect(liquidator).liquidate(1)
      ).to.not.be.reverted;
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await tradingPlatform.connect(trader1).openPosition(PAIR_ID, true, MARGIN, LEVERAGE, 0, 0);
      await tradingPlatform.connect(trader1).openPosition(PAIR_ID, false, MARGIN, 5n, 0, 0);
    });

    it("Should return user positions", async function () {
      const positions = await tradingPlatform.getUserPositions(trader1.address);
      expect(positions.length).to.equal(2);
      expect(positions[0]).to.equal(1n);
      expect(positions[1]).to.equal(2n);
    });

    it("Should return open positions only", async function () {
      // Close first position
      await tradingPlatform.connect(trader1).closePosition(1);

      const openPositions = await tradingPlatform.getUserOpenPositions(trader1.address);
      expect(openPositions.length).to.equal(1);
      expect(openPositions[0].isLong).to.be.false; // Second position was short
    });

    it("Should calculate current PnL", async function () {
      // Price goes up 2%
      const newPrice = INITIAL_PRICE * 102n / 100n;
      await priceOracle.setPrice(PAIR_ID, newPrice);

      const pnl = await tradingPlatform.getCurrentPnL(1);
      expect(pnl).to.be.gt(0); // Long position profits from price increase
    });
  });

  describe("Admin Functions", function () {
    it("Should update risk parameters", async function () {
      await tradingPlatform.setRiskParams(100, 500, 50000);
      
      expect(await tradingPlatform.maxLeverage()).to.equal(100);
      expect(await tradingPlatform.maintenanceMarginBps()).to.equal(500);
      expect(await tradingPlatform.maxProfitBps()).to.equal(50000);
    });

    it("Should update oracle", async function () {
      const newOracle = await MockPriceOracle.deploy();
      await newOracle.waitForDeployment();
      
      await tradingPlatform.setOracle(await newOracle.getAddress());
      expect(await tradingPlatform.oracle()).to.equal(await newOracle.getAddress());
    });

    it("Should revert admin functions from non-owner", async function () {
      await expect(
        tradingPlatform.connect(trader1).setRiskParams(100, 500, 50000)
      ).to.be.revertedWithCustomError(tradingPlatform, "OwnableUnauthorizedAccount");
    });
  });
});
