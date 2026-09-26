const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Model-B Phase 4 — exposure concentration, oracle handling, and V2/V3 parity.
 *
 * Covers:
 *   - pair concentration  : capPerPair binds per pair, is isolated across pairs,
 *                           and binds exactly at its boundary;
 *   - correlated exposure : capPerCorrGroup binds the group (not the pair), and
 *                           ungrouped pairs are exempt by construction;
 *   - oracle staleness    : the 120s priceTimeout boundary is exact on every
 *                           entry point, and a failed oracle transition cannot
 *                           corrupt liability or money;
 *   - oracle failure      : unknown pair and non-contract oracle both fail
 *                           closed, atomically and with zero footprint;
 *   - oracle deviation    : NO deviation band is specified or implemented —
 *                           asserted as a documented absence (the Model-B defence
 *                           is the max-profit cap == M_i, the loss cap at margin,
 *                           the coverage inequality and the pair/group caps);
 *   - fuzz/property       : randomized opens/closes under real caps keep the
 *                           exposure ledgers equal to reconstruction, keep
 *                           L0 <= maxPermittedLiability, and keep denied opens
 *                           footprint-free;
 *   - V2/V3 parity        : identical inputs produce identical margin, notional,
 *                           liquidation price, PnL, fee views, trader payouts
 *                           and liquidator/protocol splits.
 */
