const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Model-B Phase 1 — SettlementVault accounting", function () {
  const D = 6;
  const SETTLEMENT = ethers.parseUnits("70000", D);
  const RESERVE = ethers.parseUnits("25000", D);
  const OPS = ethers.parseUnits("5000", D);
  const TOTAL = SETTLEMENT + RESERVE + OPS;
  const CMIN = 15000n;
  // Liability 40000 => required post-transfer settlement = 40000 * 15000 / 10000 = 60000.
  const L0 = ethers.parseUnits("40000", D);
  // Max governance withdrawal keeping equality: 70000 - 60000 = 10000.
  const MAX_OK_WITHDRAW = ethers.parseUnits("10000", D);

  let admin, stranger, treasury, trader;
  let usdc, vault, mock;

  beforeEach(async function () {
    [admin, stranger, treasury, trader] = await ethers.getSigners();
    const Token = await ethers.getContractFactory(
      "src/contracts/TokenizedCurrency.sol:TokenizedCurrency"
    );
    usdc = await Token.deploy("Test USD", "tUSD", D);
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
    const Mock = await ethers.getContractFactory(
      "src/contracts/MockProtocolRiskManager.sol:MockProtocolRiskManager"
    );
    mock = await Mock.deploy();
    await mock.waitForDeployment();
    await mock.setMinimumCoverageBps(CMIN);
    await mock.setCurrentMaxProtoLiab(0);
    await vault.setRiskManager(await mock.getAddress());
    await vault.grantRole(await vault.SETTLER_ROLE(), admin.address);
    await usdc.mint(admin.address, TOTAL, "phase1 seed");
    await usdc.connect(admin).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.seedCapital(SETTLEMENT, RESERVE, OPS);
  });

  async function expectPhysical() {
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
  }

  it("physical-balance invariant holds after seeding", async function () {
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(TOTAL);
    expect(await vault.accountedTotal()).to.equal(TOTAL);
    await expectPhysical();
  });

  describe("governance settlement-withdrawal coverage guard", function () {
    it("allows withdrawal exactly at coverage boundary (equality)", async function () {
      await mock.setCurrentMaxProtoLiab(L0);
      const s = await vault.LEDGER_SETTLEMENT();
      const t = await vault.LEDGER_TREASURY();
      await expect(
        vault.transferLedger(s, t, MAX_OK_WITHDRAW, "policy equality")
      )
        .to.emit(vault, "LedgerTransfer")
        .withArgs(s, t, MAX_OK_WITHDRAW, "policy equality");
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT - MAX_OK_WITHDRAW);
      await expectPhysical();
    });

    it("reverts 1 wei past the boundary with CoverageBreach", async function () {
      await mock.setCurrentMaxProtoLiab(L0);
      const s = await vault.LEDGER_SETTLEMENT();
      const t = await vault.LEDGER_TREASURY();
      await expect(
        vault.transferLedger(s, t, MAX_OK_WITHDRAW + 1n, "policy breach")
      ).to.be.revertedWithCustomError(vault, "CoverageBreach");
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
      await expectPhysical();
    });

    it("allows full withdrawal when open liability is zero", async function () {
      const s = await vault.LEDGER_SETTLEMENT();
      const t = await vault.LEDGER_TREASURY();
      await vault.transferLedger(s, t, SETTLEMENT, "no liability");
      expect(await vault.settlementLedger()).to.equal(0n);
      await expectPhysical();
    });

    it("blocks a treasury drain that would strand open liability", async function () {
      await mock.setCurrentMaxProtoLiab(L0);
      const s = await vault.LEDGER_SETTLEMENT();
      const t = await vault.LEDGER_TREASURY();
      await expect(
        vault.transferLedger(s, t, SETTLEMENT, "drain")
      ).to.be.revertedWithCustomError(vault, "CoverageBreach");
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
      expect(await vault.accountedTotal()).to.equal(TOTAL);
      await expectPhysical();
    });

    it("reverts settlement outflow when no risk manager is wired", async function () {
      const Vault = await ethers.getContractFactory(
        "src/contracts/SettlementVault.sol:SettlementVault"
      );
      const bare = await Vault.deploy(
        await usdc.getAddress(),
        treasury.address,
        admin.address
      );
      await bare.waitForDeployment();
      await usdc.mint(admin.address, SETTLEMENT, "bare seed");
      await usdc.connect(admin).approve(await bare.getAddress(), SETTLEMENT);
      await bare.seedCapital(SETTLEMENT, 0, 0);
      await expect(
        bare.transferLedger(
          await bare.LEDGER_SETTLEMENT(),
          await bare.LEDGER_TREASURY(),
          1n,
          "no rm"
        )
      ).to.be.revertedWithCustomError(bare, "RiskManagerNotSet");
    });
  });

  describe("reserve and ops movements are governed separately", function () {
    it("allows reserve exit even when settlement coverage would fail", async function () {
      await mock.setCurrentMaxProtoLiab(L0); // coverage only guards settlement outflows
      const rsv = await vault.LEDGER_RESERVE();
      const t = await vault.LEDGER_TREASURY();
      await expect(vault.transferLedger(rsv, t, RESERVE, "reserve ops spend"))
        .to.emit(vault, "LedgerTransfer")
        .withArgs(rsv, t, RESERVE, "reserve ops spend");
      expect(await vault.reserveLedger()).to.equal(0n);
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT); // numerator untouched
      expect(await usdc.balanceOf(treasury.address)).to.equal(RESERVE);
      await expectPhysical();
    });

    it("allows ops exit and ops never counts as settlement capacity", async function () {
      await mock.setCurrentMaxProtoLiab(L0);
      const ops = await vault.LEDGER_OPS();
      const t = await vault.LEDGER_TREASURY();
      await vault.transferLedger(ops, t, OPS, "ops spend");
      expect(await vault.opsLedger()).to.equal(0n);
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
      expect(await vault.accountedTotal()).to.equal(SETTLEMENT + RESERVE);
      await expectPhysical();
    });

    it("rebalances reserve into settlement without the settlement guard", async function () {
      await mock.setCurrentMaxProtoLiab(L0);
      const rsv = await vault.LEDGER_RESERVE();
      const set = await vault.LEDGER_SETTLEMENT();
      await vault.transferLedger(rsv, set, RESERVE, "rebalance to settlement");
      expect(await vault.reserveLedger()).to.equal(0n);
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT + RESERVE);
      await expectPhysical();
    });
  });

  describe("emergency multisig path", function () {
    it("bypasses the coverage guard and reports post-action risk", async function () {
      await mock.setCurrentMaxProtoLiab(L0);
      await mock.setStatus(3); // CRITICAL after breach
      const s = await vault.LEDGER_SETTLEMENT();
      const t = await vault.LEDGER_TREASURY();
      const breach = MAX_OK_WITHDRAW + 1n; // would revert under governance path
      await expect(vault.emergencyTransferLedger(s, t, breach, "incident-42"))
        .to.emit(vault, "EmergencyLedgerTransfer")
        .withArgs(s, t, breach, "incident-42", (SETTLEMENT - breach) * 10000n / L0, 3);
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT - breach);
      expect(await usdc.balanceOf(treasury.address)).to.equal(breach);
      await expectPhysical();
    });

    it("requires a non-empty reason", async function () {
      const s = await vault.LEDGER_SETTLEMENT();
      const t = await vault.LEDGER_TREASURY();
      await expect(
        vault.emergencyTransferLedger(s, t, 1n, "")
      ).to.be.revertedWithCustomError(vault, "ReasonRequired");
      await expectPhysical();
    });

    it("denies strangers on both governance and emergency paths", async function () {
      const s = await vault.LEDGER_SETTLEMENT();
      const t = await vault.LEDGER_TREASURY();
      await expect(
        vault.connect(stranger).transferLedger(s, t, 1n, "x")
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
      await expect(
        vault.connect(stranger).emergencyTransferLedger(s, t, 1n, "x")
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
      await expect(
        vault.connect(stranger).setTreasury(stranger.address)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
      await expect(
        vault.connect(stranger).setRiskManager(stranger.address)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
      await expectPhysical();
    });
  });

  describe("settleProfit — Option B atomic two-leg payout", function () {
    const TRADER_PROFIT = ethers.parseUnits("2997.60", D); // pnl 3000 - closeFee 2.40
    const TREASURY_FEE = ethers.parseUnits("2.40", D);
    const GROSS = ethers.parseUnits("3000", D); // == traderProfit + treasuryFee

    it("decreases settlementLedger by the FULL gross profit and pays both legs once", async function () {
      const s = await vault.settlementLedger();
      const traderBefore = await usdc.balanceOf(trader.address);
      const tBefore = await usdc.balanceOf(treasury.address);
      await expect(
        vault.settleProfit(trader.address, treasury.address, TRADER_PROFIT, TREASURY_FEE, 1)
      )
        .to.emit(vault, "ProfitSettled")
        .withArgs(1, trader.address, TRADER_PROFIT, TREASURY_FEE);
      // ledger decreased by gross, not net
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT - GROSS);
      expect(s).to.equal(SETTLEMENT);
      // trader got net profit; treasury got close fee exactly once
      expect((await usdc.balanceOf(trader.address)) - traderBefore).to.equal(TRADER_PROFIT);
      expect((await usdc.balanceOf(treasury.address)) - tBefore).to.equal(TREASURY_FEE);
      // fee never remains in settlementLedger and never accrues to opsLedger (Option B)
      expect(await vault.opsLedger()).to.equal(OPS);
      expect(await vault.reserveLedger()).to.equal(RESERVE);
      expect(await vault.accountedTotal()).to.equal(TOTAL - GROSS);
      await expectPhysical();
    });

    it("reverts InsufficientSettlement when gross exceeds settlement capacity", async function () {
      const tooBig = SETTLEMENT + 1n;
      await expect(
        vault.settleProfit(trader.address, treasury.address, tooBig, 0, 2)
      ).to.be.revertedWithCustomError(vault, "InsufficientSettlement");
      expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
      await expectPhysical();
    });

    it("rejects a fee destination that is not the governed treasury", async function () {
      await expect(
        vault.settleProfit(trader.address, stranger.address, TRADER_PROFIT, TREASURY_FEE, 3)
      ).to.be.revertedWithCustomError(vault, "TreasuryMismatch");
      await expectPhysical();
    });

    it("rejects zero addresses and zero gross", async function () {
      await expect(
        vault.settleProfit(ethers.ZeroAddress, treasury.address, TRADER_PROFIT, 0, 4)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
      await expect(
        vault.settleProfit(trader.address, ethers.ZeroAddress, 0, TREASURY_FEE, 5)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
      await expect(
        vault.settleProfit(trader.address, treasury.address, 0, 0, 6)
      ).to.be.revertedWithCustomError(vault, "ZeroAmount");
      await expectPhysical();
    });

    it("denies callers without SETTLER_ROLE", async function () {
      await expect(
        vault.connect(stranger).settleProfit(stranger.address, treasury.address, 1, 1, 7)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
      await expectPhysical();
    });
  });

  describe("retainSurplus — loss surplus into settlementLedger", function () {
    const SURPLUS = ethers.parseUnits("1234.56", D);

    it("pulls USDC once and credits settlement + surplus sub-ledgers", async function () {
      await usdc.mint(admin.address, SURPLUS, "loss surplus");
      const vAddr = await vault.getAddress();
      const sBefore = await vault.settlementLedger();
      const vBefore = await usdc.balanceOf(vAddr);
      await expect(vault.retainSurplus(SURPLUS, 42))
        .to.emit(vault, "SurplusRetained")
        .withArgs(42, SURPLUS);
      expect(await vault.settlementLedger()).to.equal(sBefore + SURPLUS);
      expect(await vault.settlementSurplusRetained()).to.equal(SURPLUS);
      expect((await usdc.balanceOf(vAddr)) - vBefore).to.equal(SURPLUS);
      expect(await vault.accountedTotal()).to.equal(TOTAL + SURPLUS);
      await expectPhysical();
    });

    it("rejects zero amount and non-settler callers", async function () {
      await expect(vault.retainSurplus(0, 43)).to.be.revertedWithCustomError(vault, "ZeroAmount");
      await expect(
        vault.connect(stranger).retainSurplus(1, 44)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
      await expectPhysical();
    });
  });

  describe("external liquidity accounting stays exactly zero", function () {
    it("reports hedgeCommitted and backstop receivable at zero with no setter", async function () {
      expect(await vault.hedgeCommitted()).to.equal(0n);
      expect(await vault.v2BackstopReceivable()).to.equal(0n);
      // no mutation path exists: settlement outflow leaves hedge counter untouched
      await mock.setCurrentMaxProtoLiab(0);
      await vault.transferLedger(
        await vault.LEDGER_SETTLEMENT(),
        await vault.LEDGER_TREASURY(),
        MAX_OK_WITHDRAW,
        "zero external check"
      );
      expect(await vault.hedgeCommitted()).to.equal(0n);
      await expectPhysical();
    });
  });
});
