const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Model-B Phase 4 — conservation equations, protocol accounting invariants and
 * close-path integrity proofs.
 *
 * The five equations proven (and re-checked after EVERY state transition):
 *
 *   EQ-1  PHYSICAL SUPPLY PARTITION
 *         usdc.totalSupply() == vault balance
 *                              + V3 (platform) balance
 *                              + sum of every holder balance
 *         Every minted dollar sits in exactly one bucket — no hidden bucket, no
 *         double counting.
 *
 *   EQ-2  VAULT LEDGER PARTITION
 *         vault USDC balance == settlementLedger + reserveLedger + opsLedger
 *         (SettlementVault.checkPhysicalInvariant()).
 *
 *   EQ-3  LIABILITY RECONSTRUCTION
 *         Sum over OPEN positions of M_i == currentMaxProtoLiab()
 *         and its per-pair (pairMaxProfitLiab) and per-correlation-group
 *         (corrGroupLiab) decompositions, with M_i read from the position
 *         itself (not re-derived), so V3 and RiskManager can never drift.
 *
 *   EQ-4  SETTLEMENT SOLVENCY (split by approved Option C)
 *         EQ-4a ADMISSION/GOVERNANCE (Cmin, point-in-time): settlementLedger * 10000 >= minimumCoverageBps * currentMaxProtoLiab. EQ-4b SETTLEMENT RESIDUAL (floor F, inductive): after every profitable settlement, S >= L at the 100pc floor, i.e. (S - g) * 10000 >= settlementFloorBps * (L0 - M)
 *
 *   EQ-5  SETTLEMENT-LEDGER ROLL-FORWARD (closed book)
 *         settlementLedger == settlementSeeded
 *                           + settlementSurplusRetained  (realized loss credits)
 *                           - sum of settled gross       (win debits)
 *                           + 0 other permitted credits
 *         Every term is derived from Vault EVENTS, never hand-waved, and
 *         LedgerTransfer / EmergencyLedgerTransfer must never fire in Phase 4.
 *
 * External coverage X is exactly 0 (no hedge manager is wired: `hedgeManager`
 * has no setter), so the coverage numerator is the settlement ledger alone —
 * asserted in `expectConservation`.
 */
