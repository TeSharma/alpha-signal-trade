const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Model-B Phase 2 — ProtocolRiskManager admission", function () {
  const D = 6;
  const u = (n) => ethers.parseUnits(String(n), D);
  const SETTLEMENT = u(70000);
  const RESERVE = u(25000);
  const OPS = u(5000);
  const TOTAL = SETTLEMENT + RESERVE + OPS;
  const HUGE_CAP = u(1000000000);
  // $70,000 / 1.5 = $46,666.67 -> floor in 6-dec units:
  const MAX_PERMITTED = (SETTLEMENT * 10000n) / 15000n; // 46666666666
  const INVERTED_BOUND = (SETTLEMENT * 15000n) / 10000n; // $105,000 (the WRONG form's bound)
  const PAIR_A = ethers.id("EUR/USD");
  const PAIR_B = ethers.id("GBP/USD");
  const PAIR_C = ethers.id("BTC/USD");
  const GRP_EUR = "0x4555520000000000";
  const GRP_ALT = "0x4742500000000000";

  let admin, stranger, treasury;
  let usdc, vault, manager;

  beforeEach(async function () {
    [admin, stranger, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory(
      "src/contracts/TokenizedCurrency.sol:TokenizedCurrency"
    );
    usdc = await Token.deploy("Test USD", "tUSD", D);
    await usdc.waitForDeployment();
    const Vault = await ethers.getContractFactory(
      "src/contracts/SettlementVault.sol:SettlementVault"
    );
    vault = await Vault.deploy(await usdc.getAddress(), treasury.address, admin.address);
    await vault.waitForDeployment();
    const Manager = await ethers.getContractFactory(
      "src/contracts/ProtocolRiskManager.sol:ProtocolRiskManager"
    );
    // Init order: manager deploys with platform unset (V3 not deployed yet in this suite).
    manager = await Manager.deploy(await vault.getAddress(), ethers.ZeroAddress, admin.address, 15000);
    await manager.waitForDeployment();
    await manager.setPlatform(admin.address); // admin acts as the platform registrar in tests
    await manager.setRiskParams(15000, HUGE_CAP, HUGE_CAP);
    await vault.setRiskManager(await manager.getAddress());
    await usdc.mint(admin.address, TOTAL, "phase2 seed");
    await usdc.connect(admin).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.seedCapital(SETTLEMENT, RESERVE, OPS);
  });

  async function expectPhysical() {
    expect(await vault.checkPhysicalInvariant()).to.equal(true);
  }

  // Reset aggregate liability to an exact value (all registration via PAIR_A, ungrouped).
  async function setL0(value) {
    const cur = await manager.currentMaxProtoLiab();
    if (cur > 0n) await manager.registerClose(PAIR_A, cur);
    if (value > 0n) await manager.registerOpen(PAIR_A, value);
  }
  it("admits at max permitted liability and rejects +1 wei (correct inequality)", async function () {
    expect(MAX_PERMITTED).to.equal(46666666666n); // $46,666.67 (floored)
    expect(await manager.maxPermittedLiability()).to.equal(MAX_PERMITTED);
    // Equality at the approved boundary admits...
    expect(await manager.authorizeOpen(PAIR_A, MAX_PERMITTED, 0)).to.equal(true);
    // ...one wei past rejects (never the inverted S*threshold form).
    expect(await manager.authorizeOpen(PAIR_A, MAX_PERMITTED + 1n, 0)).to.equal(false);
    await expectPhysical();
  });

  it("regression: liability above correct bound but below inverted bound rejected", async function () {
    expect(INVERTED_BOUND).to.equal(u(105000));
    expect(await manager.maxPermittedLiability()).to.be.lessThan(INVERTED_BOUND);
    // These would ALL pass the withdrawn inverted form (<= $105,000)...
    for (const bad of [u(46667), u(50000), u(104999)]) {
      expect(await manager.authorizeOpen(PAIR_A, bad, 0)).to.equal(false);
    }
    // ...and the correct bound itself still admits.
    expect(await manager.authorizeOpen(PAIR_A, MAX_PERMITTED, 0)).to.equal(true);
  });

  it("authorizeSettle validates closingM <= L0 before subtraction", async function () {
    await setL0(u(10000));
    // closingM exceeds registered liability -> false, no underflow path exists.
    expect(await manager.authorizeSettle(u(10001), 0)).to.equal(false);
    // Valid closingM but pnlGross > S -> absolute check fails first.
    expect(await manager.authorizeSettle(0, SETTLEMENT + 1n)).to.equal(false);
  });
  it("post-close coverage boundary: equality admits, +1 wei rejects", async function () {
    await setL0(u(50000));
    // L0=50000, closingM=40000 -> L'=10000 -> need S' >= 15000.
    // pnlGross=55000 -> S'=15000: equality -> admits.
    expect(await manager.authorizeSettle(u(40000), u(55000))).to.equal(true);
    // +1 wei of pnlGross -> S' below threshold -> rejects.
    expect(await manager.authorizeSettle(u(40000), u(55000) + 1n)).to.equal(false);
  });

  it("winning close improving coverage ALLOWED though pre-close form fails", async function () {
    // L0 = 60000 (pre-close coverage 116.67% < 150%). Pre-close form with L0
    // unchanged requires S' >= 90000 -> ANY outflow fails it. Post-close form:
    // closingM = 55000 -> L' = 5000, S' = 60000 -> 1200% -> MUST ALLOW.
    await setL0(u(60000));
    expect(await manager.authorizeSettle(u(55000), u(10000))).to.equal(true);
    // Approved case: post-close coverage below threshold -> MUST reject.
    // closingM = 1000 -> L' = 59000 -> need S' >= 88500; S' = 1000 -> false.
    expect(await manager.authorizeSettle(u(1000), u(69000))).to.equal(false);
  });

  it("liability-unchanged settlement: equality admits, crossing rejects", async function () {
    await setL0(u(40000));
    // closingM = 0 (liability unchanged): need S' >= 60000 -> pnlGross <= 10000.
    expect(await manager.authorizeSettle(0, u(10000))).to.equal(true);
    expect(await manager.authorizeSettle(0, u(10000) + 1n)).to.equal(false);
    expect(await manager.authorizeSettle(0, u(11000))).to.equal(false);
  });
  it("status bands honor approved example thresholds and boundaries", async function () {
    expect(await manager.status()).to.equal(0); // no liability -> GREEN
    // Boundary 150%: L0 = 46666666666 -> cov = 15000 -> GREEN.
    await setL0(46666666666n);
    expect(await manager.coverageMaxBps()).to.equal(15000n);
    expect(await manager.status()).to.equal(0);
    // One unit lower: cov = 14999 -> WARNING.
    await setL0(46666666667n);
    expect(await manager.coverageMaxBps()).to.equal(14999n);
    expect(await manager.status()).to.equal(1);
    // Boundary 125%: L0 = 56000000000 -> cov = 12500 -> WARNING (inclusive).
    await setL0(56000000000n);
    expect(await manager.coverageMaxBps()).to.equal(12500n);
    expect(await manager.status()).to.equal(1);
    await setL0(56000000001n);
    expect(await manager.status()).to.equal(2); // 12499 -> RESTRICTED
    // Boundary 110%: L0 = 63636363636 -> cov = 11000 -> RESTRICTED (inclusive).
    await setL0(63636363636n);
    expect(await manager.coverageMaxBps()).to.equal(11000n);
    expect(await manager.status()).to.equal(2);
    await setL0(63636363637n);
    expect(await manager.coverageMaxBps()).to.equal(10999n);
    expect(await manager.status()).to.equal(3); // CRITICAL
  });

  it("coverage status bands are configurable governance policy", async function () {
    await expect(manager.setCoverageBands(20000, 15000, 10000))
      .to.emit(manager, "CoverageBandsUpdated")
      .withArgs(20000n, 15000n, 10000n);
    await setL0(u(35000)); // cov = 20000 -> GREEN under new bands
    expect(await manager.coverageMaxBps()).to.equal(20000n);
    expect(await manager.status()).to.equal(0);
    await setL0(u(40000)); // cov = 17500 -> below new green 20000 -> WARNING
    expect(await manager.coverageMaxBps()).to.equal(17500n);
    expect(await manager.status()).to.equal(1);
    // Disordered bands rejected; non-admin rejected.
    await expect(
      manager.setCoverageBands(10000, 15000, 10000)
    ).to.be.revertedWithCustomError(manager, "InvalidCoverageBands");
    await expect(
      manager.connect(stranger).setCoverageBands(20000, 15000, 10000)
    ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
  });
  it("per-pair concentration cap boundary", async function () {
    await manager.setRiskParams(15000, u(10000), HUGE_CAP); // pair cap $10,000
    await manager.registerOpen(PAIR_A, u(9000));
    // Boundary: pair 9000 + 1000 = 10000 (not > cap) -> admits (coverage fine).
    expect(await manager.authorizeOpen(PAIR_A, u(1000), 0)).to.equal(true);
    // +1 past the pair cap -> rejects regardless of ample coverage.
    expect(await manager.authorizeOpen(PAIR_A, u(1000) + 1n, 0)).to.equal(false);
    // Different pair is independent of PAIR_A's cap usage.
    expect(await manager.authorizeOpen(PAIR_B, u(1000), 0)).to.equal(true);
    expect(await manager.authorizeOpen(PAIR_B, u(10000) + 1n, 0)).to.equal(false);
  });

  it("correlated-group cap aggregates across pairs; ungrouped pairs isolated", async function () {
    await manager.setRiskParams(15000, HUGE_CAP, u(12000)); // corr cap $12,000
    await manager.setPairCorrGroup(PAIR_A, GRP_EUR);
    await manager.setPairCorrGroup(PAIR_B, GRP_EUR);
    await manager.registerOpen(PAIR_A, u(7000));
    await manager.registerOpen(PAIR_B, u(4000));
    expect(await manager.corrGroupLiab(GRP_EUR)).to.equal(u(11000));
    // Group boundary: 11000 + 1000 = 12000 (not > cap) -> admits.
    expect(await manager.authorizeOpen(PAIR_B, u(1000), 0)).to.equal(true);
    // +1 past corr cap -> rejects (pair cap is huge; coverage ample).
    expect(await manager.authorizeOpen(PAIR_B, u(1000) + 1n, 0)).to.equal(false);
    // Ungrouped pair is isolated from EUR group accounting.
    expect(await manager.authorizeOpen(PAIR_C, u(20000), 0)).to.equal(true);
    // Register close reduces group liability exactly.
    await manager.registerClose(PAIR_B, u(4000));
    expect(await manager.corrGroupLiab(GRP_EUR)).to.equal(u(7000));
    expect(await manager.currentMaxProtoLiab()).to.equal(u(7000));
    // Group may not be changed while pair has registered liability.
    await expect(
      manager.setPairCorrGroup(PAIR_A, GRP_ALT)
    ).to.be.revertedWithCustomError(manager, "LiabilityRegistered");
  });

  it("pause/halt block opens but never settlement", async function () {
    await setL0(u(40000));
    expect(await manager.authorizeOpen(PAIR_A, 1n, 0)).to.equal(true);
    await manager.setPaused(true);
    expect(await manager.authorizeOpen(PAIR_A, 1n, 0)).to.equal(false);
    // Settlement unaffected by pause (users must always be able to close).
    expect(await manager.authorizeSettle(u(1000), u(1000))).to.equal(true);
    await manager.setPaused(false);
    await manager.setAdmissionHalted(true);
    expect(await manager.authorizeOpen(PAIR_A, 1n, 0)).to.equal(false);
    expect(await manager.authorizeSettle(u(1000), u(1000))).to.equal(true);
    await manager.setAdmissionHalted(false);
    expect(await manager.authorizeOpen(PAIR_A, 1n, 0)).to.equal(true);
  });
  it("access control: platform-only registration, admin-only governance", async function () {
    // Strangers cannot register liability.
    await expect(
      manager.connect(stranger).registerOpen(PAIR_A, 1n)
    ).to.be.revertedWithCustomError(manager, "PlatformOnly");
    await expect(
      manager.connect(stranger).registerClose(PAIR_A, 1n)
    ).to.be.revertedWithCustomError(manager, "PlatformOnly");
    // Underflow on unregistered liability.
    await expect(
      manager.registerClose(PAIR_A, 1n)
    ).to.be.revertedWithCustomError(manager, "LiabilityUnderflow");
    // Pair with insufficient registered liability.
    await manager.registerOpen(PAIR_A, u(7000));
    await expect(
      manager.registerClose(PAIR_A, u(8000))
    ).to.be.revertedWithCustomError(manager, "LiabilityUnderflow");
    // Admin-only governance setters.
    await expect(
      manager.connect(stranger).setRiskParams(15000, 1, 1)
    ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    await expect(
      manager.connect(stranger).setPaused(true)
    ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    await expect(
      manager.connect(stranger).setAdmissionHalted(true)
    ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    await expect(
      manager.connect(stranger).setPlatform(stranger.address)
    ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    await expect(
      manager.connect(stranger).setPairCorrGroup(PAIR_A, GRP_EUR)
    ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    // Platform rewiring works for admin and is enforced thereafter.
    await manager.setPlatform(stranger.address);
    await expect(
      manager.registerOpen(PAIR_A, 1n)
    ).to.be.revertedWithCustomError(manager, "PlatformOnly");
    await manager.connect(stranger).registerOpen(PAIR_A, 1n);
    expect(await manager.currentMaxProtoLiab()).to.equal(u(7000) + 1n);
  });

  it("external coverage is exactly 0; maxPermitted follows S*10000/Cmin", async function () {
    expect(await manager.hedgeManager()).to.equal(ethers.ZeroAddress);
    expect(await manager.maxPermittedLiability()).to.equal((SETTLEMENT * 10000n) / 15000n);
    // Changing Cmin changes the bound by pure division — never S * threshold.
    await manager.setRiskParams(11000, HUGE_CAP, HUGE_CAP);
    expect(await manager.maxPermittedLiability()).to.equal((SETTLEMENT * 10000n) / 11000n);
    await manager.setRiskParams(15000, HUGE_CAP, HUGE_CAP);
    expect(await manager.maxPermittedLiability()).to.equal((SETTLEMENT * 10000n) / 15000n);
  });

  it("Cmin = 0 means no coverage bound (documented edge)", async function () {
    await manager.setRiskParams(0, HUGE_CAP, HUGE_CAP);
    expect(await manager.maxPermittedLiability()).to.equal(ethers.MaxUint256);
    // Coverage inequality trivially satisfied: S*10000 >= 0 * L1.
    expect(await manager.authorizeOpen(PAIR_A, u(1000000000), 0)).to.equal(true);
  });

  it("L0 = 0 edge: vacuously covered everywhere", async function () {
    expect(await manager.currentMaxProtoLiab()).to.equal(0n);
    expect(await manager.coverageMaxBps()).to.equal(ethers.MaxUint256);
    expect(await manager.status()).to.equal(0);
    expect(await manager.authorizeSettle(0, 0)).to.equal(true);
    expect(await manager.authorizeOpen(PAIR_A, 0, 0)).to.equal(true);
    await expectPhysical();
  });
  it("fuzz: authorizeOpen matches reference inequality", async function () {
    function mulberry32(a) {
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const r = mulberry32(0xc0ffee);
    const rnd = (max) => BigInt(Math.floor(r() * Number(max)));
    const cmins = [11000n, 12500n, 15000n];
    for (let i = 0; i < 40; i++) {
      const cmin = cmins[Math.floor(r() * 3)];
      await manager.setRiskParams(cmin, HUGE_CAP, HUGE_CAP);
      const l0 = rnd(90000000001n); // 0..$90,000
      await setL0(l0);
      const mnew = rnd(90000000001n);
      // Reference: approved inequality only (pair/corr caps pass by HUGE_CAP; not halted).
      const expected = SETTLEMENT * 10000n >= cmin * (l0 + mnew);
      expect(await manager.authorizeOpen(PAIR_A, mnew, 0)).to.equal(expected);
    }
  });

  it("fuzz: authorizeSettle matches reference (validate -> absolute -> post-close)", async function () {
    function mulberry32(a) {
      return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const r = mulberry32(0xbeef1);
    const rnd = (max) => BigInt(Math.floor(r() * Number(max)));
    const cmins = [11000n, 12500n, 15000n];
    for (let i = 0; i < 40; i++) {
      const cmin = cmins[Math.floor(r() * 3)];
      await manager.setRiskParams(cmin, HUGE_CAP, HUGE_CAP);
      const l0 = rnd(90000000001n);
      await setL0(l0);
      const closingM = rnd(l0 + 5000000001n); // may exceed l0 by up to $5,000
      const pnlGross = rnd(SETTLEMENT + 5000000001n); // may exceed S by up to $5,000
      let expected = closingM <= l0 && pnlGross <= SETTLEMENT;
      if (expected) {
        expected = (SETTLEMENT - pnlGross) * 10000n >= cmin * (l0 - closingM);
      }
      expect(await manager.authorizeSettle(closingM, pnlGross)).to.equal(expected);
    }
    await expectPhysical();
  });
});
