const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Model-B Phase 3 — TradingPlatformV3 execution engine + liability invariants.
 *
 * BINDING INVARIANT under test (for every reachable state):
 *     Σ M_i  ==  ProtocolRiskManager.currentMaxProtoLiab()
 * where the sum runs over all OPEN positions held by V3 and
 *     M_i = (netMargin_i * maxProfitBps) / 10000        (netMargin_i = margin_i - openFee_i)
 * together with the per-pair and per-correlation-group decompositions of the
 * same sum (pairMaxProfitLiab / corrGroupLiab). Every open path must register
 * liability and every close path (direct / trigger / liquidation) must release
 * it in the same transaction — otherwise the invariant breaks.
 *
 * CUSTODY SEPARATION: user margin is held by V3 and NEVER enters SettlementVault.
 * Only realized profit + close fee (vault.settleProfit) or retained loss surplus
 * (vault.retainSurplus) ever reach the vault, which must keep its physical
 * invariant (ledgers are a partition of one USDC balance) at all times.
 */
describe("Model-B Phase 3 — TradingPlatformV3 execution engine", function () {
  const D = 6;
  const u = (n) => ethers.parseUnits(String(n), D);
  const px = (n) => ethers.parseUnits(String(n), 8);

  const SETTLEMENT = u(70000);
  const RESERVE = u(25000);
  const OPS = u(5000);
  const CAPITAL = SETTLEMENT + RESERVE + OPS;
  const HUGE_CAP = u(1000000000);
  const MIN_COVERAGE_BPS = 15000n;

  const PAIR_A = ethers.id("EUR/USD");
  const PAIR_B = ethers.id("GBP/USD");
  const PAIR_C = ethers.id("XAU/USD");
  const GRP_FX = "0x4658000000000000"; // bytes8("FX")
  const GRP_METAL = "0x4d54000000000000"; // bytes8("MT")
  const ZERO_GROUP = "0x0000000000000000";
  const USED_PAIRS = [PAIR_A, PAIR_B, PAIR_C];
  const USED_GROUPS = [GRP_FX, GRP_METAL];

  // Economic parity parameters — must match TradingPlatformV2 exactly.
  const MAX_LEVERAGE = 50n;
  const MAINTENANCE_BPS = 1000n;
  const MAX_PROFIT_BPS = 30000n;
  const OPEN_FEE_BPS = 8n;
  const CLOSE_FEE_BPS = 8n;
  const LIQUIDATOR_BPS = 3000n;

  const MARGIN = u(1000);
  const ENTRY = px(1000);
  const OPEN_FEE = (MARGIN * OPEN_FEE_BPS) / 10000n; // 800_000 (0.08%)
  const NET_MARGIN = MARGIN - OPEN_FEE; // 999_200_000

  let admin, trader, trader2, keeper, liquidator, treasury, stranger;
  let usdc, oracle, vault, manager, platform;

  beforeEach(async function () {
    [admin, trader, trader2, keeper, liquidator, treasury, stranger] =
      await ethers.getSigners();

    const Token = await ethers.getContractFactory(
      "src/contracts/TokenizedCurrency.sol:TokenizedCurrency"
    );
    usdc = await Token.deploy("Test USD", "tUSD", D);
    await usdc.waitForDeployment();

    const Oracle = await ethers.getContractFactory(
      "src/contracts/MockPriceOracleV2.sol:MockPriceOracleV2"
    );
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    const Vault = await ethers.getContractFactory(
      "src/contracts/SettlementVault.sol:SettlementVault"
    );
    vault = await Vault.deploy(await usdc.getAddress(), treasury.address, admin.address);
    await vault.waitForDeployment();

    const Manager = await ethers.getContractFactory(
      "src/contracts/ProtocolRiskManager.sol:ProtocolRiskManager"
    );
    // Manager deploys with platform unset: V3 does not exist yet.
    manager = await Manager.deploy(
      await vault.getAddress(),
      ethers.ZeroAddress,
      admin.address,
      MIN_COVERAGE_BPS
    );
    await manager.waitForDeployment();

    const Platform = await ethers.getContractFactory(
      "src/contracts/TradingPlatformV3.sol:TradingPlatformV3"
    );
    platform = await Platform.deploy(
      await oracle.getAddress(),
      await usdc.getAddress(),
      await vault.getAddress(),
      await manager.getAddress(),
      admin.address
    );
    await platform.waitForDeployment();

    // Wiring order (deployment runbook): vault -> manager -> platform.
    await vault.setRiskManager(await manager.getAddress());
    await vault.grantRole(await vault.SETTLER_ROLE(), await platform.getAddress());
    await manager.setPlatform(await platform.getAddress());
    await manager.setRiskParams(MIN_COVERAGE_BPS, HUGE_CAP, HUGE_CAP);

    // Correlation groups must be configured BEFORE liability exists for a pair.
    await manager.setPairCorrGroup(PAIR_A, GRP_FX);
    await manager.setPairCorrGroup(PAIR_B, GRP_FX);
    await manager.setPairCorrGroup(PAIR_C, GRP_METAL);

    await platform.setTreasury(treasury.address);
    await platform.setKeeper(keeper.address, true);

    await usdc.mint(admin.address, CAPITAL, "phase3 vault seed");
    await usdc.connect(admin).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.seedCapital(SETTLEMENT, RESERVE, OPS);

    for (const who of [trader, trader2, liquidator]) {
      await usdc.mint(who.address, u(50000), "phase3 trader seed");
      await usdc
        .connect(who)
        .approve(await platform.getAddress(), ethers.MaxUint256);
    }

    for (const pair of USED_PAIRS) {
      await oracle.setPrice(pair, ENTRY);
    }
  });

  // ———————————————————— fixtures & helpers ————————————————————

  const maxProfitLiabFor = (netMargin) => (netMargin * MAX_PROFIT_BPS) / 10000n;
  const netMarginFor = (margin) => margin - (margin * OPEN_FEE_BPS) / 10000n;

  /// Signed PnL of a position for a given exit price (same formula as V3).
  function pnlFor(notional, entryPrice, exitPrice, isLong) {
    const diff = isLong
      ? BigInt(exitPrice) - BigInt(entryPrice)
      : BigInt(entryPrice) - BigInt(exitPrice);
    return (diff * BigInt(notional)) / BigInt(entryPrice);
  }

  function openTx(signer, opts = {}) {
    const {
      pairId = PAIR_A,
      isLong = true,
      margin = MARGIN,
      leverage = 10n,
      sl = 0n,
      tp = 0n,
    } = opts;
    return platform
      .connect(signer)
      .openPosition(pairId, isLong, margin, leverage, sl, tp);
  }

  /// Opens a position and returns its id (parsed from the PositionOpened log).
  async function open(signer, opts = {}) {
    const receipt = await (await openTx(signer, opts)).wait();
    for (const log of receipt.logs) {
      try {
        const parsed = platform.interface.parseLog(log);
        if (parsed && parsed.name === "PositionOpened") return parsed.args.id;
      } catch (_) {
        /* not a V3 log */
      }
    }
    throw new Error("PositionOpened not emitted");
  }

  /**
   * Rebuilds Σ M_i (and its per-pair / per-group decompositions) by walking
   * every position V3 has ever created and keeping the OPEN ones only.
   */
  async function reconstructLiability() {
    const nextId = await platform.nextPositionId();
    const byPair = new Map();
    const byGroup = new Map();
    const ids = [];
    let total = 0n;
    for (let id = 1n; id < nextId; id++) {
      const p = await platform.getPosition(id);
      if (!p.isOpen) continue;
      ids.push(id);
      total += p.maxProfitLiab;
      byPair.set(p.pairId, (byPair.get(p.pairId) ?? 0n) + p.maxProfitLiab);
      const group = await manager.pairCorrGroup(p.pairId);
      if (group !== ZERO_GROUP) {
        byGroup.set(group, (byGroup.get(group) ?? 0n) + p.maxProfitLiab);
      }
    }
    return { ids, total, byPair, byGroup };
  }

  /// BINDING INVARIANT: Σ M_i over open positions == registry aggregates.
  async function expectLiabilityInvariant() {
    const { ids, total, byPair, byGroup } = await reconstructLiability();
    expect(await manager.currentMaxProtoLiab(), "Σ M_i must equal L0").to.equal(
      total
    );
    for (const pair of USED_PAIRS) {
      expect(
        await manager.pairMaxProfitLiab(pair),
        `pair ledger ${pair}`
      ).to.equal(byPair.get(pair) ?? 0n);
    }
    for (const group of USED_GROUPS) {
      expect(
        await manager.corrGroupLiab(group),
        `corr-group ledger ${group}`
      ).to.equal(byGroup.get(group) ?? 0n);
    }
    // Registered liability must always fit inside the admitted capacity.
    expect(total).to.be.lessThanOrEqual(await manager.maxPermittedLiability());
    return { ids, total };
  }

  async function expectVaultPhysical() {
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(
      await vault.accountedTotal()
    );
  }

  // ————————————————————————————— tests —————————————————————————————

  it("openPosition registers M_i atomically (global / per-pair / per-group) and keeps margin in V3 custody", async function () {
    const vaultBalBefore = await usdc.balanceOf(await vault.getAddress());
    const startId = await platform.nextPositionId();

    const expectedM = maxProfitLiabFor(NET_MARGIN);

    await expect(openTx(trader))
      .to.emit(platform, "PositionOpened")
      .withArgs(startId, trader.address, PAIR_A, true, NET_MARGIN, 10n, ENTRY, expectedM);
    await expect(openTx(trader)).to.not.be.reverted; // second position, same trader

    const p = await platform.getPosition(startId);
    expect(p.margin).to.equal(NET_MARGIN);
    expect(p.notional).to.equal(NET_MARGIN * 10n);
    expect(p.maxProfitLiab).to.equal(expectedM);
    // M_i == netMargin * maxProfitBps / 10000 (exact: 30000/10000 == 3)
    expect(p.maxProfitLiab).to.equal(NET_MARGIN * 3n);
    expect(p.liquidationPrice).to.equal(
      ENTRY - (ENTRY * MAINTENANCE_BPS) / 10000n / 10n
    );
    expect(p.isOpen).to.equal(true);

    // Registry mirrors exactly two identical positions.
    expect(await manager.currentMaxProtoLiab()).to.equal(2n * expectedM);
    expect(await manager.pairMaxProfitLiab(PAIR_A)).to.equal(2n * expectedM);
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(2n * expectedM);

    // Custody: margin stays inside V3; only the open fee reached treasury.
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(
      2n * NET_MARGIN
    );
    expect(await usdc.balanceOf(treasury.address)).to.equal(2n * OPEN_FEE);
    // ...and the vault was never touched by an open.
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(vaultBalBefore);

    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("openPosition reverts with AdmissionDenied and leaves zero footprint when the risk manager refuses", async function () {
    // netMargin * 300% exceeds maxPermittedLiability == S * 10000 / Cmin == $46,666.67
    const margin = u(20000);
    const netMargin = netMarginFor(margin);
    expect(maxProfitLiabFor(netMargin)).to.be.greaterThan(
      await manager.maxPermittedLiability()
    );

    const nextIdBefore = await platform.nextPositionId();
    const traderBefore = await usdc.balanceOf(trader.address);
    const platformBefore = await usdc.balanceOf(await platform.getAddress());
    const vaultBefore = await usdc.balanceOf(await vault.getAddress());

    await expect(openTx(trader, { margin })).to.be.revertedWithCustomError(
      platform,
      "AdmissionDenied"
    );

    // Fully reverted: no id consumed, no collateral moved, no liability registered.
    expect(await platform.nextPositionId()).to.equal(nextIdBefore);
    expect(await usdc.balanceOf(trader.address)).to.equal(traderBefore);
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(platformBefore);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(vaultBefore);
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    await expectLiabilityInvariant();
  });

  it("profit liability cap: paid profit can never exceed the reserved M_i", async function () {
    const id = await open(trader, { margin: MARGIN, leverage: 10n });
    const p = await platform.getPosition(id);

    // +35% => uncapped raw PnL would be 1.35 * notional > M_i. Gross 3*netMargin
    // is exactly M_i (maxProfitBps == 30000), so the cap and the reserve agree.
    const exit = px(1350);
    await oracle.setPrice(PAIR_A, exit);
    const raw = pnlFor(p.notional, p.entryPrice, exit, true);
    expect(raw).to.be.greaterThan(p.maxProfitLiab);
    expect(p.maxProfitLiab).to.equal(3n * p.margin);
    expect(await platform.getCurrentPnL(id)).to.equal(p.maxProfitLiab);

    const ledgerBefore = await vault.settlementLedger();
    const traderBefore = await usdc.balanceOf(trader.address);
    const gross = p.maxProfitLiab;
    const closeFee = (gross * CLOSE_FEE_BPS) / 10000n;
    const traderProfit = gross - closeFee;

    await expect(platform.connect(trader).closePosition(id))
      .to.emit(platform, "PositionClosed")
      .withArgs(id, trader.address, exit, gross);

    // Settlement capital paid out exactly M_i gross (trader profit + treasury fee).
    expect(await vault.settlementLedger()).to.equal(ledgerBefore - gross);
    expect(await usdc.balanceOf(trader.address)).to.equal(
      traderBefore + p.margin + traderProfit
    );
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("winning close settles profit + close fee through the vault and releases M_i in the same tx", async function () {
    const id = await open(trader);
    const p = await platform.getPosition(id);
    await expectLiabilityInvariant();

    const ledgerBefore = await vault.settlementLedger();
    const vaultBalBefore = await usdc.balanceOf(await vault.getAddress());
    const traderBefore = await usdc.balanceOf(trader.address);
    const treasuryBefore = await usdc.balanceOf(treasury.address);

    const exit = px(1010); // +1% on 10x => +10% of netMargin
    await oracle.setPrice(PAIR_A, exit);

    const gross = pnlFor(p.notional, p.entryPrice, exit, true);
    expect(gross).to.equal(99_920_000n); // 6-dec units
    expect(await platform.getCurrentPnL(id)).to.equal(gross);

    const closeFee = (gross * CLOSE_FEE_BPS) / 10000n;
    const traderProfit = gross - closeFee;

    await expect(platform.connect(trader).closePosition(id))
      .to.emit(platform, "PositionClosed")
      .withArgs(id, trader.address, exit, gross);
    await expect(platform.connect(trader).closePosition(id))
      .to.be.revertedWithCustomError(platform, "PositionClosedAlready");

    // Liability released atomically (globally, per pair and per group).
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    expect(await manager.pairMaxProfitLiab(PAIR_A)).to.equal(0n);
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(0n);

    // The vault paid the gross profit: trader leg + treasury fee leg.
    expect(await vault.settlementLedger()).to.equal(ledgerBefore - gross);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(
      vaultBalBefore - gross
    );

    // Trader got margin back from V3 custody + profit from the vault.
    expect(await usdc.balanceOf(trader.address)).to.equal(
      traderBefore + p.margin + traderProfit
    );
    expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + closeFee);

    // V3 custody is empty for this position; user margin never entered the vault.
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(0n);

    const closed = await platform.getPosition(id);
    expect(closed.isOpen).to.equal(false);
    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("losing close refunds the remainder from V3 and retains the loss surplus in the vault", async function () {
    const id = await open(trader);
    const p = await platform.getPosition(id);

    const ledgerBefore = await vault.settlementLedger();
    const surplusBefore = await vault.settlementSurplusRetained();
    const vaultBalBefore = await usdc.balanceOf(await vault.getAddress());
    const traderBefore = await usdc.balanceOf(trader.address);

    const exit = px(990); // -1%
    await oracle.setPrice(PAIR_A, exit);

    const rawPnl = pnlFor(p.notional, p.entryPrice, exit, true);
    const loss = -rawPnl;
    expect(loss).to.equal(99_920_000n);
    expect(loss).to.be.lessThan(p.margin);
    const refund = p.margin - loss;
    const retained = p.margin - refund;

    await expect(platform.connect(trader).closePosition(id))
      .to.emit(vault, "SurplusRetained")
      .withArgs(id, retained);
    await expect(platform.connect(trader).closePosition(id))
      .to.be.revertedWithCustomError(platform, "PositionClosedAlready");

    // Realized loss surplus is pulled from V3 custody into settlement capital once.
    expect(await vault.settlementLedger()).to.equal(ledgerBefore + retained);
    expect(await vault.settlementSurplusRetained()).to.equal(surplusBefore + retained);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(
      vaultBalBefore + retained
    );
    expect(await usdc.balanceOf(trader.address)).to.equal(traderBefore + refund);
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(0n);

    // No settlement outflow happened on the loss leg.
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("double close and double liquidation are impossible: liability can never be released twice", async function () {
    const id = await open(trader, { sl: px(990), tp: px(1010) });
    await oracle.setPrice(PAIR_A, px(1010));
    await platform.connect(trader).closePosition(id);

    await expect(platform.connect(trader).closePosition(id)).to.be.revertedWithCustomError(
      platform,
      "PositionClosedAlready"
    );
    await expect(platform.connect(liquidator).liquidate(id)).to.be.revertedWithCustomError(
      platform,
      "PositionClosedAlready"
    );
    await expect(platform.connect(keeper).closeWithTrigger(id)).to.be.revertedWithCustomError(
      platform,
      "PositionClosedAlready"
    );

    // Registry liability is exactly zero and can never go negative again.
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    await expectLiabilityInvariant();
  });

  it("liquidation splits the penalty 30/70 liquidator/treasury and releases M_i", async function () {
    const id = await open(trader, { leverage: 50n });
    const p = await platform.getPosition(id);
    expect(p.liquidationPrice).to.equal(
      ENTRY - (ENTRY * MAINTENANCE_BPS) / 10000n / 50n
    ); // $998

    // One wei above the threshold is not liquidatable.
    await oracle.setPrice(PAIR_A, p.liquidationPrice + 1n);
    await expect(
      platform.connect(liquidator).liquidate(id)
    ).to.be.revertedWithCustomError(platform, "NotLiquidatable");

    const exit = px(997); // below $998
    await oracle.setPrice(PAIR_A, exit);

    const vaultBalBefore = await usdc.balanceOf(await vault.getAddress());
    const liquidatorBefore = await usdc.balanceOf(liquidator.address);
    const treasuryBefore = await usdc.balanceOf(treasury.address);

    const penalty = p.margin;
    const reward = (penalty * LIQUIDATOR_BPS) / 10000n;
    const protocolFee = penalty - reward;
    expect(reward).to.equal(299_760_000n);
    expect(reward + protocolFee).to.equal(penalty);

    await expect(platform.connect(liquidator).liquidate(id))
      .to.emit(platform, "PositionLiquidated")
      .withArgs(id, trader.address, liquidator.address, exit, penalty);

    expect(await usdc.balanceOf(liquidator.address)).to.equal(liquidatorBefore + reward);
    expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + protocolFee);
    // V3 custody is drained by the split; the vault was not involved at all.
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(0n);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(vaultBalBefore);

    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    expect(await manager.pairMaxProfitLiab(PAIR_A)).to.equal(0n);
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(0n);

    await expect(
      platform.connect(liquidator).liquidate(id)
    ).to.be.revertedWithCustomError(platform, "PositionClosedAlready");
    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("keeper trigger close fills at the trigger price, settles, and releases M_i", async function () {
    const sl = px(990);
    const tp = px(1010);
    const id = await open(trader, { sl, tp });

    // Trigger not reached / unauthorised keeper guards.
    await expect(
      platform.connect(keeper).closeWithTrigger(id)
    ).to.be.revertedWithCustomError(platform, "TriggerNotReached");
    await expect(
      platform.connect(stranger).closeWithTrigger(id)
    ).to.be.revertedWithCustomError(platform, "NotAuthorisedKeeper");

    // Take-profit leg for a long: price above TP, fills exactly at TP.
    await oracle.setPrice(PAIR_A, px(1012));
    const p = await platform.getPosition(id);
    const gross = pnlFor(p.notional, p.entryPrice, tp, true);
    const closeFee = (gross * CLOSE_FEE_BPS) / 10000n;
    expect(gross).to.equal(99_920_000n);
    const ledgerBefore = await vault.settlementLedger();

    await expect(platform.connect(keeper).closeWithTrigger(id))
      .to.emit(platform, "PositionTriggerClosed")
      .withArgs(id, trader.address, keeper.address, tp, false);
    expect(await vault.settlementLedger()).to.equal(ledgerBefore - gross);
    expect(closeFee).to.equal(79_936n);
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
  });

  it("stop-loss trigger close for a short retains the loss surplus and releases M_i", async function () {
    const id = await open(trader2, {
      pairId: PAIR_B,
      isLong: false,
      sl: px(1010),
      tp: px(990),
    });
    await expectLiabilityInvariant();

    await oracle.setPrice(PAIR_B, px(1013));
    const p = await platform.getPosition(id);
    const loss = -pnlFor(p.notional, p.entryPrice, px(1010), false);
    expect(loss).to.be.greaterThan(0n);
    expect(loss).to.be.lessThan(p.margin);
    const surplusBefore = await vault.settlementSurplusRetained();

    await expect(platform.connect(keeper).closeWithTrigger(id))
      .to.emit(platform, "PositionTriggerClosed")
      .withArgs(id, trader2.address, keeper.address, px(1010), true);
    expect(await vault.settlementSurplusRetained()).to.equal(surplusBefore + loss);

    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    expect(await manager.pairMaxProfitLiab(PAIR_B)).to.equal(0n);
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(0n);
    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("no-trigger positions cannot be keeper-closed", async function () {
    const id = await open(trader);
    await expect(
      platform.connect(keeper).closeWithTrigger(id)
    ).to.be.revertedWithCustomError(platform, "NoTriggerSet");
    await expectLiabilityInvariant();
  });

  it("risk-manager admission halt blocks new opens but never blocks closes", async function () {
    const id = await open(trader);
    const liab = maxProfitLiabFor(NET_MARGIN);
    expect(await manager.currentMaxProtoLiab()).to.equal(liab);

    await manager.setAdmissionHalted(true);
    await expect(openTx(trader2)).to.be.revertedWithCustomError(
      platform,
      "AdmissionDenied"
    );
    // Halt changed nothing about existing liability.
    expect(await manager.currentMaxProtoLiab()).to.equal(liab);

    // De-risking must always be possible, halt or not.
    await oracle.setPrice(PAIR_A, px(1010));
    await expect(platform.connect(trader).closePosition(id)).to.not.be.reverted;
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("platform pause + admission halt gate new exposure without touching the vault", async function () {
    const id = await open(trader);
    const vaultBalBefore = await usdc.balanceOf(await vault.getAddress());

    await platform.setAdmissionHalted(true);
    await expect(openTx(trader2)).to.be.revertedWithCustomError(
      platform,
      "AdmissionHaltedActive"
    );
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(vaultBalBefore);

    // Close path deliberately ignores the platform halt (de-risking).
    await oracle.setPrice(PAIR_A, px(990));
    await expect(platform.connect(trader).closePosition(id)).to.not.be.reverted;
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);

    await platform.setPaused(true);
    await expect(openTx(trader)).to.be.revertedWithCustomError(
      platform,
      "PlatformPaused"
    );
    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("stale and unset oracle prices block state changes through the open path", async function () {
    await oracle.setPriceAt(PAIR_A, ENTRY, 1); // ancient timestamp
    await expect(openTx(trader)).to.be.revertedWithCustomError(platform, "StalePrice");
    await expect(platform.connect(trader).closePosition(1)).to.be.revertedWithCustomError(
      platform,
      "PositionClosedAlready"
    );

    await oracle.setPrice(PAIR_A, ENTRY);
    await expect(openTx(trader)).to.not.be.reverted;
  });

  it("INVARIANT: Σ M_i == L0 (global + per-pair + per-group) through a mixed open/close/liquidate/trigger sequence", async function () {
    // (1) six opens across three pairs, two correlation groups, two traders
    const id0 = await open(trader, { pairId: PAIR_A, margin: u(1000), leverage: 10n });
    const id1 = await open(trader, { pairId: PAIR_A, margin: u(2000), leverage: 20n });
    const id2 = await open(trader2, { pairId: PAIR_A, isLong: false, margin: u(1500), leverage: 5n });
    const id3 = await open(trader, { pairId: PAIR_B, margin: u(1200), leverage: 8n });
    const id4 = await open(trader2, { pairId: PAIR_B, isLong: false, margin: u(800), leverage: 12n, sl: px(1010) });
    const id5 = await open(trader, { pairId: PAIR_C, margin: u(900), leverage: 15n });

    let snap = await expectLiabilityInvariant();
    expect(snap.ids.length).to.equal(6);
    // Closed form: Σ M_i == 3 * Σ(netMargin_i) — the registry must match the
    // open positions' own liability, not merely be internally consistent.
    const totalMargin = u(1000) + u(2000) + u(1500) + u(1200) + u(800) + u(900);
    const totalFees = (totalMargin * OPEN_FEE_BPS) / 10000n;
    expect(snap.total).to.equal(maxProfitLiabFor(totalMargin - totalFees));
    expect(snap.total).to.equal(22_182_240_000n);
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(19_484_400_000n);
    expect(await manager.corrGroupLiab(GRP_METAL)).to.equal(2_697_840_000n);

    // (2) profitable direct close of a PAIR_A long
    await oracle.setPrice(PAIR_A, px(1005));
    const closeWinReceipt = await (
      await platform.connect(trader).closePosition(id0)
    ).wait();
    snap = await expectLiabilityInvariant();
    expect(snap.ids.length).to.equal(5);

    // (3) liquidate the PAIR_A short: PAIR_A is pushed past its $1020 liq price
    await oracle.setPrice(PAIR_A, px(1025));
    const liquidateReceipt = await (
      await platform.connect(liquidator).liquidate(id2)
    ).wait();
    snap = await expectLiabilityInvariant();
    expect(snap.ids.length).to.equal(4);
    expect(await manager.pairMaxProfitLiab(PAIR_A)).to.equal(5_995_200_000n);

    // (4) losing direct close on PAIR_B
    await oracle.setPrice(PAIR_B, px(995));
    const closeLossReceipt = await (
      await platform.connect(trader).closePosition(id3)
    ).wait();
    snap = await expectLiabilityInvariant();
    expect(snap.ids.length).to.equal(3);

    // (5) keeper trigger (stop-loss) close of the PAIR_B short
    await oracle.setPrice(PAIR_B, px(1013));
    const triggerReceipt = await (
      await platform.connect(keeper).closeWithTrigger(id4)
    ).wait();
    snap = await expectLiabilityInvariant();

    // Exactly the two untouched positions remain, and nothing else does.
    expect(snap.ids).to.deep.equal([id1, id5]);
    expect(snap.total).to.equal(
      (await platform.getPosition(id1)).maxProfitLiab +
        (await platform.getPosition(id5)).maxProfitLiab
    );
    expect(await manager.pairMaxProfitLiab(PAIR_B)).to.equal(0n);
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(5_995_200_000n);
    expect(await manager.corrGroupLiab(GRP_METAL)).to.equal(2_697_840_000n);

    // ————————— AUDITABLE SETTLEMENT-LEDGER BREAKDOWN (EQ-5) —————————
    // Every settlement-ledger movement of this sequence is itemised here by
    // position ID, transaction, amount, reason and direction. The table is
    // rebuilt from the Vault's own events (ProfitSettled / SurplusRetained) —
    // it is not hand-asserted — so the conservation proof below is auditable.
    const movements = [];
    const movementsFrom = (receipt, transaction) => {
      for (const log of receipt.logs) {
        let parsed = null;
        try {
          parsed = vault.interface.parseLog(log);
        } catch (_) {
          /* not a Vault event */
        }
        if (!parsed) continue;
        if (parsed.name === "ProfitSettled") {
          movements.push({
            positionId: parsed.args[0],
            transaction,
            amount: parsed.args[2] + parsed.args[3],
            direction: "settlement outflow",
            reason: `gross profit debit = traderProfit ${parsed.args[2]} + closeFee ${parsed.args[3]}`,
          });
        } else if (parsed.name === "SurplusRetained") {
          movements.push({
            positionId: parsed.args[0],
            transaction,
            amount: parsed.args[1],
            direction: "surplus credit",
            reason:
              "realized loss surplus pulled from V3 custody into settlement capital",
          });
        }
      }
    };
    movementsFrom(closeWinReceipt, "closePosition (win)");
    movementsFrom(liquidateReceipt, "liquidate");
    movementsFrom(closeLossReceipt, "closePosition (loss)");
    movementsFrom(triggerReceipt, "closeWithTrigger (SL fill)");

    // The complete table: exactly three movements, each with one owner and one
    // direction. Nothing else may appear.
    expect(
      movements.map((m) => ({
        positionId: m.positionId,
        transaction: m.transaction,
        amount: m.amount,
        direction: m.direction,
      }))
    ).to.deep.equal([
      {
        positionId: id0,
        transaction: "closePosition (win)",
        amount: 49_960_000n,
        direction: "settlement outflow",
      },
      {
        positionId: id3,
        transaction: "closePosition (loss)",
        amount: 47_961_600n,
        direction: "surplus credit",
      },
      {
        positionId: id4,
        transaction: "closeWithTrigger (SL fill)",
        amount: 95_923_200n,
        direction: "surplus credit",
      },
    ]);
    // Liquidation (id2) and all six open fees are absent BY CONSTRUCTION: they
    // move money inside V3 custody or to the treasury and never touch settlement
    // capital. Their amounts, for the record:
    //   id2 liquidation penalty        = 1,498,800,000
    //     -> liquidator reward          449,640,000 (V3 custody)
    //     -> protocol fee             1,049,160,000 (V3 custody -> treasury)
    //   open fees (ids 0..5)           = 5,920,000   (V3 custody -> treasury)
    expect(movements.length).to.equal(3);

    // Conservation, term by term:
    //   final S = initial S − Σ legitimate outflows
    //                      + Σ realized-loss surplus credits
    //                      + other explicitly permitted credits (ZERO here)
    const seed = SETTLEMENT;
    const outflows = 49_960_000n;
    const credits = 47_961_600n + 95_923_200n;
    const otherPermittedCredits = 0n;
    expect(
      movements
        .filter((m) => m.direction === "settlement outflow")
        .reduce((acc, m) => acc + m.amount, 0n)
    ).to.equal(outflows);
    expect(
      movements
        .filter((m) => m.direction === "surplus credit")
        .reduce((acc, m) => acc + m.amount, 0n)
    ).to.equal(credits);
    expect(seed - outflows + credits + otherPermittedCredits).to.equal(
      SETTLEMENT - 49_960_000n + 47_961_600n + 95_923_200n
    );

    // Dollar conservation on the vault side (economics unchanged).
    expect(await vault.settlementLedger()).to.equal(
      SETTLEMENT - 49_960_000n + 47_961_600n + 95_923_200n
    );
    expect(await vault.settlementSurplusRetained()).to.equal(
      47_961_600n + 95_923_200n
    );
    // V3 still custodies exactly the two open positions' net margins.
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(
      (await platform.getPosition(id1)).margin +
        (await platform.getPosition(id5)).margin
    );
    await expectVaultPhysical();
  });

  it("invariant check is non-vacuous: out-of-band liability registration is detected", async function () {
    await open(trader);
    await expectLiabilityInvariant();

    // Only possible if the registry's platform pointer is mis-wired; simulate it.
    await manager.setPlatform(admin.address);
    await manager.connect(admin).registerOpen(PAIR_C, u(123));

    let detected = false;
    try {
      await expectLiabilityInvariant();
    } catch (_) {
      detected = true;
    }
    expect(detected, "Σ M_i drift must fail the invariant").to.equal(true);

    // Restore the wiring and the registry; the invariant must hold again.
    await manager.connect(admin).registerClose(PAIR_C, u(123));
    await manager.setPlatform(await platform.getAddress());
    expect(await manager.currentMaxProtoLiab()).to.equal(
      maxProfitLiabFor(NET_MARGIN)
    );
    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

  it("retains V2 economic parity parameters and the V3 view surface", async function () {
    expect(await platform.maxLeverage()).to.equal(MAX_LEVERAGE);
    expect(await platform.maintenanceMarginBps()).to.equal(MAINTENANCE_BPS);
    expect(await platform.maxProfitBps()).to.equal(MAX_PROFIT_BPS);
    expect(await platform.priceTimeout()).to.equal(120n);
    expect(await platform.openFeeBps()).to.equal(OPEN_FEE_BPS);
    expect(await platform.closeFeeBps()).to.equal(CLOSE_FEE_BPS);
    expect(await platform.liquidatorRewardBps()).to.equal(LIQUIDATOR_BPS);

    // Wiring surface.
    expect(await platform.oracle()).to.equal(await oracle.getAddress());
    expect(await platform.settlementVault()).to.equal(await vault.getAddress());
    expect(await platform.riskManager()).to.equal(await manager.getAddress());
    expect(await platform.collateralToken()).to.equal(await usdc.getAddress());
    expect(await platform.treasury()).to.equal(treasury.address);

    // Position bookkeeping views.
    const id = await open(trader, { pairId: PAIR_C });
    await open(trader, { pairId: PAIR_A });
    await open(trader2, { pairId: PAIR_A });
    expect([...(await platform.getUserPositions(trader.address))]).to.deep.equal([
      id,
      id + 1n,
    ]);

    await oracle.setPrice(PAIR_C, px(1010));
    await platform.connect(trader).closePosition(id);
    const openIds = (await platform.getUserOpenPositions(trader.address)).map(
      (p) => p.maxProfitLiab
    );
    expect(openIds).to.deep.equal([maxProfitLiabFor(NET_MARGIN)]);

    // Fees guards.
    await expect(
      platform.connect(stranger).setTradingFees(1, 1)
    ).to.be.revertedWithCustomError(platform, "OwnableUnauthorizedAccount");
    await expect(platform.setTradingFees(51, 8)).to.be.revertedWith(
      "Open fee too high"
    );
    await expect(platform.setLiquidatorReward(5001)).to.be.revertedWith(
      "Reward too high"
    );

    await expectLiabilityInvariant();
    await expectVaultPhysical();
  });

});