describe("Model-B Phase 4 — exposure concentration, oracle handling and V2/V3 parity", function () {
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
  const PAIR_D = ethers.id("AUD/NZD"); // deliberately left ungrouped
  const PAIR_E = ethers.id("USD/JPY");
  const GRP_FX = "0x4658000000000000"; // bytes8("FX")
  const GRP_METAL = "0x4d54000000000000"; // bytes8("MT")
  const ZERO_GROUP = "0x0000000000000000";

  const MAX_LEVERAGE = 50n;
  const MAINTENANCE_BPS = 1000n;
  const MAX_PROFIT_BPS = 30000n;
  const OPEN_FEE_BPS = 8n;
  const CLOSE_FEE_BPS = 8n;
  const LIQUIDATOR_BPS = 3000n;

  const MARGIN = u(1000);
  const LEVERAGE = 10n;
  const ENTRY = px(1000);
  const OPEN_FEE = (MARGIN * OPEN_FEE_BPS) / 10000n; // 800_000
  const NET_MARGIN = MARGIN - OPEN_FEE; // 999_200_000
  const M_I = (NET_MARGIN * MAX_PROFIT_BPS) / 10000n; // 2_997_600_000

  let admin, trader, trader2, keeper, liquidator, treasury, stranger;
  let usdc, oracle, vault, manager, platform;

  const netMarginFor = (margin) => margin - (margin * OPEN_FEE_BPS) / 10000n;
  const maxProfitLiabFor = (netMargin) =>
    (netMargin * MAX_PROFIT_BPS) / 10000n;

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
    vault = await Vault.deploy(
      await usdc.getAddress(),
      treasury.address,
      admin.address
    );
    await vault.waitForDeployment();

    const Manager = await ethers.getContractFactory(
      "src/contracts/ProtocolRiskManager.sol:ProtocolRiskManager"
    );
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

    await vault.setRiskManager(await manager.getAddress());
    await vault.grantRole(await vault.SETTLER_ROLE(), await platform.getAddress());
    await manager.setPlatform(await platform.getAddress());
    await manager.setRiskParams(MIN_COVERAGE_BPS, HUGE_CAP, HUGE_CAP);

    // Groups are configured before any liability exists for those pairs.
    await manager.setPairCorrGroup(PAIR_A, GRP_FX);
    await manager.setPairCorrGroup(PAIR_B, GRP_FX);
    await manager.setPairCorrGroup(PAIR_C, GRP_METAL);
    await manager.setPairCorrGroup(PAIR_E, GRP_FX);

    await platform.setTreasury(treasury.address);
    await platform.setKeeper(keeper.address, true);

    await usdc.mint(admin.address, CAPITAL, "phase4 vault seed");
    await usdc
      .connect(admin)
      .approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.seedCapital(SETTLEMENT, RESERVE, OPS);

    for (const who of [trader, trader2, liquidator]) {
      await usdc.mint(who.address, u(50000), "phase4 trader seed");
      await usdc
        .connect(who)
        .approve(await platform.getAddress(), ethers.MaxUint256);
    }

    for (const pair of [PAIR_A, PAIR_B, PAIR_C, PAIR_D, PAIR_E]) {
      await oracle.setPrice(pair, ENTRY);
    }
  });

  // ———————————————————— fixtures & helpers ————————————————————

  function openTx(signer, opts = {}) {
    const {
      pairId = PAIR_A,
      isLong = true,
      margin = MARGIN,
      leverage = LEVERAGE,
      sl = 0n,
      tp = 0n,
    } = opts;
    return platform
      .connect(signer)
      .openPosition(pairId, isLong, margin, leverage, sl, tp);
  }

  function positionIdFrom(receipt) {
    for (const log of receipt.logs) {
      let parsed = null;
      try {
        parsed = platform.interface.parseLog(log);
      } catch (_) {
        /* not a V3 log */
      }
      if (parsed && parsed.name === "PositionOpened") return parsed.args[0];
    }
    throw new Error("PositionOpened not emitted");
  }

  async function open(signer, opts = {}) {
    return positionIdFrom(await (await openTx(signer, opts)).wait());
  }

  const close = (signer, id) =>
    platform.connect(signer).closePosition(id).then((t) => t.wait());
  const liquidate = (signer, id) =>
    platform.connect(signer).liquidate(id).then((t) => t.wait());
  const trigger = (signer, id) =>
    platform.connect(signer).closeWithTrigger(id).then((t) => t.wait());

  function eventsOf(receipt, contract, name) {
    const found = [];
    for (const log of receipt.logs) {
      let parsed = null;
      try {
        parsed = contract.interface.parseLog(log);
      } catch (_) {
        /* not this contract's event */
      }
      if (parsed && parsed.name === name) found.push(parsed);
    }
    return found;
  }
  /// EQ-3 for every pair in the fixture: the risk ledgers must equal the OPEN
  /// positions' own M_i, and each group ledger the sum over its member pairs.
  async function expectLedgerReconstruction() {
    const pairs = [PAIR_A, PAIR_B, PAIR_C, PAIR_D, PAIR_E];
    const nextId = await platform.nextPositionId();
    const pairTotals = new Map();
    const groupTotals = new Map();
    let total = 0n;
    for (let id = 1n; id < nextId; id++) {
      const p = await platform.getPosition(id);
      if (!p.isOpen) continue;
      total += p.maxProfitLiab;
      pairTotals.set(p.pairId, (pairTotals.get(p.pairId) ?? 0n) + p.maxProfitLiab);
      const group = await manager.pairCorrGroup(p.pairId);
      if (group !== ZERO_GROUP) {
        groupTotals.set(group, (groupTotals.get(group) ?? 0n) + p.maxProfitLiab);
      }
    }
    expect(await manager.currentMaxProtoLiab(), "Σ M_i").to.equal(total);
    for (const pair of pairs) {
      expect(
        await manager.pairMaxProfitLiab(pair),
        `pair ledger ${pair}`
      ).to.equal(pairTotals.get(pair) ?? 0n);
    }
    for (const group of [GRP_FX, GRP_METAL]) {
      expect(
        await manager.corrGroupLiab(group),
        `group ledger ${group}`
      ).to.equal(groupTotals.get(group) ?? 0n);
    }
    // The money side stays partitioned no matter how exposure is shaped.
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
    return { total, pairTotals, groupTotals };
  }

  /// Spec mirror of the approved admission decision (view == specification).
  async function mirrorAuthorizeOpen(pairId, newM) {
    if (await manager.paused()) return false;
    if (await manager.admissionHalted()) return false;
    const l1 = (await manager.currentMaxProtoLiab()) + newM;
    const s = await vault.settlementLedger();
    const cmin = await manager.minimumCoverageBps();
    if (s * 10000n < cmin * l1) return false;
    if (
      (await manager.pairMaxProfitLiab(pairId)) + newM >
      (await manager.capPerPair())
    ) {
      return false;
    }
    const group = await manager.pairCorrGroup(pairId);
    if (
      group !== ZERO_GROUP &&
      (await manager.corrGroupLiab(group)) + newM >
        (await manager.capPerCorrGroup())
    ) {
      return false;
    }
    return true;
  }

  // ————————————————————————————— tests —————————————————————————————


  it("pair concentration: capPerPair binds per pair, isolates other pairs, and is exact at its boundary", async function () {
    const CAP_PAIR = u(3000); // 3,000 USDC of max profit liability per pair

    await manager.setRiskParams(MIN_COVERAGE_BPS, CAP_PAIR, HUGE_CAP);
    expect(await manager.capPerPair()).to.equal(CAP_PAIR);
    expect(await manager.capPerCorrGroup()).to.equal(HUGE_CAP);

    // (a) The first position fits, the second one breaches the pair cap.
    await open(trader, { pairId: PAIR_A });
    expect(await manager.pairMaxProfitLiab(PAIR_A)).to.equal(M_I);
    expect(M_I).to.equal(2_997_600_000n);
    expect(M_I).to.be.lessThan(CAP_PAIR);

    const platformBefore = await usdc.balanceOf(await platform.getAddress());
    const nextIdBefore = await platform.nextPositionId();
    await expect(openTx(trader, { pairId: PAIR_A })).to.be.revertedWithCustomError(
      platform,
      "AdmissionDenied"
    );

    // The denied open left ZERO footprint: no id consumed, no collateral moved,
    // no liability registered.
    expect(await platform.nextPositionId()).to.equal(nextIdBefore);
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(
      platformBefore
    );
    expect(await manager.pairMaxProfitLiab(PAIR_A)).to.equal(M_I);
    expect(await manager.currentMaxProtoLiab()).to.equal(M_I);
    expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
    await expectLedgerReconstruction();

    // (b) The cap is per pair: another pair is completely unaffected.
    await open(trader, { pairId: PAIR_B });
    expect(await manager.pairMaxProfitLiab(PAIR_B)).to.equal(M_I);
    await expectLedgerReconstruction();

    // (c) Exact boundary: pairLedger + newM == cap is admitted, +1 wei is not.
    await manager.setRiskParams(MIN_COVERAGE_BPS, M_I, HUGE_CAP);
    await open(trader, { pairId: PAIR_C });
    expect(await manager.pairMaxProfitLiab(PAIR_C)).to.equal(M_I);
    await expect(openTx(trader, { pairId: PAIR_C, margin: u(1), leverage: 1n })).to.be.revertedWithCustomError(
      platform,
      "AdmissionDenied"
    );

    // Even a one-dollar position cannot squeeze past a full pair.
    const { total, pairTotals } = await expectLedgerReconstruction();
    expect(total).to.equal(3n * M_I);
    expect(pairTotals.get(PAIR_A)).to.equal(M_I);
    expect(pairTotals.get(PAIR_B)).to.equal(M_I);
    expect(pairTotals.get(PAIR_C)).to.equal(M_I);
    expect(await manager.maxPermittedLiability()).to.be.greaterThan(total);
  });

  it("correlated exposure: capPerCorrGroup binds the group rather than the pair, and ungrouped pairs are exempt", async function () {
    const CAP_GROUP = u(4000);

    await manager.setRiskParams(MIN_COVERAGE_BPS, HUGE_CAP, CAP_GROUP);

    // (a) PAIR_A fits inside the FX group; PAIR_B would push the GROUP over the
    //     group cap even though the pair cap (huge) is nowhere near.
    await open(trader, { pairId: PAIR_A });
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(M_I);
    await expect(openTx(trader, { pairId: PAIR_B })).to.be.revertedWithCustomError(
      platform,
      "AdmissionDenied"
    );
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(M_I);
    expect(await manager.pairMaxProfitLiab(PAIR_B)).to.equal(0n);

    // (b) A different group is unaffected, and an UNGROUPED pair is exempt from
    //     group concentration entirely (group == 0 => no group ledger entry).
    await open(trader, { pairId: PAIR_C }); // GRP_METAL
    expect(await manager.corrGroupLiab(GRP_METAL)).to.equal(M_I);
    expect(await manager.pairCorrGroup(PAIR_D)).to.equal(ZERO_GROUP);
    await open(trader, { pairId: PAIR_D }); // ungrouped, FX group is full
    expect(await manager.pairMaxProfitLiab(PAIR_D)).to.equal(M_I);
    await expectLedgerReconstruction();

    // (c) Exact boundary: two FX positions == cap is admitted, a third is not.
    await manager.setRiskParams(MIN_COVERAGE_BPS, HUGE_CAP, 2n * M_I);
    await open(trader, { pairId: PAIR_B }); // FX group now exactly at the cap
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(2n * M_I);
    await expect(
      openTx(trader, { pairId: PAIR_E, margin: u(1), leverage: 1n })
    ).to.be.revertedWithCustomError(platform, "AdmissionDenied");
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(2n * M_I);

    // (d) The group ledger is exactly the sum over its member pairs, and the sum
    //     over groups plus ungrouped exposure is exactly L0.
    const { total, pairTotals, groupTotals } = await expectLedgerReconstruction();
    expect(groupTotals.get(GRP_FX)).to.equal(2n * M_I);
    expect(groupTotals.get(GRP_METAL)).to.equal(M_I);
    expect(pairTotals.get(PAIR_A) + pairTotals.get(PAIR_B)).to.equal(
      groupTotals.get(GRP_FX)
    );
    expect(pairTotals.get(PAIR_C)).to.equal(groupTotals.get(GRP_METAL));
    expect(total).to.equal(
      groupTotals.get(GRP_FX) + groupTotals.get(GRP_METAL) + pairTotals.get(PAIR_D)
    );
    expect(await manager.corrGroupLiab(GRP_FX)).to.be.lessThanOrEqual(
      await manager.capPerCorrGroup()
    );

    // (e) A pair with live liability cannot be regrouped afterwards, so the group
    //     ledger can never be desynchronised from the pairs it aggregates.
    await expect(
      manager.connect(admin).setPairCorrGroup(PAIR_A, GRP_METAL)
    ).to.be.revertedWithCustomError(manager, "LiabilityRegistered");
  });

  it("oracle staleness: the 120s boundary is exact on every entry point and a stale feed cannot corrupt the books", async function () {
    const TIMEOUT = Number(await platform.priceTimeout());
    expect(TIMEOUT).to.equal(120);
    const clock = async () =>
      (await ethers.provider.getBlock("latest")).timestamp;
    const at = (ts) =>
      ethers.provider.send("evm_setNextBlockTimestamp", [ts]);

    // (a) An age EXACTLY equal to priceTimeout is accepted. The mock oracle stores
    //     an explicit updatedAt and the next block timestamp is pinned, so the age
    //     is deterministic; the landed block timestamp is verified, not assumed.
    const t0 = await clock();
    await oracle.setPriceAt(PAIR_A, ENTRY, t0);
    await at(t0 + TIMEOUT);
    const openReceipt = await openTx(trader, {
      pairId: PAIR_A,
      sl: px(990),
    }).then((tx) => tx.wait());
    const id = positionIdFrom(openReceipt);
    expect(
      (await ethers.provider.getBlock(openReceipt.blockNumber)).timestamp - t0
    ).to.equal(TIMEOUT);

    // (b) One second older (121 > 120) is stale on ALL four entry points.
    const t1 = await clock();
    await oracle.setPriceAt(PAIR_A, ENTRY, t1);
    await at(t1 + TIMEOUT + 1);
    await expect(openTx(trader, { pairId: PAIR_A })).to.be.revertedWithCustomError(
      platform,
      "StalePrice"
    );
    await expect(
      platform.connect(trader).closePosition(id)
    ).to.be.revertedWithCustomError(platform, "StalePrice");
    await expect(
      platform.connect(liquidator).liquidate(id)
    ).to.be.revertedWithCustomError(platform, "StalePrice");
    await expect(
      platform.connect(keeper).closeWithTrigger(id)
    ).to.be.revertedWithCustomError(platform, "StalePrice");

    // All four refusals changed nothing: the position, its liability and the
    // money are exactly where they were.
    expect((await platform.getPosition(id)).isOpen).to.equal(true);
    expect(await manager.currentMaxProtoLiab()).to.equal(M_I);
    expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(NET_MARGIN);
    await expectLedgerReconstruction();

    // (c) A refreshed feed restores every path: nothing was stranded.
    await oracle.setPrice(PAIR_A, px(1005)); // fresh again, in profit
    await close(trader, id);
    expect((await platform.getPosition(id)).isOpen).to.equal(false);
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    expect(await vault.settlementLedger()).to.equal(SETTLEMENT - 49_960_000n);
    await expectLedgerReconstruction();
  });

  it("oracle failure: an unknown pair and a non-contract oracle both fail closed, atomically and with zero footprint", async function () {
    const UNKNOWN = ethers.id("ZZZ/USD");
    const nextIdBefore = await platform.nextPositionId();
    const traderBefore = await usdc.balanceOf(trader.address);

    // (a) The oracle itself reverts for an unset pair, so V3 never sees a price
    //     and makes no partial change: no id consumed, no collateral moved, no
    //     liability registered.
    await expect(openTx(trader, { pairId: UNKNOWN })).to.be.revertedWith(
      "Price not set"
    );
    expect(await platform.nextPositionId()).to.equal(nextIdBefore);
    expect(await usdc.balanceOf(trader.address)).to.equal(traderBefore);
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
    await expectLedgerReconstruction();

    // (b) A wired oracle that is not a contract returns no data at all: every
    //     price dependent entry point reverts instead of reading a silent zero.
    //     (The `price == 0` guard in V3 is therefore a defensive backstop: it is
    //     not reachable through MockPriceOracleV2, which reverts for unknown
    //     pairs rather than returning zero.)
    const id = await open(trader, { pairId: PAIR_A, sl: px(990) });
    await platform.setOracle(stranger.address);
    await expect(openTx(trader, { pairId: PAIR_A })).to.be.reverted;
    await expect(platform.connect(trader).closePosition(id)).to.be.reverted;
    await expect(platform.connect(liquidator).liquidate(id)).to.be.reverted;
    await expect(platform.connect(keeper).closeWithTrigger(id)).to.be.reverted;

    // While the feed is broken the position is still open and fully registered,
    // and the money is untouched.
    expect((await platform.getPosition(id)).isOpen).to.equal(true);
    expect(await manager.currentMaxProtoLiab()).to.equal(M_I);
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(NET_MARGIN);
    await expectLedgerReconstruction();

    // (c) Restoring the oracle completes the pending close normally. It settles at
    //     the current mark (ENTRY => zero PnL), so the margin is returned in full
    //     and the only permanently lost dollar is the open fee.
    await platform.setOracle(await oracle.getAddress());
    await close(trader, id);
    expect((await platform.getPosition(id)).isOpen).to.equal(false);
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    expect(await vault.settlementLedger()).to.equal(SETTLEMENT);
    expect(await usdc.balanceOf(trader.address)).to.equal(traderBefore - OPEN_FEE);
    await expectLedgerReconstruction();
  });

  it("oracle deviation: no deviation band is specified or implemented, and the max-profit cap equals M_i", async function () {
    // DOCUMENTED ABSENCE. No deviation/threshold parameter exists on V3 or on
    // ProtocolRiskManager (asserted at the interface level), so a single oracle
    // tick can move the mark price by any amount. The Model-B defences against a
    // deviating price are: the max-profit cap (== the registered liability M_i),
    // the loss cap at margin, the coverage inequality, and the pair/group caps.
    const v3Functions = platform.interface.fragments
      .filter((f) => f.type === "function")
      .map((f) => f.name);
    const managerFunctions = manager.interface.fragments
      .filter((f) => f.type === "function")
      .map((f) => f.name);
    for (const banned of [
      "setDeviationBps",
      "deviationBps",
      "maxDeviationBps",
      "setMaxDeviation",
    ]) {
      expect(v3Functions, `V3 must not expose ${banned}`).to.not.include(banned);
      expect(managerFunctions, `Manager must not expose ${banned}`).to.not.include(
        banned
      );
    }

    // (a) A 50% instantaneous drop is consumed verbatim, and the loss is capped
    //     exactly at the position margin.
    const id = await open(trader, { pairId: PAIR_C });
    await oracle.setPrice(PAIR_C, px(500));
    expect((await platform.getPosition(id)).entryPrice).to.equal(ENTRY);
    expect(await platform.getCurrentPnL(id)).to.equal(-NET_MARGIN);
    const s1 = await vault.settlementLedger();
    await close(trader, id);
    expect(await vault.settlementLedger()).to.equal(s1 + NET_MARGIN);
    await expectLedgerReconstruction();

    // (b) A +100% spike cannot pay out more than was admitted: the win leg settles
    //     exactly M_i, because maxProfitBps * netMargin / 10000 IS M_i.
    const id2 = await open(trader, { pairId: PAIR_C });
    await oracle.setPrice(PAIR_C, px(2000));
    expect(await platform.getCurrentPnL(id2)).to.equal(
      maxProfitLiabFor(NET_MARGIN)
    );
    expect(maxProfitLiabFor(NET_MARGIN)).to.equal(M_I);
    const p2 = await platform.getPosition(id2);
    expect(p2.maxProfitLiab).to.equal(M_I);
    const s2 = await vault.settlementLedger();
    await close(trader, id2);
    expect(await vault.settlementLedger()).to.equal(s2 - M_I);
    await expectLedgerReconstruction();

    // (c) Even a capped win cannot break the books: the gross debit equals the
    //     liability that was released in the same transaction.
    expect(await vault.settlementLedger()).to.equal(
      SETTLEMENT + NET_MARGIN - M_I
    );
  });

  it("fuzz/property: randomized opens and closes under real caps never break the exposure ledgers", async function () {
    function mulberry32(a) {
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rnd = mulberry32(0xc0de1);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

    const CAP_PAIR = u(6000);
    const CAP_GROUP = u(10000);
    await manager.setRiskParams(MIN_COVERAGE_BPS, CAP_PAIR, CAP_GROUP);

    const pairs = [PAIR_A, PAIR_B, PAIR_C, PAIR_D, PAIR_E];
    const margins = [u(100), u(500), u(1000)];
    const leverages = [1n, 5n, 10n, 50n];
    const live = [];
    let opens = 0;
    let denials = 0;
    let closes = 0;

    for (let step = 0; step < 30; step++) {
      if (live.length === 0 || rnd() < 0.6) {
        const pairId = pick(pairs);
        const margin = pick(margins);
        const leverage = pick(leverages);
        const netMargin = netMarginFor(margin);
        const M = maxProfitLiabFor(netMargin);

        // The authoritative view must equal the specification mirror exactly.
        const mirrored = await mirrorAuthorizeOpen(pairId, M);
        expect(
          await manager.authorizeOpen(pairId, M, netMargin * leverage),
          `authorizeOpen(${pairId}, ${M})`
        ).to.equal(mirrored);

        const nextIdBefore = await platform.nextPositionId();
        const platformBefore = await usdc.balanceOf(await platform.getAddress());
        if (mirrored) {
          const id = await open(trader, {
            pairId,
            isLong: rnd() < 0.5,
            margin,
            leverage,
          });
          live.push({ id, pairId });
          opens += 1;
        } else {
          await expect(
            openTx(trader, { pairId, isLong: true, margin, leverage })
          ).to.be.revertedWithCustomError(platform, "AdmissionDenied");
          denials += 1;
          // A refused open leaves NO footprint at all.
          expect(await platform.nextPositionId()).to.equal(nextIdBefore);
          expect(await usdc.balanceOf(await platform.getAddress())).to.equal(
            platformBefore
          );
        }
      } else {
        const target = pick(live);
        await oracle.setPrice(
          target.pairId,
          pick([px(980), px(1000), px(1010)])
        );
        await close(trader, target.id);
        live.splice(live.indexOf(target), 1);
        closes += 1;
      }

      // After EVERY transition: caps respected, ledgers equal to reconstruction,
      // and admitted capacity still covers the registered liability.
      const { total, groupTotals } = await expectLedgerReconstruction();
      for (const pairId of pairs) {
        expect(
          await manager.pairMaxProfitLiab(pairId),
          `pair cap ${pairId}`
        ).to.be.lessThanOrEqual(CAP_PAIR);
      }
      for (const group of [GRP_FX, GRP_METAL]) {
        expect(
          await manager.corrGroupLiab(group),
          `group cap ${group}`
        ).to.be.lessThanOrEqual(CAP_GROUP);
      }
      expect(groupTotals.get(GRP_FX) ?? 0n).to.be.lessThanOrEqual(CAP_GROUP);
      expect(total).to.be.lessThanOrEqual(await manager.maxPermittedLiability());
    }

    // Non-vacuous: both decisions and both transition kinds were exercised.
    expect(opens).to.be.greaterThan(0);
    expect(denials).to.be.greaterThan(0);
    expect(closes).to.be.greaterThan(0);
    expect(opens + denials + closes).to.equal(30);
  });

  it("V2/V3 parity regression: identical inputs give identical economics, fee views and trader payouts", async function () {
    const V2 = await ethers.getContractFactory(
      "src/contracts/TradingPlatformV2.sol:TradingPlatformV2"
    );
    const v2 = await V2.deploy(await oracle.getAddress(), await usdc.getAddress());
    await v2.waitForDeployment();
    await v2.setTreasury(treasury.address);
    await v2.setKeeper(keeper.address, true);
    await usdc.mint(await v2.getAddress(), u(1000000), "v2 liquidity");
    await usdc.connect(trader).approve(await v2.getAddress(), ethers.MaxUint256);

    // (1) Economic parameters are identical.
    expect(await v2.maxLeverage()).to.equal(await platform.maxLeverage());
    expect(await v2.maintenanceMarginBps()).to.equal(
      await platform.maintenanceMarginBps()
    );
    expect(await v2.maxProfitBps()).to.equal(await platform.maxProfitBps());
    expect(await v2.priceTimeout()).to.equal(await platform.priceTimeout());
    expect(await v2.openFeeBps()).to.equal(await platform.openFeeBps());
    expect(await v2.closeFeeBps()).to.equal(await platform.closeFeeBps());
    expect(await v2.liquidatorRewardBps()).to.equal(
      await platform.liquidatorRewardBps()
    );
    // ...and they are the approved Model-B values.
    expect(await platform.maxLeverage()).to.equal(MAX_LEVERAGE);
    expect(await platform.maintenanceMarginBps()).to.equal(MAINTENANCE_BPS);
    expect(await platform.maxProfitBps()).to.equal(MAX_PROFIT_BPS);
    expect(await platform.priceTimeout()).to.equal(120n);
    expect(await platform.openFeeBps()).to.equal(OPEN_FEE_BPS);
    expect(await platform.closeFeeBps()).to.equal(CLOSE_FEE_BPS);
    expect(await platform.liquidatorRewardBps()).to.equal(LIQUIDATOR_BPS);
    const v2Cfg = await v2.getFeeConfig();
    expect(v2Cfg[0]).to.equal(await platform.treasury());
    expect(v2Cfg[1]).to.equal(await platform.openFeeBps());
    expect(v2Cfg[2]).to.equal(await platform.closeFeeBps());
    expect(v2Cfg[3]).to.equal(await platform.liquidatorRewardBps());
    expect(await v2.calculateOpenFee(MARGIN)).to.equal(OPEN_FEE);
    expect(await v2.calculateCloseFee(49_960_000n)).to.equal(39_968n);

    // (2) Position maths: net margin, notional and liquidation price.
    await oracle.setPrice(PAIR_A, ENTRY);
    const feeBeforeV2 = await usdc.balanceOf(treasury.address);
    await (
      await v2.connect(trader).openPosition(PAIR_A, true, MARGIN, LEVERAGE, 0, 0)
    ).wait();
    const v2OpenFee = (await usdc.balanceOf(treasury.address)) - feeBeforeV2;
    const feeBeforeV3 = await usdc.balanceOf(treasury.address);
    const v3Id = await open(trader, { pairId: PAIR_A });
    const v3OpenFee = (await usdc.balanceOf(treasury.address)) - feeBeforeV3;
    expect(v2OpenFee).to.equal(v3OpenFee);
    expect(v2OpenFee).to.equal(OPEN_FEE);

    const p2 = await v2.getPosition(1);
    const p3 = await platform.getPosition(v3Id);
    expect(p2.margin).to.equal(p3.margin);
    expect(p2.margin).to.equal(NET_MARGIN);
    expect(p2.leverage).to.equal(p3.leverage);
    expect(p2.notional).to.equal(p3.notional);
    expect(p2.entryPrice).to.equal(p3.entryPrice);
    expect(p2.liquidationPrice).to.equal(p3.liquidationPrice);
    expect(p2.liquidationPrice).to.equal(px(990));

    // (3) Mark-to-market view and the full win close are identical to the dollar.
    await oracle.setPrice(PAIR_A, px(1005));
    expect(await v2.getCurrentPnL(1)).to.equal(await platform.getCurrentPnL(v3Id));
    expect(await v2.getCurrentPnL(1)).to.equal(49_960_000n);

    const tBeforeV2 = await usdc.balanceOf(trader.address);
    const fBeforeV2 = await usdc.balanceOf(treasury.address);
    const rec2 = await (await v2.connect(trader).closePosition(1)).wait();
    const v2Payout = (await usdc.balanceOf(trader.address)) - tBeforeV2;
    const v2CloseFee = (await usdc.balanceOf(treasury.address)) - fBeforeV2;
    const v2Pnl = eventsOf(rec2, v2, "PositionClosed")[0].args[3];

    const tBeforeV3 = await usdc.balanceOf(trader.address);
    const fBeforeV3 = await usdc.balanceOf(treasury.address);
    const rec3 = await close(trader, v3Id);
    const v3Payout = (await usdc.balanceOf(trader.address)) - tBeforeV3;
    const v3CloseFee = (await usdc.balanceOf(treasury.address)) - fBeforeV3;
    const v3Pnl = eventsOf(rec3, platform, "PositionClosed")[0].args[3];

    expect(v3Payout).to.equal(v2Payout);
    expect(v3Payout).to.equal(NET_MARGIN + 49_960_000n - 39_968n);
    expect(v3CloseFee).to.equal(v2CloseFee);
    expect(v3CloseFee).to.equal(39_968n);
    // Known and intentional event difference: V2 reports the trader's PnL net of
    // the close fee, V3 reports the gross PnL (the fee is a separate leg settled
    // by the Vault). The economics and the payout are identical.
    expect(v3Pnl).to.equal(49_960_000n);
    expect(v2Pnl).to.equal(49_960_000n - 39_968n);
    expect(v3Pnl - v2Pnl).to.equal(v3CloseFee);

    // (4) Liquidation parity: same trigger price, same liquidator/protocol split.
    await oracle.setPrice(PAIR_A, ENTRY);
    await (
      await v2.connect(trader).openPosition(PAIR_A, false, u(1500), 5n, 0, 0)
    ).wait();
    const v3Id2 = await open(trader, {
      pairId: PAIR_A,
      isLong: false,
      margin: u(1500),
      leverage: 5n,
    });
    const p2b = await v2.getPosition(2);
    const p3b = await platform.getPosition(v3Id2);
    expect(p2b.margin).to.equal(p3b.margin);
    expect(p2b.notional).to.equal(p3b.notional);
    expect(p2b.liquidationPrice).to.equal(p3b.liquidationPrice);
    expect(p2b.liquidationPrice).to.equal(px(1020));

    await oracle.setPrice(PAIR_A, px(1020)); // exactly at both liquidation prices
    const lBeforeV2 = await usdc.balanceOf(liquidator.address);
    const fBeforeLiqV2 = await usdc.balanceOf(treasury.address);
    await (await v2.connect(liquidator).liquidate(2)).wait();
    const v2Reward = (await usdc.balanceOf(liquidator.address)) - lBeforeV2;
    const v2Proto = (await usdc.balanceOf(treasury.address)) - fBeforeLiqV2;

    const lBeforeV3 = await usdc.balanceOf(liquidator.address);
    const fBeforeLiqV3 = await usdc.balanceOf(treasury.address);
    await liquidate(liquidator, v3Id2);
    const v3Reward = (await usdc.balanceOf(liquidator.address)) - lBeforeV3;
    const v3Proto = (await usdc.balanceOf(treasury.address)) - fBeforeLiqV3;

    expect(v3Reward).to.equal(v2Reward);
    expect(v3Proto).to.equal(v2Proto);
    expect(v2Reward).to.equal(449_640_000n); // 30% of the 1,498,800,000 net margin
    expect(v2Proto).to.equal(1_049_160_000n);

    // (5) Keeper trigger parity: both fill at the STORED trigger, not at the
    //     drifted mark, and both pay the trader the identical amount.
    await oracle.setPrice(PAIR_A, ENTRY);
    await (
      await v2
        .connect(trader)
        .openPosition(PAIR_A, true, u(800), 12n, px(990), 0)
    ).wait();
    const v3Id3 = await open(trader, {
      pairId: PAIR_A,
      margin: u(800),
      leverage: 12n,
      sl: px(990),
    });
    await oracle.setPrice(PAIR_A, px(985)); // breaches the px(990) stop

    const tBeforeTrV2 = await usdc.balanceOf(trader.address);
    await (await v2.connect(keeper).closeWithTrigger(3)).wait();
    const v2TriggerPayout =
      (await usdc.balanceOf(trader.address)) - tBeforeTrV2;

    const tBeforeTrV3 = await usdc.balanceOf(trader.address);
    await trigger(keeper, v3Id3);
    const v3TriggerPayout =
      (await usdc.balanceOf(trader.address)) - tBeforeTrV3;

    expect(v3TriggerPayout).to.equal(v2TriggerPayout);
    expect(v3TriggerPayout).to.equal(703_436_800n); // 799,360,000 − 95,923,200
    expect((await platform.getPosition(v3Id3)).isOpen).to.equal(false);
    expect((await v2.getPosition(3)).isOpen).to.equal(false);
    // Everything V3-owned is released: no liability is left dangling.
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    await expectLedgerReconstruction();
  });
});