describe("Model-B Phase 4 — conservation, accounting invariants and close-path integrity", function () {
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
  const LEVERAGE = 10n;
  const ENTRY = px(1000);
  const OPEN_FEE = (MARGIN * OPEN_FEE_BPS) / 10000n; // 800_000
  const NET_MARGIN = MARGIN - OPEN_FEE; // 999_200_000
  const M_I = (NET_MARGIN * MAX_PROFIT_BPS) / 10000n; // 2_997_600_000

  let admin, trader, trader2, keeper, liquidator, treasury, stranger;
  let usdc, oracle, vault, manager, platform;
  let wallets;

  /// Settlement-ledger movements observed so far (EQ-5), rebuilt from Vault events.
  let flows;
  /// Treasury fee credits by feeType, rebuilt from V3 ProtocolFeeCollected events.
  let feeTotals;

  beforeEach(async function () {
    [admin, trader, trader2, keeper, liquidator, treasury, stranger] =
      await ethers.getSigners();
    wallets = [admin, trader, trader2, keeper, liquidator, treasury, stranger];
    resetFlows();

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

    // Deployment runbook order: vault -> manager -> platform.
    await vault.setRiskManager(await manager.getAddress());
    await vault.grantRole(await vault.SETTLER_ROLE(), await platform.getAddress());
    await manager.setPlatform(await platform.getAddress());
    await manager.setRiskParams(MIN_COVERAGE_BPS, HUGE_CAP, HUGE_CAP);

    // Correlation groups are configured BEFORE any liability exists for a pair.
    await manager.setPairCorrGroup(PAIR_A, GRP_FX);
    await manager.setPairCorrGroup(PAIR_B, GRP_FX);
    await manager.setPairCorrGroup(PAIR_C, GRP_METAL);

    await platform.setTreasury(treasury.address);
    await platform.setKeeper(keeper.address, true);

    await usdc.mint(admin.address, CAPITAL, "phase4 vault seed");
    await usdc
      .connect(admin)
      .approve(await vault.getAddress(), ethers.MaxUint256);
    // The one-time governance seed is recorded like any other Vault movement, so
    // EQ-5's opening balance is event-derived rather than assumed. It is the only
    // credit in the whole book that is not the result of a settlement action.
    await exec(vault.seedCapital(SETTLEMENT, RESERVE, OPS));

    for (const who of [trader, trader2, liquidator]) {
      await usdc.mint(who.address, u(50000), "phase4 trader seed");
      await usdc
        .connect(who)
        .approve(await platform.getAddress(), ethers.MaxUint256);
    }

    for (const pair of USED_PAIRS) {
      await oracle.setPrice(pair, ENTRY);
    }
  });

  // ———————————————————— fixtures & helpers ————————————————————

  const netMarginFor = (margin) => margin - (margin * OPEN_FEE_BPS) / 10000n;
  const maxProfitLiabFor = (netMargin) =>
    (netMargin * MAX_PROFIT_BPS) / 10000n;

  /// Signed PnL of a position for a given exit price (same formula as V3).
  function pnlFor(notional, entryPrice, exitPrice, isLong) {
    const diff = isLong
      ? BigInt(exitPrice) - BigInt(entryPrice)
      : BigInt(entryPrice) - BigInt(exitPrice);
    return (diff * BigInt(notional)) / BigInt(entryPrice);
  }

  function resetFlows() {
    flows = {
      seeded: 0n,
      settledGross: 0n,
      surplusIn: 0n,
      ledgerTransfers: 0,
      receipts: [],
    };
    feeTotals = { open: 0n, close: 0n, liquidation: 0n };
  }

  /**
   * Rebuilds the EQ-5 roll-forward terms from the raw logs of one receipt:
   * Vault events give settlement-ledger movements, V3 events give the treasury
   * fee credits (which never sit inside the Vault: settled fees leave it
   * immediately, open/liquidation fees never enter it at all).
   */
  function record(receipt) {
    flows.receipts.push(receipt);
    for (const log of receipt.logs) {
      let vaultEvent = null;
      try {
        vaultEvent = vault.interface.parseLog(log);
      } catch (_) {
        /* not a Vault event */
      }
      if (vaultEvent) {
        if (vaultEvent.name === "CapitalSeeded") {
          flows.seeded += vaultEvent.args[1];
        } else if (vaultEvent.name === "ProfitSettled") {
          flows.settledGross += vaultEvent.args[2] + vaultEvent.args[3];
        } else if (vaultEvent.name === "SurplusRetained") {
          flows.surplusIn += vaultEvent.args[1];
        } else if (
          vaultEvent.name === "LedgerTransfer" ||
          vaultEvent.name === "EmergencyLedgerTransfer"
        ) {
          flows.ledgerTransfers += 1;
        }
      }

      let platformEvent = null;
      try {
        platformEvent = platform.interface.parseLog(log);
      } catch (_) {
        /* not a V3 event */
      }
      if (platformEvent && platformEvent.name === "ProtocolFeeCollected") {
        feeTotals[platformEvent.args[3]] += platformEvent.args[2];
      }
    }
    return receipt;
  }

  /// Sends a state-changing transaction, records its events, returns the receipt.
  async function exec(txPromise) {
    return record(await (await txPromise).wait());
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

  /// All decoded events named `name` from a receipt, for a given contract.
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

  async function open(signer, opts = {}) {
    return positionIdFrom(await exec(openTx(signer, opts)));
  }

  const close = (signer, id) => exec(platform.connect(signer).closePosition(id));
  const liquidate = (signer, id) => exec(platform.connect(signer).liquidate(id));
  const trigger = (signer, id) =>
    exec(platform.connect(signer).closeWithTrigger(id));

  /**
   * Rebuilds Σ M_i and its per-pair / per-group decompositions by walking every
   * position V3 has ever created and keeping the OPEN ones only. M_i is taken
   * from the stored position (the value the invariant must be built from), with
   * a cross-check against the closed form netMargin * maxProfitBps / 10000.
   */
  async function reconstructLiability() {
    const nextId = await platform.nextPositionId();
    const pairLiab = new Map();
    const groupLiab = new Map();
    const ids = [];
    let total = 0n;
    for (let id = 1n; id < nextId; id++) {
      const p = await platform.getPosition(id);
      if (!p.isOpen) continue;
      ids.push(id);
      total += p.maxProfitLiab;
      if (p.maxProfitLiab !== maxProfitLiabFor(p.margin)) {
        throw new Error(`position ${id} M_i does not match closed form`);
      }
      pairLiab.set(p.pairId, (pairLiab.get(p.pairId) ?? 0n) + p.maxProfitLiab);
      const group = await manager.pairCorrGroup(p.pairId);
      if (group !== ZERO_GROUP) {
        groupLiab.set(group, (groupLiab.get(group) ?? 0n) + p.maxProfitLiab);
      }
    }
    return { ids, total, pairLiab, groupLiab };
  }

  /**
   * EQ-1 .. EQ-5 plus external-coverage-zero, re-checked after every transition.
   * `opts.ledgerTransfers` states how many governance/emergency ledger transfers
   * are expected to have been recorded so far (0 for pure settlement activity).
   * `opts.coverageEnforced` may be set to false ONLY while a governance increase
   * of minimumCoverageBps is in flight: that can put an existing book below the
   * new floor without any accounting break (the solvency test documents this).
   */
  async function expectConservation(opts = {}) {
    const expectedLedgerTransfers = opts.ledgerTransfers ?? 0;
    const coverageEnforced = opts.coverageEnforced ?? true;

    // EQ-1 — physical supply partition.
    let walletTotal = 0n;
    for (const w of wallets) walletTotal += await usdc.balanceOf(w.address);
    const vaultBal = await usdc.balanceOf(await vault.getAddress());
    const platformBal = await usdc.balanceOf(await platform.getAddress());
    expect(
      vaultBal + platformBal + walletTotal,
      "EQ-1 supply partition"
    ).to.equal(await usdc.totalSupply());

    // EQ-2 — vault ledger partition.
    expect(await vault.checkPhysicalInvariant(), "EQ-2 physical").to.equal(true);
    expect(vaultBal, "EQ-2 vault balance").to.equal(
      await vault.accountedTotal()
    );
    expect(vaultBal).to.equal(
      (await vault.settlementLedger()) +
        (await vault.reserveLedger()) +
        (await vault.opsLedger())
    );

    // EQ-3 — liability reconstruction vs RiskManager (global/pair/group).
    const { ids, total, pairLiab, groupLiab } = await reconstructLiability();
    expect(await manager.currentMaxProtoLiab(), "EQ-3 Σ M_i").to.equal(total);
    for (const pair of USED_PAIRS) {
      expect(
        await manager.pairMaxProfitLiab(pair),
        `EQ-3 pair ledger ${pair}`
      ).to.equal(pairLiab.get(pair) ?? 0n);
    }
    for (const group of USED_GROUPS) {
      expect(
        await manager.corrGroupLiab(group),
        `EQ-3 corr-group ledger ${group}`
      ).to.equal(groupLiab.get(group) ?? 0n);
    }

    // EQ-4a — admission/governance solvency (Cmin, point-in-time) using the LIVE
    // governance ratio (not the fixture constant). EQ-4b (100pc residual) is
    // enforced inside the settlement tests themselves: every profitable close
    // leaves S >= L at the floor.
    const s = await vault.settlementLedger();
    const l0 = await manager.currentMaxProtoLiab();
    const cmin = await manager.minimumCoverageBps();
    if (coverageEnforced) {
      expect(s * 10000n >= cmin * l0, "EQ-4 solvency").to.equal(true);
    }
    expect(await manager.coverageMaxBps()).to.equal(
      l0 === 0n ? ethers.MaxUint256 : (s * 10000n) / l0
    );

    // EQ-5 — closed settlement book, with zero other permitted credits.
    expect(s, "EQ-5 settlement roll-forward").to.equal(
      flows.seeded + flows.surplusIn - flows.settledGross
    );
    expect(await vault.settlementSeeded()).to.equal(flows.seeded);
    expect(await vault.settlementSurplusRetained()).to.equal(flows.surplusIn);
    expect(
      flows.ledgerTransfers,
      "governance/emergency ledger transfers recorded"
    ).to.equal(expectedLedgerTransfers);


    // External coverage is exactly 0 and cannot be anything else.
    expect(await manager.hedgeManager()).to.equal(ethers.ZeroAddress);
    expect(await vault.hedgeCommitted()).to.equal(0n);
    expect(await manager.maxPermittedLiability()).to.equal(
      (s * 10000n) / cmin
    );
    expect(await manager.vault()).to.equal(await vault.getAddress());
    expect(await vault.riskManager()).to.equal(await manager.getAddress());
    expect(await manager.platform()).to.equal(await platform.getAddress());
    return { ids, total, s, vaultBal, platformBal };
  }

  /**
   * The audited mixed sequence — identical economics to the Phase-3 mixed test:
   * six opens (two correlation groups, two traders) -> profitable direct close ->
   * liquidation -> losing direct close -> keeper stop-loss close. Leaves
   * positions 5 and 6 open, and records every receipt into `flows.receipts`.
   */
  async function runMixedScenario() {
    const id1 = await open(trader, { pairId: PAIR_A, margin: u(1000), leverage: 10n });
    const id2 = await open(trader2, { pairId: PAIR_A, isLong: false, margin: u(1500), leverage: 5n });
    const id3 = await open(trader, { pairId: PAIR_B, margin: u(1200), leverage: 8n });
    const id4 = await open(trader2, { pairId: PAIR_B, isLong: false, margin: u(800), leverage: 12n, sl: px(1010) });
    const id5 = await open(trader, { pairId: PAIR_A, margin: u(2000), leverage: 20n });
    const id6 = await open(trader, { pairId: PAIR_C, margin: u(900), leverage: 15n });
    await expectConservation();

    await oracle.setPrice(PAIR_A, px(1005)); // id1 in profit
    await close(trader, id1);
    await expectConservation();

    await oracle.setPrice(PAIR_A, px(1025)); // past id2's px(1020) short liquidation price
    await liquidate(liquidator, id2);
    await expectConservation();

    await oracle.setPrice(PAIR_B, px(995)); // id3 in loss
    await close(trader, id3);
    await expectConservation();

    await oracle.setPrice(PAIR_B, px(1013)); // breaches id4's px(1010) stop
    await trigger(keeper, id4);
    await expectConservation();

    return { id1, id2, id3, id4, id5, id6 };
  }

  // ————————————————————————————— tests —————————————————————————————

  it("EQ-0 baseline: a pristine deployment already satisfies all five equations", async function () {
    const { ids, total, s, platformBal } = await expectConservation();
    expect(ids).to.deep.equal([]);
    expect(total).to.equal(0n);
    expect(s).to.equal(SETTLEMENT);
    expect(platformBal).to.equal(0n);
    expect(await vault.reserveLedger()).to.equal(RESERVE);
    expect(await vault.opsLedger()).to.equal(OPS);
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    // Zero liability => vacuously fully covered, GREEN.
    expect(await manager.coverageMaxBps()).to.equal(ethers.MaxUint256);
    expect(await manager.status()).to.equal(0);
    // 70,000 * 10,000 / 15,000 = 46,666.67 (floored, 6dp).
    expect(await manager.maxPermittedLiability()).to.equal(46_666_666_666n);
    expect(await vault.settlementSurplusRetained()).to.equal(0n);
  });

  it("full conservation through the audited mixed lifecycle (EQ-1..EQ-5 after every transition)", async function () {
    const ids = await runMixedScenario();
    const { ids: openIds, total } = await expectConservation();

    // Exactly the two untouched positions remain.
    expect(openIds).to.deep.equal([ids.id5, ids.id6]);
    expect(total).to.equal(8_693_040_000n); // M(id5) 5,995,200,000 + M(id6) 2,697,840,000
    expect(await manager.pairMaxProfitLiab(PAIR_A)).to.equal(5_995_200_000n);
    expect(await manager.pairMaxProfitLiab(PAIR_B)).to.equal(0n);
    expect(await manager.pairMaxProfitLiab(PAIR_C)).to.equal(2_697_840_000n);
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(5_995_200_000n);
    expect(await manager.corrGroupLiab(GRP_METAL)).to.equal(2_697_840_000n);
    expect(await manager.coverageMaxBps()).to.equal(
      (70_093_924_800n * 10000n) / 8_693_040_000n
    );

    // Solvency headroom is real, not vacuous: L0 > 0 and S < admitted capacity.
    const s = await vault.settlementLedger();
    expect(await manager.maxPermittedLiability()).to.equal(
      (s * 10000n) / MIN_COVERAGE_BPS
    );
    expect(await manager.maxPermittedLiability()).to.be.greaterThan(total);

    // V3 custodies exactly the open positions' net margins — user margin never
    // entered the Vault (custody separation).
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(
      1_998_400_000n + 899_280_000n
    );
    expect(await vault.reserveLedger()).to.equal(RESERVE);
    expect(await vault.opsLedger()).to.equal(OPS);
  });

  it("EQ-5 itemised: every settlement-ledger movement is auditable by position, transaction, amount, reason and direction", async function () {
    const { id1, id2, id3, id4 } = await runMixedScenario();

    // The COMPLETE settlement-ledger table for the scenario. `direction` is the
    // only permitted classification of a settlement-ledger movement, and the
    // only credit class is a realized-loss surplus credit (no "other credits").
    const settlementTable = [
      {
        positionId: 0n,
        transaction: "seedCapital (setup)",
        amount: SETTLEMENT,
        direction: "seed",
        reason: "initial protocol settlement capital, one-time governance seed",
      },
      {
        positionId: id1,
        transaction: "closePosition (win, PAIR_A @ 1005)",
        amount: 49_960_000n,
        direction: "settlement outflow",
        reason:
          "gross profit debit = traderProfit 49,920,032 + closeFee 39,968 (Option B: fee leaves the Vault immediately)",
      },
      {
        positionId: id2,
        transaction: "liquidate (short, PAIR_A @ 1025)",
        amount: 0n,
        direction: "neither",
        reason:
          "liquidation penalty is split inside V3 custody (reward 449,640,000 + protocol 1,049,160,000); settlement capital untouched",
      },
      {
        positionId: id3,
        transaction: "closePosition (loss, PAIR_B @ 995)",
        amount: 47_961_600n,
        direction: "surplus credit",
        reason:
          "retained realized loss surplus (margin 1,199,040,000 − refund 1,151,078,400) pulled from V3 custody",
      },
      {
        positionId: id4,
        transaction: "closeWithTrigger (SL fill @ 1010, PAIR_B short)",
        amount: 95_923_200n,
        direction: "surplus credit",
        reason:
          "retained realized loss surplus (margin 799,360,000 − refund 703,436,800) pulled from V3 custody",
      },
    ];

    const sumOf = (direction) =>
      settlementTable
        .filter((e) => e.direction === direction)
        .reduce((acc, e) => acc + e.amount, 0n);
    const seed = sumOf("seed");
    const outflows = sumOf("settlement outflow");
    const credits = sumOf("surplus credit");
    const otherCredits = sumOf("other credit");

    // (a) The table is COMPLETE: its terms equal the event-derived totals.
    expect(seed).to.equal(flows.seeded);
    expect(outflows).to.equal(flows.settledGross);
    expect(credits).to.equal(flows.surplusIn);
    expect(outflows).to.equal(49_960_000n);
    expect(credits).to.equal(47_961_600n + 95_923_200n); // 143,884,800

    // (b) No other Vault event type fired anywhere in the scenario, so the
    //     "other explicitly permitted settlement-ledger credits" term is EMPTY
    //     (enumerated, not assumed).
    const observed = new Set();
    for (const receipt of flows.receipts) {
      for (const log of receipt.logs) {
        let parsed = null;
        try {
          parsed = vault.interface.parseLog(log);
        } catch (_) {
          /* not a Vault event */
        }
        if (parsed) observed.add(parsed.name);
      }
    }
    expect([...observed].sort()).to.deep.equal([
      "CapitalSeeded",
      "ProfitSettled",
      "SurplusRetained",
    ]);
    expect(flows.ledgerTransfers).to.equal(0);

    // (c) THE CONSERVATION EQUATION, term by term.
    //     final S == initial S − legitimate outflows + surplus credits + 0
    const finalS = seed - outflows + credits + otherCredits;
    expect(await vault.settlementLedger()).to.equal(finalS);
    expect(finalS).to.equal(SETTLEMENT - 49_960_000n + 47_961_600n + 95_923_200n);
    expect(finalS).to.equal(70_093_924_800n);

    // (d) Vault-side counters reflect exactly the same table, tied back to the
    //     per-position loss split (margin − refund = retained) of id3 and id4.
    const retainedFor = (margin, refund) => margin - refund;
    const p3 = await platform.getPosition(id3);
    const p4 = await platform.getPosition(id4);
    expect(await vault.settlementSeeded()).to.equal(seed);
    expect(await vault.settlementSurplusRetained()).to.equal(credits);
    expect(await vault.settlementSurplusRetained()).to.equal(
      retainedFor(p3.margin, 1_151_078_400n) + retainedFor(p4.margin, 703_436_800n)
    );

    // (e) Fee-side table: fees are never a settlement-ledger movement except the
    //     close fee, which is already inside the gross outflow above.
    const feeTable = [
      { feeType: "open", positions: "1..6", amount: 5_920_000n, source: "V3 custody (user margin)" },
      { feeType: "close", positions: "1", amount: 39_968n, source: "Vault (part of the 49,960,000 gross debit)" },
      { feeType: "liquidation", positions: "2", amount: 1_049_160_000n, source: "V3 custody (penalty split)" },
    ];
    for (const row of feeTable) {
      expect(feeTotals[row.feeType], `feeType ${row.feeType}`).to.equal(row.amount);
    }
    expect(await usdc.balanceOf(treasury.address)).to.equal(
      feeTable.reduce((acc, row) => acc + row.amount, 0n) // 1,055,119,968
    );
  });

  it("PROOF: reserve and ops are excluded from the coverage numerator and untouched by ordinary settlement", async function () {
    await runMixedScenario();

    const SETTLEMENT_LEDGER = await vault.LEDGER_SETTLEMENT();
    const RESERVE_LEDGER = await vault.LEDGER_RESERVE();
    const OPS_LEDGER = await vault.LEDGER_OPS();
    const TREASURY_LEDGER = await vault.LEDGER_TREASURY();

    // (a) Ordinary settlement never moved reserve or ops.
    expect(await vault.reserveLedger()).to.equal(RESERVE);
    expect(await vault.opsLedger()).to.equal(OPS);

    // (b) The coverage numerator is the settlement ledger ALONE, even though the
    //     Vault physically holds settlement + reserve + ops.
    const s = await vault.settlementLedger();
    const physical = await usdc.balanceOf(await vault.getAddress());
    expect(physical).to.equal(s + RESERVE + OPS);
    expect(physical).to.be.greaterThan(s);
    expect(await manager.maxPermittedLiability()).to.equal(
      (s * 10000n) / MIN_COVERAGE_BPS
    );

    // (c) Governance reserve -> ops movement cannot change admitted capacity.
    //     It is recorded (so the transfer count stays auditable) but it is NOT a
    //     settlement-book movement: the settlement ledger is untouched.
    const capacityBefore = await manager.maxPermittedLiability();
    await exec(
      vault
        .connect(admin)
        .transferLedger(RESERVE_LEDGER, OPS_LEDGER, u(1000), "phase4: reserve->ops proof")
    );
    expect(await vault.reserveLedger()).to.equal(RESERVE - u(1000));
    expect(await vault.opsLedger()).to.equal(OPS + u(1000));
    expect(await manager.maxPermittedLiability()).to.equal(capacityBefore);
    expect(await vault.settlementLedger()).to.equal(s);
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(physical);
    await expectConservation({ ledgerTransfers: 1 });

    // (d) Settlement-ledger outflows always keep the approved inequality, and the
    //     guard CANNOT be satisfied by the reserve/ops still sitting in the Vault:
    //     exactly down to the policy floor is allowed, one wei less is not.
    const l0 = await manager.currentMaxProtoLiab();
    const required = (MIN_COVERAGE_BPS * l0) / 10000n; // exact: 13,039,560,000
    expect(required).to.equal(13_039_560_000n);
    const maxOut = s - required;
    await expect(
      vault
        .connect(admin)
        .transferLedger(SETTLEMENT_LEDGER, TREASURY_LEDGER, maxOut + 1n, "one wei over the guard")
    ).to.be.revertedWithCustomError(vault, "CoverageBreach");

    await vault
      .connect(admin)
      .transferLedger(SETTLEMENT_LEDGER, TREASURY_LEDGER, maxOut, "exactly to the policy floor");
    expect(await vault.settlementLedger()).to.equal(required);
    expect(await manager.coverageMaxBps()).to.equal(MIN_COVERAGE_BPS);
    // Zero headroom left: admitted capacity has fallen to exactly the live
    // liability, even though reserve+ops are still sitting in the Vault.
    expect(await manager.maxPermittedLiability()).to.equal(l0);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(
      required + (RESERVE - u(1000)) + (OPS + u(1000))
    );
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
    await expect(
      vault
        .connect(admin)
        .transferLedger(SETTLEMENT_LEDGER, TREASURY_LEDGER, 1n, "no capacity left")
    ).to.be.revertedWithCustomError(vault, "CoverageBreach");
    // Liability and V3 state were never touched by any of this.
    const { total } = await reconstructLiability();
    expect(await manager.currentMaxProtoLiab()).to.equal(total);
  });

  it("PROOF: no dollar is double counted — a margin split has exactly two homes and a close can never repeat", async function () {
    const id = await open(trader, { pairId: PAIR_B, margin: u(1200), leverage: 8n });
    const p = await platform.getPosition(id);
    expect(p.margin).to.equal(1_199_040_000n);
    expect(p.maxProfitLiab).to.equal(3_597_120_000n);

    const before = {
      trader: await usdc.balanceOf(trader.address),
      platform: await usdc.balanceOf(await platform.getAddress()),
      vault: await vault.settlementLedger(),
      surplus: await vault.settlementSurplusRetained(),
      supply: await usdc.totalSupply(),
      l0: await manager.currentMaxProtoLiab(),
    };
    expect(before.platform).to.equal(p.margin); // this is the only open position
    expect(before.l0).to.equal(p.maxProfitLiab);

    await oracle.setPrice(PAIR_B, px(995)); // realized loss 47,961,600
    const receipt = await close(trader, id);
    const loss = 47_961_600n;
    const refund = p.margin - loss; // 1,151,078,400

    // (a) The realized loss has exactly two homes and they sum to the margin.
    const after = {
      trader: await usdc.balanceOf(trader.address),
      platform: await usdc.balanceOf(await platform.getAddress()),
      vault: await vault.settlementLedger(),
      surplus: await vault.settlementSurplusRetained(),
    };
    expect(before.platform - after.platform).to.equal(p.margin);
    expect(after.trader - before.trader).to.equal(refund);
    expect(after.vault - before.vault).to.equal(loss);
    expect(refund + loss).to.equal(p.margin);

    // (b) No mint and no burn: the same dollars moved once.
    expect(await usdc.totalSupply()).to.equal(before.supply);

    // (c) Exactly one surplus credit was recorded for this close.
    expect(after.surplus).to.equal(before.surplus + loss);
    const surplusEvents = eventsOf(receipt, vault, "SurplusRetained");
    expect(surplusEvents.length).to.equal(1);
    expect(surplusEvents[0].args[1]).to.equal(loss);

    // (d) The liability was released exactly once, in the same transaction.
    expect(await manager.currentMaxProtoLiab()).to.equal(
      before.l0 - p.maxProfitLiab
    );

    // (e) Replay is impossible and moves nothing at all.
    await expect(close(trader, id)).to.be.revertedWithCustomError(
      platform,
      "PositionClosedAlready"
    );
    expect(await usdc.balanceOf(trader.address)).to.equal(after.trader);
    expect(await usdc.balanceOf(await platform.getAddress())).to.equal(
      after.platform
    );
    expect(await vault.settlementLedger()).to.equal(after.vault);
    expect(await vault.settlementSurplusRetained()).to.equal(after.surplus);
    expect(await manager.currentMaxProtoLiab()).to.equal(
      before.l0 - p.maxProfitLiab
    );

    // (f) No third party can mint a second credit or debit for this position;
    //     even DEFAULT_ADMIN_ROLE does not hold SETTLER_ROLE.
    for (const who of [stranger, admin]) {
      await expect(
        vault.connect(who).retainSurplus(loss, id)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
      await expect(
        vault.connect(who).settleProfit(trader.address, treasury.address, 1n, 0n, id)
      ).to.be.revertedWithCustomError(vault, "AccessControlUnauthorizedAccount");
    }

    await expectConservation();
  });

  it("settlement solvency (Option C): absolute check first, then the residual floor F", async function () {
    // Two identical positions => L0 = 2 * M_i, S = 70,000 seed.
    const idA = await open(trader, { pairId: PAIR_A, margin: MARGIN, leverage: LEVERAGE });
    const idB = await open(trader, { pairId: PAIR_A, margin: MARGIN, leverage: LEVERAGE });
    const S = await vault.settlementLedger();
    const L0 = await manager.currentMaxProtoLiab();
    expect(L0).to.equal(2n * M_I);

    // (a) closingM > L0 is rejected outright (liability underflow protection).
    expect(await manager.authorizeSettle(L0 + 1n, 0n)).to.equal(false);
    expect(await manager.authorizeSettle(L0, 0n)).to.equal(true);

    // (b) ABSOLUTE check first: with L' = 0 coverage is trivially satisfied, so
    //     the single wei of extra gross is what flips the decision.
    expect(await manager.authorizeSettle(L0, S)).to.equal(true);
    expect(await manager.authorizeSettle(L0, S + 1n)).to.equal(false);

    // (c) Floor boundary: L' = M_i needs S' >= F * M_i / 10000 = 1.0 * M_i at F=10000.
    const FLOOR = await manager.settlementFloorBps();
    expect(FLOOR).to.equal(10000n);
    const required = (FLOOR * M_I) / 10000n;
    expect(required).to.equal(M_I);
    expect(await manager.authorizeSettle(M_I, S - required)).to.equal(true);
    expect(await manager.authorizeSettle(M_I, S - required + 1n)).to.equal(false);
    expect(await manager.authorizeSettle(M_I, S)).to.equal(false); // absolute passes, floor denies

    // (d) Contract == specification over a grid of boundary inputs.
    const mirror = (closingM, pnlGross) => {
      if (closingM > L0) return false;
      if (pnlGross > S) return false;
      return (S - pnlGross) * 10000n >= FLOOR * (L0 - closingM);
    };
    const closingGrid = [0n, 1n, M_I - 1n, M_I, M_I + 1n, L0 - 1n, L0, L0 + 1n];
    const grossGrid = [0n, 1n, required - 1n, required, required + 1n, S - 1n, S, S + 1n];
    for (const closingM of closingGrid) {
      for (const gross of grossGrid) {
        expect(
          await manager.authorizeSettle(closingM, gross),
          `authorizeSettle(${closingM}, ${gross})`
        ).to.equal(mirror(closingM, gross));
      }
    }

    // (e) Option C regression: raising Cmin to 300% can no longer lock a solvent
    //     book. The win leg succeeds (residual floor 100% holds); admission stays
    //     blocked at the raised ratio until governance restores it.
    const many = [];
    for (let i = 0; i < 11; i++) {
      many.push(
        await open(trader, { pairId: PAIR_A, margin: MARGIN, leverage: LEVERAGE })
      );
    }
    await manager.setRiskParams(30000n, HUGE_CAP, HUGE_CAP);
    // Admission is blocked at the raised ratio (policy), but the book is solvent.
    expect(await manager.authorizeOpen(PAIR_A, 1n, 0)).to.equal(false);
    const sBefore = await vault.settlementLedger();
    const l0Before = await manager.currentMaxProtoLiab();
    await oracle.setPrice(PAIR_A, px(1001)); // tiny profit: 9,992,000
    await close(trader, idA);
    expect((await platform.getPosition(idA)).isOpen).to.equal(false);
    expect(await manager.currentMaxProtoLiab()).to.equal(l0Before - M_I);
    // Option B: the ledger is debited the FULL gross profit. The close fee is
    // carved out of that same profit leg and pushed straight to the external
    // treasury, so nothing is credited back into the settlement ledger.
    expect(await vault.settlementLedger()).to.equal(sBefore - 9_992_000n);
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
    // N-1 inductive check: residual book still covers itself at 100%.
    {
      const sAfter = await vault.settlementLedger();
      const lAfter = await manager.currentMaxProtoLiab();
      expect(sAfter >= lAfter, "N-1: S' >= L' after allowed settlement").to.equal(true);
    }
    // The same-position-at-a-loss path is unchanged (losses only add capital).
    await oracle.setPrice(PAIR_A, px(999));
    // idA is already closed; close the second fixture position at a loss instead.
    await close(trader, idB);
    expect((await platform.getPosition(idB)).isOpen).to.equal(false);
    await expectConservation({ coverageEnforced: false });
    // Restore the policy ratio: remaining wins settle and the book is healthy.
    await manager.setRiskParams(MIN_COVERAGE_BPS, HUGE_CAP, HUGE_CAP);
    await oracle.setPrice(PAIR_A, px(1001));
    await close(trader, many[0]);
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
    expect((await platform.getPosition(many[0])).isOpen).to.equal(false);
    expect(many.length).to.equal(11);
    await expectConservation();
  });

  it("PROOF: no Vault debit without its liability transition — both close legs revert as one unit", async function () {
    const SETTLER = await vault.SETTLER_ROLE();
    const platformAddress = await platform.getAddress();

    // (a) WIN leg: without SETTLER_ROLE settleProfit is impossible, so the whole
    //     close reverts and nothing at all has moved (no half-updated books).
    const winId = await open(trader, { pairId: PAIR_A, margin: MARGIN, leverage: LEVERAGE });
    await oracle.setPrice(PAIR_A, px(1005));
    const winBefore = {
      l0: await manager.currentMaxProtoLiab(),
      pairLiab: await manager.pairMaxProfitLiab(PAIR_A),
      groupLiab: await manager.corrGroupLiab(GRP_FX),
      s: await vault.settlementLedger(),
      platform: await usdc.balanceOf(platformAddress),
      trader: await usdc.balanceOf(trader.address),
      vault: await usdc.balanceOf(await vault.getAddress()),
    };

    await vault.revokeRole(SETTLER, platformAddress);
    await expect(close(trader, winId)).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );

    expect((await platform.getPosition(winId)).isOpen).to.equal(true);
    expect(await manager.currentMaxProtoLiab()).to.equal(winBefore.l0);
    expect(await manager.pairMaxProfitLiab(PAIR_A)).to.equal(winBefore.pairLiab);
    expect(await manager.corrGroupLiab(GRP_FX)).to.equal(winBefore.groupLiab);
    expect(await vault.settlementLedger()).to.equal(winBefore.s);
    expect(await usdc.balanceOf(platformAddress)).to.equal(winBefore.platform);
    expect(await usdc.balanceOf(trader.address)).to.equal(winBefore.trader);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(winBefore.vault);
    await expectConservation();

    // Restoring the role completes the very same close: the liability was not
    // stranded, and it is released exactly once.
    await vault.grantRole(SETTLER, platformAddress);
    await close(trader, winId);
    expect((await platform.getPosition(winId)).isOpen).to.equal(false);
    expect(await manager.currentMaxProtoLiab()).to.equal(winBefore.l0 - M_I);
    expect(await vault.settlementLedger()).to.equal(winBefore.s - 49_960_000n);
    await expectConservation();

    // (b) LOSS leg: the same revocation blocks retainSurplus, so the trader refund
    //     cannot leave V3 and no surplus can be credited while the liability
    //     release is rolled back with it.
    const lossId = await open(trader, { pairId: PAIR_B, margin: u(1200), leverage: 8n });
    const lossP = await platform.getPosition(lossId);
    await oracle.setPrice(PAIR_B, px(995));
    const lossBefore = {
      l0: await manager.currentMaxProtoLiab(),
      s: await vault.settlementLedger(),
      platform: await usdc.balanceOf(platformAddress),
      trader: await usdc.balanceOf(trader.address),
    };

    await vault.revokeRole(SETTLER, platformAddress);
    await expect(close(trader, lossId)).to.be.revertedWithCustomError(
      vault,
      "AccessControlUnauthorizedAccount"
    );
    expect((await platform.getPosition(lossId)).isOpen).to.equal(true);
    expect(await manager.currentMaxProtoLiab()).to.equal(lossBefore.l0);
    expect(await vault.settlementLedger()).to.equal(lossBefore.s);
    expect(await usdc.balanceOf(platformAddress)).to.equal(lossBefore.platform);
    expect(await usdc.balanceOf(trader.address)).to.equal(lossBefore.trader);

    await vault.grantRole(SETTLER, platformAddress);
    await close(trader, lossId);
    expect(await manager.currentMaxProtoLiab()).to.equal(
      lossBefore.l0 - lossP.maxProfitLiab
    );
    expect(await vault.settlementLedger()).to.equal(lossBefore.s + 47_961_600n);
    await expectConservation();
  });

  it("every V3 close path removes the exact liability once, moves money in the same transaction, and cannot repeat", async function () {
    const scenarios = [
      {
        name: "closePosition (win)",
        open: { pairId: PAIR_A, isLong: true, margin: u(1000), leverage: 10n },
        price: px(1005),
        run: (id) => close(trader, id),
        settlementDelta: -49_960_000n,
      },
      {
        name: "closePosition (loss)",
        open: { pairId: PAIR_B, isLong: true, margin: u(1200), leverage: 8n },
        price: px(995),
        run: (id) => close(trader, id),
        settlementDelta: 47_961_600n,
      },
      {
        name: "closeWithTrigger (take profit fill)",
        open: { pairId: PAIR_C, isLong: true, margin: u(900), leverage: 15n, tp: px(1010) },
        price: px(1015),
        run: (id) => trigger(keeper, id),
        settlementDelta: -134_892_000n,
      },
      {
        name: "closeWithTrigger (stop loss fill)",
        open: { pairId: PAIR_A, isLong: false, margin: u(800), leverage: 12n, sl: px(1010) },
        price: px(1013),
        run: (id) => trigger(keeper, id),
        settlementDelta: 95_923_200n,
      },
      {
        name: "liquidate",
        open: { pairId: PAIR_B, isLong: false, margin: u(1500), leverage: 5n },
        price: px(1025),
        run: (id) => liquidate(liquidator, id),
        settlementDelta: 0n,
      },
    ];

    for (const scenario of scenarios) {
      // Deterministic entry: previous scenarios move the price of their pair, so
      // reset it before opening (every expected delta below assumes ENTRY).
      await oracle.setPrice(scenario.open.pairId, ENTRY);
      const id = await open(trader, scenario.open);
      const p = await platform.getPosition(id);
      const group = await manager.pairCorrGroup(p.pairId);
      const before = {
        l0: await manager.currentMaxProtoLiab(),
        pair: await manager.pairMaxProfitLiab(p.pairId),
        group: group === ZERO_GROUP ? 0n : await manager.corrGroupLiab(group),
        s: await vault.settlementLedger(),
        supply: await usdc.totalSupply(),
      };

      await oracle.setPrice(p.pairId, scenario.price);
      await scenario.run(id);

      expect((await platform.getPosition(id)).isOpen, scenario.name).to.equal(
        false
      );
      expect(await manager.currentMaxProtoLiab(), `${scenario.name}: Σ M_i`).to.equal(
        before.l0 - p.maxProfitLiab
      );
      expect(
        await manager.pairMaxProfitLiab(p.pairId),
        `${scenario.name}: pair ledger`
      ).to.equal(before.pair - p.maxProfitLiab);
      if (group !== ZERO_GROUP) {
        expect(
          await manager.corrGroupLiab(group),
          `${scenario.name}: corr-group ledger`
        ).to.equal(before.group - p.maxProfitLiab);
      }
      expect(
        (await vault.settlementLedger()) - before.s,
        `${scenario.name}: settlement-ledger delta`
      ).to.equal(scenario.settlementDelta);
      expect(await usdc.totalSupply(), `${scenario.name}: no mint/burn`).to.equal(
        before.supply
      );

      // Replay through the same entry point: refused, and nothing moves again.
      await expect(scenario.run(id)).to.be.revertedWithCustomError(
        platform,
        "PositionClosedAlready"
      );
      expect(await manager.currentMaxProtoLiab()).to.equal(
        before.l0 - p.maxProfitLiab
      );
      expect(await manager.pairMaxProfitLiab(p.pairId)).to.equal(
        before.pair - p.maxProfitLiab
      );
      expect(await vault.settlementLedger()).to.equal(
        before.s + scenario.settlementDelta
      );
      await expectConservation();
    }
  });

  it("RiskManager <-> V3 consistency: liability is platform-only, drift is detectable, and only the matching release repairs it", async function () {
    const id = await open(trader, { pairId: PAIR_A, margin: MARGIN, leverage: LEVERAGE });
    const p = await platform.getPosition(id);

    // Wiring is one-to-one and cross-checked from both sides.
    expect(await manager.platform()).to.equal(await platform.getAddress());
    expect(await manager.vault()).to.equal(await vault.getAddress());
    expect(await vault.riskManager()).to.equal(await manager.getAddress());
    expect(await platform.riskManager()).to.equal(await manager.getAddress());
    expect(await platform.settlementVault()).to.equal(await vault.getAddress());

    // Only the platform may touch the liability ledgers (owner/admin cannot).
    for (const who of [stranger, admin]) {
      await expect(
        manager.connect(who).registerOpen(PAIR_C, u(1))
      ).to.be.revertedWithCustomError(manager, "PlatformOnly");
      await expect(
        manager.connect(who).registerClose(PAIR_C, u(1))
      ).to.be.revertedWithCustomError(manager, "PlatformOnly");
    }

    // A pair with live liability may not be re-grouped: that would desynchronise
    // corrGroupLiab from the positions themselves.
    await expect(
      manager.connect(admin).setPairCorrGroup(PAIR_A, GRP_METAL)
    ).to.be.revertedWithCustomError(manager, "LiabilityRegistered");

    // Deliberate mis-wiring: an out-of-band registration is DETECTABLE (EQ-3)...
    await manager.connect(admin).setPlatform(admin.address);
    await manager.connect(admin).registerOpen(PAIR_C, u(123));
    let detected = false;
    try {
      await expectConservation();
    } catch (_) {
      detected = true;
    }
    expect(detected, "Σ M_i drift must be detected").to.equal(true);

    // ...and only the matching release repairs it (over-release is refused).
    await expect(
      manager.connect(admin).registerClose(PAIR_C, u(123) + 1n)
    ).to.be.revertedWithCustomError(manager, "LiabilityUnderflow");
    await manager.connect(admin).registerClose(PAIR_C, u(123));
    await manager.connect(admin).setPlatform(await platform.getAddress());

    expect(await manager.currentMaxProtoLiab()).to.equal(p.maxProfitLiab);
    await expectConservation();
  });

  it("fuzz/property: 40 randomized transitions keep EQ-1..EQ-5 and keep the admission view in step with the tx path", async function () {
    function mulberry32(a) {
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rnd = mulberry32(0x5eed1234);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

    // The fuzz opens far more often than it closes, and every dollar stays inside
    // the partitioned buckets, so give the traders ample collateral (EQ-1 is
    // recomputed from totalSupply each step, so extra minting is harmless).
    for (const who of [trader, trader2]) {
      await usdc.mint(who.address, u(2000000), "phase4 fuzz liquidity");
    }

    const pairs = [PAIR_A, PAIR_B, PAIR_C];
    const margins = [u(100), u(500), u(1000), u(2500)];
    const leverages = [1n, 3n, 10n, 25n, 50n];
    const live = [];
    const stats = { open: 0, denied: 0, close: 0, liquidate: 0, trigger: 0, stale: 0 };

    for (let step = 0; step < 40; step++) {
      const roll = rnd();

      if (live.length === 0 || roll < 0.35) {
        // OPEN: the authoritative view decision must match the tx path exactly.
        const spec = {
          pairId: pick(pairs),
          isLong: rnd() < 0.5,
          margin: pick(margins),
          leverage: pick(leverages),
        };
        const netMargin = netMarginFor(spec.margin);
        const M = maxProfitLiabFor(netMargin);
        const allowed = await manager.authorizeOpen(
          spec.pairId,
          M,
          netMargin * spec.leverage
        );
        const who = rnd() < 0.5 ? trader : trader2;
        if (allowed) {
          const id = await open(who, spec);
          const p = await platform.getPosition(id);
          expect(p.maxProfitLiab).to.equal(M);
          expect(p.entryPrice).to.be.greaterThan(0n);
          expect(p.notional).to.equal(netMargin * spec.leverage);
          live.push({ id, who, pairId: spec.pairId, isLong: spec.isLong });
          stats.open += 1;
        } else {
          await expect(openTx(who, spec)).to.be.revertedWithCustomError(
            platform,
            "AdmissionDenied"
          );
          stats.denied += 1;
        }
      } else if (roll < 0.55) {
        // CLOSE at a random exit price around the entry (win, loss or capped loss).
        const target = pick(live);
        await oracle.setPrice(
          target.pairId,
          pick([px(980), px(995), px(1000), px(1005), px(1020)])
        );
        await close(target.who, target.id);
        live.splice(live.indexOf(target), 1);
        stats.close += 1;
      } else if (roll < 0.7) {
        // LIQUIDATE exactly at the position's own stored liquidation price.
        const target = pick(live);
        const p = await platform.getPosition(target.id);
        await oracle.setPrice(p.pairId, p.liquidationPrice);
        await liquidate(liquidator, target.id);
        live.splice(live.indexOf(target), 1);
        stats.liquidate += 1;
      } else if (roll < 0.85) {
        // KEEPER TRIGGER: open a protected position, breach the stop, fill at it.
        const spec = {
          pairId: pick(pairs),
          isLong: rnd() < 0.5,
          margin: u(500),
          leverage: 10n,
        };
        const netMargin = netMarginFor(spec.margin);
        const M = maxProfitLiabFor(netMargin);
        if (await manager.authorizeOpen(spec.pairId, M, netMargin * spec.leverage)) {
          spec.sl = spec.isLong ? px(990) : px(1010);
          const id = await open(trader, spec);
          await oracle.setPrice(spec.pairId, spec.isLong ? px(985) : px(1015));
          await trigger(keeper, id);
          stats.trigger += 1;
        }
      } else {
        // ORACLE STALENESS: the transition must be refused and change nothing.
        const target = pick(live);
        await oracle.setPriceAt(target.pairId, px(1000), 1);
        await expect(close(target.who, target.id)).to.be.revertedWithCustomError(
          platform,
          "StalePrice"
        );
        await oracle.setPrice(target.pairId, ENTRY);
        stats.stale += 1;
      }

      await expectConservation();
    }

    // The fuzz must have been non-vacuous.
    expect(
      stats.open + stats.denied + stats.close + stats.liquidate + stats.trigger + stats.stale
    ).to.equal(40);
    expect(stats.open).to.be.greaterThan(0);
    expect(stats.close + stats.liquidate + stats.trigger).to.be.greaterThan(0);
    expect(stats.stale).to.be.greaterThan(0);
    expect(live.length).to.be.greaterThan(0);
  });
});
