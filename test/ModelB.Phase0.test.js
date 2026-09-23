const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Model-B Phase 0 scaffold", function () {
  const TOKEN_DECIMALS = 6;
  const SETTLEMENT = ethers.parseUnits("70000", TOKEN_DECIMALS);
  const RESERVE = ethers.parseUnits("25000", TOKEN_DECIMALS);
  const OPS = ethers.parseUnits("5000", TOKEN_DECIMALS);

  let admin, stranger, treasury;
  let usdc, vault, riskManager, platform;

  beforeEach(async function () {
    [admin, stranger, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory(
      "src/contracts/TokenizedCurrency.sol:TokenizedCurrency"
    );
    usdc = await Token.deploy("Test USD", "tUSD", TOKEN_DECIMALS);
    await usdc.waitForDeployment();
    const Vault = await ethers.getContractFactory(
      "src/contracts/SettlementVault.sol:SettlementVault"
    );
    vault = await Vault.deploy(
      await usdc.getAddress(),
      treasury.address,
      admin.address
    );
    await vault.waitForDeployment();
    const Manager = await ethers.getContractFactory(
      "src/contracts/ProtocolRiskManager.sol:ProtocolRiskManager"
    );
    riskManager = await Manager.deploy(
      await vault.getAddress(),
      ethers.ZeroAddress,
      admin.address,
      15000
    );
    await riskManager.waitForDeployment();
    const Platform = await ethers.getContractFactory(
      "src/contracts/TradingPlatformV3.sol:TradingPlatformV3"
    );
    platform = await Platform.deploy(
      stranger.address,
      await usdc.getAddress(),
      await vault.getAddress(),
      await riskManager.getAddress(),
      admin.address
    );
    await platform.waitForDeployment();
    await usdc.mint(admin.address, SETTLEMENT + RESERVE + OPS, "phase0 seed");
    await usdc.connect(admin).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  it("wires roles, treasury and zero external coverage", async function () {
    const ADMIN_ROLE = await vault.DEFAULT_ADMIN_ROLE();
    const EMERGENCY_ROLE = await vault.EMERGENCY_ROLE();
    expect(await vault.hasRole(ADMIN_ROLE, admin.address)).to.equal(true);
    expect(await vault.hasRole(EMERGENCY_ROLE, admin.address)).to.equal(true);
    expect(await vault.treasury()).to.equal(treasury.address);
    expect(await vault.hedgeCommitted()).to.equal(0n);
    expect(await platform.owner()).to.equal(admin.address);
    expect(await riskManager.minimumCoverageBps()).to.equal(15000n);
  });

  it("seeds capital and preserves invariant", async function () {
    const seedTx = await vault.connect(admin).seedCapital(SETTLEMENT, RESERVE, OPS);
    await expect(seedTx)
      .to.emit(vault, "CapitalSeeded")
      .withArgs(admin.address, SETTLEMENT, RESERVE, OPS);
    expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
    expect(await vault.reserveLedger()).to.equal(RESERVE);
    expect(await vault.opsLedger()).to.equal(OPS);
    const seeded = SETTLEMENT + RESERVE + OPS;
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(seeded);
    expect(await vault.accountedTotal()).to.equal(seeded);
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
  });


  it("rejects seeding from non-governance and empty seeding", async function () {
    await expect(
      vault.connect(stranger).seedCapital(SETTLEMENT, RESERVE, OPS)
    ).to.be.reverted;
    await expect(vault.connect(admin).seedCapital(0, 0, 0)).to.be.revertedWith(
      "Nothing to seed"
    );
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
  });

  it("phase1 settlement stubs revert", async function () {
    await vault.connect(admin).seedCapital(SETTLEMENT, RESERVE, OPS);
    const SET = await vault.LEDGER_SETTLEMENT();
    const RSV = await vault.LEDGER_RESERVE();
    await expect(vault.transferLedger(SET, RSV, 1, "p0")).to.be.revertedWithCustomError(
      vault,
      "NotImplemented"
    );
    await expect(
      vault.emergencyTransferLedger(SET, RSV, 1, "p0")
    ).to.be.revertedWithCustomError(vault, "NotImplemented");
    await expect(
      vault.settleProfit(treasury.address, treasury.address, 1, 0, 1)
    ).to.be.revertedWithCustomError(vault, "NotImplemented");
    await expect(vault.retainSurplus(1, 1)).to.be.revertedWithCustomError(
      vault,
      "NotImplemented"
    );
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
  });

  it("phase2 risk stubs revert", async function () {
    await expect(
      riskManager.authorizeOpen(ethers.ZeroHash, 0, 0)
    ).to.be.revertedWithCustomError(riskManager, "NotImplemented");
    await expect(
      riskManager.authorizeSettle.staticCall(0, 0)
    ).to.be.revertedWithCustomError(riskManager, "NotImplemented");
    await expect(riskManager.maxPermittedLiability()).to.be.revertedWithCustomError(
      riskManager,
      "NotImplemented"
    );
    await expect(riskManager.coverageMaxBps()).to.be.revertedWithCustomError(
      riskManager,
      "NotImplemented"
    );
    await expect(riskManager.status()).to.be.revertedWithCustomError(
      riskManager,
      "NotImplemented"
    );
  });

  it("phase3 trading stubs revert and flags toggle", async function () {
    await expect(
      platform.openPosition(ethers.ZeroHash, true, 1, 1, 0, 0)
    ).to.be.revertedWithCustomError(platform, "NotImplemented");
    await expect(platform.closePosition(1)).to.be.revertedWithCustomError(
      platform,
      "NotImplemented"
    );
    await expect(platform.liquidate(1)).to.be.revertedWithCustomError(
      platform,
      "NotImplemented"
    );
    await expect(platform.closeWithTrigger(1)).to.be.revertedWithCustomError(
      platform,
      "NotImplemented"
    );
    await platform.connect(admin).setPaused(true);
    expect(await platform.paused()).to.equal(true);
    await platform.connect(admin).setAdmissionHalted(true);
    expect(await platform.admissionHalted()).to.equal(true);
  });
});