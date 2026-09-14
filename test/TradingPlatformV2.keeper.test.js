const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TradingPlatformV2 — keeper SL/TP execution", function () {
  let owner, trader, keeper, stranger;
  let collateralToken, priceOracle, tradingPlatform;

  const TOKEN_DECIMALS = 6;
  const PAIR_ID = ethers.keccak256(ethers.toUtf8Bytes("EUR/USD"));
  const ENTRY = ethers.parseUnits("1.08", 8);
  const MARGIN = ethers.parseUnits("100", TOKEN_DECIMALS);
  const LEVERAGE = 10n;

  beforeEach(async function () {
    [owner, trader, keeper, stranger] = await ethers.getSigners();

    const TokenizedCurrency = await ethers.getContractFactory(
      "src/contracts/TokenizedCurrency.sol:TokenizedCurrency"
    );
    collateralToken = await TokenizedCurrency.deploy("Test USD", "tUSD", TOKEN_DECIMALS);
    await collateralToken.waitForDeployment();

    const MockPriceOracle = await ethers.getContractFactory(
      "src/contracts/MockPriceOracleV2.sol:MockPriceOracleV2"
    );
    priceOracle = await MockPriceOracle.deploy();
    await priceOracle.waitForDeployment();
    await priceOracle.setPrice(PAIR_ID, ENTRY);

    const TradingPlatformV2 = await ethers.getContractFactory(
      "src/contracts/TradingPlatformV2.sol:TradingPlatformV2"
    );
    tradingPlatform = await TradingPlatformV2.deploy(
      await priceOracle.getAddress(),
      await collateralToken.getAddress()
    );
    await tradingPlatform.waitForDeployment();

    await collateralToken.mint(trader.address, ethers.parseUnits("10000", TOKEN_DECIMALS), "test");
    await collateralToken.mint(
      await tradingPlatform.getAddress(),
      ethers.parseUnits("1000000", TOKEN_DECIMALS),
      "liquidity"
    );
    await collateralToken
      .connect(trader)
      .approve(await tradingPlatform.getAddress(), ethers.MaxUint256);

    await tradingPlatform.setKeeper(keeper.address, true);
  });

  async function openLong(stopLoss, takeProfit) {
    const tx = await tradingPlatform
      .connect(trader)
      .openPosition(PAIR_ID, true, MARGIN, LEVERAGE, stopLoss, takeProfit);
    await tx.wait();
    return 1n;
  }

  async function openShort(stopLoss, takeProfit) {
    const tx = await tradingPlatform
      .connect(trader)
      .openPosition(PAIR_ID, false, MARGIN, LEVERAGE, stopLoss, takeProfit);
    await tx.wait();
    return 1n;
  }

  it("only an authorised keeper may call closeWithTrigger", async function () {
    const sl = ethers.parseUnits("1.07", 8);
    const id = await openLong(sl, 0);
    await priceOracle.setPrice(PAIR_ID, ethers.parseUnits("1.065", 8));

    await expect(
      tradingPlatform.connect(stranger).closeWithTrigger(id)
    ).to.be.revertedWith("Not keeper");

    await expect(tradingPlatform.connect(keeper).closeWithTrigger(id)).to.not.be.reverted;
  });

  it("reverts when the trigger has not been reached", async function () {
    const id = await openLong(ethers.parseUnits("1.05", 8), ethers.parseUnits("1.12", 8));
    await priceOracle.setPrice(PAIR_ID, ethers.parseUnits("1.09", 8));

    await expect(
      tradingPlatform.connect(keeper).closeWithTrigger(id)
    ).to.be.revertedWith("Trigger not reached");
  });

  it("reverts when the position has no SL and no TP", async function () {
    const id = await openLong(0, 0);
    await priceOracle.setPrice(PAIR_ID, ethers.parseUnits("0.9", 8));

    await expect(
      tradingPlatform.connect(keeper).closeWithTrigger(id)
    ).to.be.revertedWith("No trigger set");
  });

  it("closes a long at its stop loss and settles to the trader", async function () {
    const sl = ethers.parseUnits("1.07", 8);
    const id = await openLong(sl, 0);
    await priceOracle.setPrice(PAIR_ID, ethers.parseUnits("1.068", 8));

    const before = await collateralToken.balanceOf(trader.address);
    await expect(tradingPlatform.connect(keeper).closeWithTrigger(id))
      .to.emit(tradingPlatform, "PositionTriggerClosed");
    const after = await collateralToken.balanceOf(trader.address);

    const p = await tradingPlatform.getPosition(id);
    expect(p.isOpen).to.equal(false);
    // A loss position still returns the remaining margin to the trader
    expect(after).to.be.gt(before);
  });

  it("closes a long at its take profit", async function () {
    const tp = ethers.parseUnits("1.10", 8);
    const id = await openLong(0, tp);
    await priceOracle.setPrice(PAIR_ID, ethers.parseUnits("1.105", 8));

    await expect(tradingPlatform.connect(keeper).closeWithTrigger(id)).to.not.be.reverted;
    expect((await tradingPlatform.getPosition(id)).isOpen).to.equal(false);
  });

  it("closes a short at its take profit", async function () {
    const tp = ethers.parseUnits("1.06", 8);
    const id = await openShort(0, tp);
    await priceOracle.setPrice(PAIR_ID, ethers.parseUnits("1.055", 8));

    await expect(tradingPlatform.connect(keeper).closeWithTrigger(id)).to.not.be.reverted;
    expect((await tradingPlatform.getPosition(id)).isOpen).to.equal(false);
  });

  it("cannot close the same position twice", async function () {
    const sl = ethers.parseUnits("1.07", 8);
    const id = await openLong(sl, 0);
    await priceOracle.setPrice(PAIR_ID, ethers.parseUnits("1.06", 8));

    await tradingPlatform.connect(keeper).closeWithTrigger(id);
    await expect(
      tradingPlatform.connect(keeper).closeWithTrigger(id)
    ).to.be.revertedWith("Position closed");
  });

  it("a revoked keeper can no longer close", async function () {
    const sl = ethers.parseUnits("1.07", 8);
    const id = await openLong(sl, 0);
    await priceOracle.setPrice(PAIR_ID, ethers.parseUnits("1.06", 8));

    await tradingPlatform.setKeeper(keeper.address, false);
    await expect(
      tradingPlatform.connect(keeper).closeWithTrigger(id)
    ).to.be.revertedWith("Not keeper");
  });
});
