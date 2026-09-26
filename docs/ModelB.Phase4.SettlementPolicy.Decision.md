# Model-B Phase 4 — Settlement-Policy Decision Memo

**Status:** OPEN — decision required before the Phase-4 checkpoint is committed.
**Scope:** the post-close coverage requirement in `ProtocolRiskManager.authorizeSettle`.
**Code changed by this memo: NONE.** Nothing in `src/contracts/**` or `test/**` was
modified; Phase 4 remains uncommitted. This document is the only new file.

---

## 0. Evidence base (what the decision is about, exactly)

| Fact | Location |
| --- | --- |
| Settlement gate: `authorizeSettle(closingM, pnlGross)` | `ProtocolRiskManager.sol` L206–216 |
| Gate is `view`, no pause/halt clause ("settlements must proceed regardless") | `ProtocolRiskManager.sol` L205 |
| Guard is called **only on the profitable leg** of a close | `TradingPlatformV3.sol` L366–368 (`if (!riskManager.authorizeSettle(...)) revert SettlementDenied();`) |
| Loss / breakeven close leg is **ungated** (no gate call) | `TradingPlatformV3.sol` L386–410 |
| Liquidation is **ungated** and debits zero settlement capital | `TradingPlatformV3.sol` L307–344 |
| Vault `settleProfit` applies only the absolute check `gross > settlementLedger → InsufficientSettlement` | `SettlementVault.sol` L206 |
| Governance settlement→reserve/ops/treasury outflow is guarded by the **same** `S' * 10000 >= Cmin * L0` | `SettlementVault.sol` L156–167, L249–256 |
| `emergencyTransferLedger` (EMERGENCY_ROLE) **bypasses** that guard, logs post-action coverage + status | `SettlementVault.sol` L174–185 |
| Only in-code way to *raise* settlement capital: `seedCapital` (DEFAULT_ADMIN_ROLE, `usdc.transferFrom`), `transferLedger(RESERVE→SETTLEMENT)` / `emergencyTransferLedger(RESERVE→SETTLEMENT)` | `SettlementVault.sol` L105–116 |
| `setRiskParams` can raise `minimumCoverageBps` with **no** guard against an existing book | `ProtocolRiskManager.sol` L92–101 |
| Defaults: `minimumCoverageBps = 15000`, bands 15000/12500/11000 bps | `ProtocolRiskManager.sol` L76–91 |
| `M_i = netMargin * maxProfitBps / 10000`; PnL capped at `margin * maxProfitBps / 10000` ⇒ **`g ≤ M_i` always** | `TradingPlatformV3.sol` L224, L424–426 |
| Re-pointing is possible without redeploying V3: `V3.setRiskManager`, `V3.setVault`, `vault.setRiskManager` are owner/admin setters | `TradingPlatformV3.sol` L490–501, `SettlementVault.sol` L130 |
| External coverage `X == 0` (no `hedgeManager` setter) | `ProtocolRiskManager.sol` L51–52, L246–253 |

---

## 1. The rule under review

**Option A (current, as implemented):**

```
allowSettle(M, g)  ⟺  M ≤ L0
                    ∧  g ≤ S                      (absolute, checked first)
                    ∧  (S − g) * 10000 ≥ Cmin * (L0 − M)
   where M = closingM = p.maxProfitLiab, g = pnlGross,
         S = vault.settlementLedger(), L0 = currentMaxProtoLiab, Cmin = 15000 bps
```

At the pending close `L' = L0 − M`, `S' = S − g`.

**X-term note (applies to all options, no change requested).** The real guard reads
`(S + X)` where `X = IHedgeManager.committedCoverage()` and `X ≡ 0` while
`hedgeManager` is unset (L210–215, L246–253), so every formula here is written on
`S = settlementLedger` without loss of generality. If `X` ever becomes non-zero, the
guard would approve `g > S` (funded only by `X`) while `SettlementVault.settleProfit`
funds strictly from `settlementLedger` (`gross > settlementLedger →
InsufficientSettlement`, L206) — i.e. an `X`-backed approval would revert in the
vault at the last step. Flagged as a Phase-5+ item; A/B/C all inherit it unchanged.

The stated intent of the third clause is **"do not let one settlement drop the
protocol below its published coverage floor."** Its actual consequence is
narrower and, in the below-floor state, inverted — see §2.

---

## 2. Key theorem: when can a profitable close actually be denied?

**Theorem (proved and grid-verified).** Given the code invariants `g ≤ M` and
`M ≤ L0` (both enforced: L424–426 caps PnL at `M_i`; `authorizeSettle` rejects
`M > L0`), and any policy `Cmin ≥ 10000` (100%):

> `pre-state compliant  ⇒  post-state compliant`

*Proof.* `S * 10000 ≥ Cmin * L0 ≥ 10000 * L0 ⇒ S ≥ L0`. The post-state ratio is
lower than the pre-state ratio iff `S·M < g·L0`; since `g ≤ M` and `S ≥ L0`,
`S·M ≥ L0·M ≥ L0·g`, so the ratio cannot fall. ∎

**Consequence:** with the real policy (`Cmin = 150%`), a profitable close is
denied **iff the book was already below the floor before the close**. Option A is
therefore not a solvency guard at all — it is a *policy lock* on an already
below-floor book, and it denies payouts that would **improve** coverage.

**Grid evidence** (`node` scan over S ∈ {1…1000}, L0 ∈ {0…200}, M ∈ {0…100},
g ∈ {0…90}, Cmin ∈ {100%,120%,150%,200%}):

| Scan | Result |
| --- | --- |
| Option A, Cmin ≥ 100% | 540 denials — **all** from pre-states already below the floor; **0** denials of a compliant pre-state |
| Option A, Cmin = 50% (below 100%) | 4 grid cases deny a *compliant* pre-state (the theorem needs `Cmin ≥ 10000`) |
| Option B (absolute solvency only), 199,793 random books with `S ≥ L0` | `Σ payouts > S` breaches: **0** |
| Option C (hard 100% floor), same grid | **0** denials while pre-coverage ≥ 100%; denial rule `denied ⟺ (L0 − S) > (M − g)` matched the sim with 0 mismatches |

### The reported example, reconciled

`S = $100, L0 = $100, Cmin = 150%, M = $10, g = $1`

| | pre-close | post-close |
| --- | --- | --- |
| S | 100 | 99 |
| L0 | 100 | 90 |
| coverage | **100% < 150% (already below the floor)** | **110% (improved)** |

Option A denies. The denial is not protecting capital — coverage *rises* from
100% to 110%. It is the floor (150%) being applied to a book that no longer meets
it. Option C allows this close: `(100 − 1) * 10000 = 990,000 ≥ 10000 * (100 − 10) = 900,000`.

### The same situation in the live suite

`test/ModelB.Phase4.Conservation.test.js` §(e): S = 70,000 seed, 13 positions,
`setRiskParams(30000, …)` raises the floor to 300%; a +$9.992 close is denied
(`SettlementDenied`) and the position stays open with live market risk. That test
currently documents the lock as a *finding*. Under Option C it becomes a
regression test that the raise **cannot** lock settlement.

---

## 3. The three options

### Option A — keep the status quo (full `Cmin` floor on settlement)

```
allowSettle ⟺ M ≤ L0 ∧ g ≤ S ∧ (S − g) * 10000 ≥ Cmin * (L0 − M)      [Cmin = 15000]
```

**When profitable closes get blocked (complete characterisation):** exactly when
the pre-close book is below the `Cmin` floor. Today that state is reachable by
exactly three routes, because every other flow is ratio-improving or ratio-guarded:

1. **Governance raises `Cmin`** above the ratio governing the existing book
   (`setRiskParams` has no timelock, no book-awareness, no event-level warning).
   *This is the only market-independent route.*
2. **An unguarded `emergencyTransferLedger` outflow** from the settlement ledger
   (`EMERGENCY_ROLE`, deliberately bypasses the guard).
3. A defect / unexpected interaction (the Phase-0…3 paths are covered by the
   conservation suites, so this is residual risk, not an expected state).

Note what does **not** cause the state: losing closes (they add surplus to `S` and
release `M` from `L0` — coverage *strictly improves*), liquidations (`S` unchanged,
`L0` falls — improves), and profitable closes from a compliant book (§2 theorem).
So Option A's exposure is a **governance-operation risk**, not a market risk.

**User funds / settlement implications when it fires**

* The in-the-money position cannot be closed by its owner (`closePosition`), by a
  keeper (`closeWithTrigger`), and its **stop-loss / take-profit protection is
  dead** (both routes reach the same gated `_closePosition`).
* The user keeps the position at live market risk and can still be **liquidated**
  (`liquidate` is ungated and pays the liquidator 30% of margin from V3 custody)
  — a value transfer away from a user whose settled value would have been positive.
* Funds are **not lost**, only locked: the position stays open, the margin stays in
  V3 custody, `L0` stays registered, and EQ-1/2/3/5 all hold exactly (Phase-4 suite
  1 proves this). Losing closes and liquidations remain available, so the book
  *can* shrink — but only by the market moving against holders.
* Paths out of the below-floor state, with no contract change:
  (i) `seedCapital` (admin) — `S` up; (ii) `transferLedger`/`emergencyTransferLedger`
  `RESERVE → SETTLEMENT` — `S` up (the reserve ledger is real seeded capital);
  (iii) losing closes accumulate `settlementSurplusRetained` into `S`; (iv) `L0`
  falling through liquidations. Nothing in code forces any of these, and there is
  no admin force-close, no haircut, no pro-rata release, no settlement-level pause.

**Is it a published intentional policy?** No. There is no user-facing statement, no
UI/API pre-flight, and no documentation of it as a *settlement* policy; the
RiskManager header even states the opposite principle for settlement ("settlements
must proceed regardless", L205) while this clause blocks them. Phase 3/4 merely
*record* the behaviour. Retaining Option A means **formalising and publishing** it,
plus the mechanisms below.

**Emergency / de-risking mechanisms that would be required if A is retained**

1. Timelocked `Cmin` increases (e.g. 48 h) **plus** an existing-book carve-out, or
   a rule that a floor change binds only new admissions.
2. A published policy: what blocks settlement, why, and the recovery SLA.
3. An emergency release path for settlement (governance-signed, rate-limited to the
   absolute-solvency bound) so a below-floor book cannot trap users indefinitely.
4. Frontend/API pre-flight using the existing `authorizeSettle` view so users learn
   before signing, plus monitoring/alerting on `S * 10000 < Cmin * L0` and a runbook.
5. A user-visible "policy-blocked" status distinct from "insolvent" for support.

### Option B — absolute solvency only

```
allowSettle ⟺ M ≤ L0 ∧ g ≤ S          [coverage floor becomes admission-only]
```

* **No policy lock, ever.** Every close in §2's grid is payable.
* **Provably safe while `S ≥ L0`** (≥100% coverage): since `g ≤ M` per position,
  `Σ g_i ≤ Σ M_i = L0 ≤ S`, so *every* winner can be paid in *any* order —
  199,793 random books, 0 breaches. This is the protocol's state whenever it is
  on-policy.
* **Unfair if `S < L0`** (a state only Option-A route 2 reaches today): payouts
  become first-come-first-served. Example `S = 90, L0 = 100` with two positions
  `M = 90, g = 90` each → the first claimant is paid 90, the second finds `S = 0`.
  Settlement becomes an insolvency race decided by gas.
* Coverage may legitimately fall below `Cmin` (to 0% in that pathological case)
  while the book unwinds; only *new risk* is blocked.
* Removes the only ratio brake on settlement outflow, leaving the guarded
  governance outflow as the sole `Cmin` protection of `S`.

### Option C — hybrid, recommended (hard 100% settlement floor)

```
allowSettle ⟺ M ≤ L0 ∧ g ≤ S ∧ (S − g) * 10000 ≥ F * (L0 − M)
   F = settlementFloorBps ∈ [0, 10000], default 10000 (100%), F ≤ Cmin enforced
```

* `F = settlementFloorBps` is a **new governance parameter with a hard on-chain cap
  of 10000 bps**, so no parameter value can re-create Option A's lock.
* `F = 10000` ⇒ denial `⟺ (L0 − S) > (M − g)`: only payouts that would make the
  **shortfall worse than the equity this close releases** are refused (grid-verified,
  0 mismatches). Equivalently: settlement may never take residual coverage below 100%.
* `F = Cmin` reproduces Option A; `F = 0` reproduces Option B. Both prior policies
  become endpoints of one parameterised rule — and only the safe endpoint is
  governance-reachable, because of the 10000 bps cap.
* **The `Cmin` floor is repurposed as in Option B**: it governs new-risk admission
  (`authorizeOpen`) and guarded governance outflows (`SettlementVault.transferLedger`).
  It never blocks a close.
* Residual bind: only when `S < L0` already — reachable only via the unguarded
  emergency outflow or a defect. There it is the fairness rule that prevents
  Option B's gas race, and it is lifted by recapitalisation
  (`seedCapital` / `RESERVE → SETTLEMENT`), not by weakening user rights.
* Strongest safety property of the three: the only rule that makes **"every
  remaining winner stays fully payable"** an induction invariant (§5, N-1).
  Under B that can be lost; under A it is bought by refusing to pay at all.

**Why C and not B:** C equals B in every state the protocol can reach by normal
operation, and additionally forbids the pathological drain B tolerates after an
unguarded emergency outflow. Cost: one new parameter, zero change to V3.

---

## 4. Side-by-side

| Criterion | A (status quo) | B (absolute only) | C (hard 100% floor) — proposed |
| --- | --- | --- | --- |
| Blocks a profitable close from a compliant book | Never (§2) | Never | Never |
| Blocks a profitable close from a below-floor book | **Yes — even when the close improves coverage** | No | Only if it deepens an existing shortfall |
| Can governance re-create a settlement lock? | Yes, one `setRiskParams` tx | No | No (F capped at 10000 bps) |
| Can settlement strand later winners (`S < L0`)? | No (over-blocks) | **Yes (gas race)** | No (`S' ≥ L0'` invariant) |
| Does `Cmin` still protect `S`? | Yes, on settlement + governance outflow | Only on the governance outflow | Only on the governance outflow (admission kept) |
| Can a user be trapped in an ITM position? | Yes, indefinitely | No | Only in a pre-existing-shortfall state, lifted by recapitalisation |
| "Remaining winners stay payable" invariant | Not needed (nothing pays) | Not guaranteed | **Inductive invariant** |
| New parameters / events | none | none | `settlementFloorBps` + setter + event |
| Contract changes | none | `authorizeSettle` (drop clause) | `authorizeSettle` (parameterise clause) + setter |
| V3 / vault changes | none | none | **none** |
| User-facing change vs today | none (silent) | payouts in below-floor states | payouts in below-floor states (same as B in practice) |

## 5. State transitions, per option

Notation: pre-state `S, L0`; winning close releases `M ≤ L0` and pays `g ≤ M`;
loss close adds surplus `y ≥ 0` to `S` and releases `M` from `L0`; liquidation
leaves `S` and releases `M`.

| Transition | A | B | C |
| --- | --- | --- | --- |
| Winning close, ratio ≥ 100% | allowed, ratio unchanged or better | allowed, same | allowed, same |
| Winning close, ratio < `Cmin` but ≥ 100% | **denied** (position stays open) | allowed, ratio improves | allowed, ratio improves |
| Winning close, ratio < 100% | denied unless the new ratio ≥ `Cmin` (usually impossible) | allowed if `g ≤ S`, ratio may fall to 0% | allowed only if `S' ≥ L0'` (no deeper shortfall) |
| Loss close (`y ≥ 0`) | always allowed (no gate call), coverage improves | same | same |
| Liquidation | always allowed, coverage improves | same | same |
| Admission of new risk | `(S+X)*10000 ≥ Cmin*(L0+M_new)` | same | same |
| Governance raises `Cmin` | existing book may be locked (Phase-4 finding) | no settlement effect; admissions tighten | no settlement effect; admissions tighten |
| `transferLedger` settlement → treasury/reserve | guarded by `S'*10000 ≥ Cmin*L0` | same | same |
| `emergencyTransferLedger` settlement → … | unguarded, can create the lock | unguarded, can create the FCFS race | unguarded, can create a shortfall state (backstop binds) |

### Invariant changes (relative to Phase 3/4 suites)

* **EQ-1, EQ-2, EQ-3, EQ-5 — unchanged** in all three options (supply partition,
  physical vault partition, liability reconstruction, closed settlement roll-forward).
* **EQ-4 is reframed** (only for B and C; A keeps it as-is):
  * `EQ-4a` *(always, hard)*: `S * 10000 ≥ 10000 * L0` — "absolute solvency at 100%",
    asserted after **every** transition. Under C this is preserved by induction:
    `S' − L0' = (S − g) − (L0 − M) = (S − L0) + (M − g) ≥ 0` because `M ≥ g`.
  * `EQ-4b` *(policy, point-in-time)*: `(S + X) * 10000 ≥ Cmin * L0` asserted at
    **admission** boundaries and after **guarded governance outflows** — no longer
    after every settlement. The current `opts.coverageEnforced` escape hatch in
    `expectConservation` is replaced by this split (it stops being a special case and
    becomes the normal post-settlement assertion).
* **New invariant N-1 (C only)**: after every close, `S' ≥ L0'` — equivalently "the
  residual settlement capital still backs every remaining winner at 100%". This is
  the property that makes Option B's FCFS race unreachable. It also subsumes
  "no position is denied while the protocol is solvent".
* Policy floor and settlement floor must stay ordered: `F ≤ Cmin` and `F ≤ 10000`
  are parameter-validation invariants (revert otherwise).

---

## 6. Proposed implementation sketch (Option C — NOT applied; for approval only)

All inside `ProtocolRiskManager`; `TradingPlatformV3.sol` and `SettlementVault.sol`
keep their current logic and ABIs.

```solidity
uint256 public settlementFloorBps;        // new slot, constructor-initialised

// constructor(..., uint256 _minimumCoverageBps)
//   minimumCoverageBps = _minimumCoverageBps;
//   settlementFloorBps = 10_000;               // 100%: cannot lock a solvent book

function setSettlementFloor(uint256 _floorBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (_floorBps > 10_000) revert SettlementFloorTooHigh(_floorBps);   // hard cap
    if (_floorBps > minimumCoverageBps) revert SettlementFloorAboveCoverage(_floorBps, minimumCoverageBps);
    uint256 old = settlementFloorBps;
    settlementFloorBps = _floorBps;
    emit SettlementFloorUpdated(old, _floorBps);
}

function authorizeSettle(uint256 closingM, uint256 pnlGross) external view returns (bool) {
    uint256 l0 = currentMaxProtoLiab;
    if (closingM > l0) return false;
    (uint256 s, ) = _settlementAndExternal();   // X == 0 in Model B
    if (pnlGross > s) return false;
    // Absolute-solvency path plus the 100%-invariant backstop on the residual book.
    return (s - pnlGross) * 10_000 >= settlementFloorBps * (l0 - closingM);
}
```

Notes / open micro-decisions to fix at implementation time (each is a one-line
choice, no policy impact):

* keep the current `require`-style `InvalidSettlementFloor` string reverts or use
  custom errors as elsewhere in the RiskManager;
* whether `setRiskParams` should also require the new `Cmin ≥ settlementFloorBps`
  (recommended: yes, keeps the ordering invariant local to one setter);
* whether the frontend helper should be a dedicated view (`settlementAvailability(positionId)`)
  or simply the existing `authorizeSettle(maxProfitLiab, grossProfit)` read (recommended:
  reuse — no new ABI surface);
* whether to emit a `CoverageBandChanged`/`status` transition on the settlement path
  (not possible from a `view`; any emission would have to move into the V3 close path —
  explicitly out of scope, keeps V3 untouched).

## 7. User-facing behaviour after the change

* **Healthy book (coverage ≥ 100%)**: no observable change at all. Wins settle as
  today; the `SettlementDenied` revert disappears as a reachable outcome.
* **Book below `Cmin` but ≥ 100%** (e.g. after a governance floor raise, as in the
  Phase-4 test): wins now settle, coverage drifts to the new ratio, and the UI shows
  the reduced band from `status()`; **new positions stay blocked** (`AdmissionDenied`).
  The user-visible message becomes "new risk paused", not "your profit is frozen".
* **Book below 100%** (only after an unguarded emergency outflow or a defect): payouts
  are still allowed unless they deepen the shortfall, and the position owner gets a
  deterministic, publishable rule instead of "wait for governance" — plus the
  `EmergencyLedgerTransfer` event already reports post-action coverage and status for
  monitoring.
* Nothing changes for loss closes, liquidations, fees, or the V2 path.

## 8. Attack / abuse cases

| # | Vector | A | B | C |
| --- | --- | --- | --- | --- |
| 1 | Governance (or a compromised admin key) raises `Cmin` to freeze every profitable exit of an existing book — a griefing/rug surface with no timelock | **open** | closed | closed (F ≤ 10000) |
| 2 | Keeper/bot pushes the price into a trapped position's liquidation band, collecting the 30% penalty from a user whose value was positive | **open (enabled by 1)** | closed | closed (except in a pre-existing shortfall state) |
| 3 | Tail-claimant stranding via FCFS race when `S < L0` | closed (over-blocks) | **open** | designed shut (N-1) |
| 4 | Drain `S` via unguarded `emergencyTransferLedger`, then let the settlement path pay out whatever is left | limited by the ratio clause | **open** | limited to `S' ≥ L0'`, i.e. no *further* unfairness |
| 5 | Spam reverting closes / view calls to censor others | n/a (gas only) | n/a | n/a (gas only; no state change, no MEV while solvent) |
| 6 | MEV/priority-gas race between winners | none today | **yes when `S < L0`** | none |
| 7 | Silent policy change (users can't see the rule was tightened) | **open** (currently undisclosed) | n/a | mitigated: published `settlementFloorBps` (≤100%) + `SettlementFloorUpdated` event + docs |

---

## 9. Test changes required (whichever option is chosen)

**Common (all options)**

* `test/ModelB.Phase4.Conservation.test.js` → `expectConservation`: split EQ-4 into
  `EQ-4a` (always `S ≥ L0`) + `EQ-4b` (policy, at admission / guarded outflow only)
  and delete the `opts.coverageEnforced` escape hatch (it becomes unnecessary).
* Add the **Option-C regression from this memo**: `S = 100, L0 = 100, Cmin = 150%`,
  `M = 10`, `g = 1` ⇒ close **succeeds**, `S' = 99`, `L' = 90`, ratio 110%, `S' ≥ L'`.
* Keep the Phase-4 §(e) scenario but invert its expectation: raising `Cmin` to 300%
  must **not** deny the win leg; instead `authorizeOpen` must return false and the
  position must remain closed with `L'` reduced by exactly `M`.

**Option-C specific**

* `authorizeSettle` property grid: contract == mirror with the `F` clause, at
  `F ∈ {0, 1, 10000}` and boundaries `required ± 1` for each `F`.
* `setSettlementFloor` validation: `> 10000` reverts; `> minimumCoverageBps` reverts;
  `F = 10000` (default) accepted; event args; post-set guard uses the new `F`.
* New invariant `N-1` asserted after every transition and inside the 40-step fuzz,
  including a fuzz variant that starts from a deliberately sub-100% book created via
  `emergencyTransferLedger` (documenting the one reachable entry into that state).
* Add the denial-equivalence property `denied ⟺ (L0 − S) > (M − g)` as an explicit
  boundary test at `(M − g) == (L0 − S)`.
* Re-run the full verification chain: `npx hardhat compile --force`,
  `npx hardhat test` (must stay ≥128 passing), `npx tsc --noEmit`, `git diff --check`.

**Option-A specific (only if A is retained)**

* Keep the current assertions, and add the missing policy machinery tests:
  timelock/`Cmin`-raise behaviour, emergency release path, and a documented
  `docs/` policy statement; plus a UI-pre-flight read test for `authorizeSettle`.

**Option-B specific**

* Replace the coverage clause in the mirror with the absolute-only predicate, add the
  sub-100% FCFS race test as a *documented* finding, and show in a test that coverage
  may drop below `Cmin` after a settlement while admission stays blocked.

**Unaffected suites** (no edits expected): `ModelB.Phase4.Exposure.test.js`
(concentration/oracle/parity — none of it touches the settlement clause),
Phase 0/2/3 suites, and all V2 suites (V2 has no coverage gate; parity tests must
keep using states where both platforms permit the close).

## 10. Migration implications

* **Model B is not deployed**: `deployments/` contains only V1/V2 artifacts
  (`amoy-deployment.json`, `amoy-v2-deployment.json`, `polygon-deployment.json` — no
  `TradingPlatformV3` / `ProtocolRiskManager` / `SettlementVault` entries), and
  `src/config/contracts.ts` has no V3/RM addresses ⇒ no state migration and no upgrade
  path to design. The change ships as source + tests.
* **Redeploy surface if/when it is deployed**: `ProtocolRiskManager` gains
  `settlementFloorBps` (append-only storage slot) and a new event. Because V3 exposes
  `setRiskManager(address)` and `SettlementVault` exposes `setRiskManager(address)`,
  the manager can be replaced later **without redeploying V3 or the vault**; the
  re-point sequence is `RM.setPlatform(V3)` → `V3.setRiskManager(RM)` →
  `vault.setRiskManager(RM)`.
* **ABIs / TS bindings**: regenerate via the existing compile/ABI export path; the
  `ISettlementVault` / `IProtocolRiskManager` interfaces used by V3 are unchanged
  (`authorizeSettle` keeps its exact signature and `bool` return), so **no V3 ABI churn**.
* **Frontend/API**: add `settlementFloorBps` to the risk-parameter read model + a
  pre-flight `authorizeSettle` read on the close screen; surface `status()` bands.
* **Docs/config**: update the parameter tables in `README.md` / `DEPLOYMENT.md` and any
  environment/config seed values; add the published settlement-policy paragraph
  (including "profits are settled while remaining settlement capital covers remaining
  obligations at 100%; the 150% floor gates new risk and governance outflows").
* **Backwards compatibility**: no user action required; no balances, positions, or
  ledgers change; V2 (`TradingPlatformV2.sol`) and its tests are untouched.

## 11. Decision requested

| Option | One-line summary |
| --- | --- |
| **A** | Keep `Cmin` on the settlement path; accept a governance-creatable settlement lock; publish the policy and add timelock/emergency-release machinery. |
| **B** | Absolute solvency only; `Cmin` becomes admission-only; accept the `S < L0` first-come-first-served race. |
| **C** *(recommended)* | Absolute solvency **plus** a hard 100% floor (`settlementFloorBps`, capped at 10000, `≤ Cmin`); `Cmin` gates new risk and governance outflows; `S' ≥ L0'` becomes an inductive invariant. |

**Decision: C — approved, implemented, and verified in this checkpoint.**

As built in `ProtocolRiskManager.sol` (§9/§10 as written, no deviation):

| Item | As-built |
| --- | --- |
| Floor parameter | `uint256 public settlementFloorBps`, initialized to `10_000` (100%) in the constructor — "a solvent book can never be locked by policy". |
| Setter | `setSettlementFloor(uint256)` (`DEFAULT_ADMIN_ROLE`): checks the **100% hard cap first** (`> 10_000` → `SettlementFloorTooHigh`), **then** the ordering rule (`> minimumCoverageBps` → `SettlementFloorAboveCoverage`), then stores and emits `SettlementFloorUpdated(old, new)`. |
| Ordering both ways | `setRiskParams` reverts `SettlementFloorAboveCoverage` when `_minimumCoverageBps < settlementFloorBps`. |
| Settlement gate | `authorizeSettle(closingM, pnlGross)`: `closingM <= L0` → **absolute** `pnlGross <= S + X` (insolvency check *before* any coverage ratio) → residual floor `(S + X − pnlGross) * 10000 >= settlementFloorBps * (L0 − closingM)`. Still `view`, no pause/halt gate, signature unchanged. |
| Role of `Cmin` | Gates `authorizeOpen` and governance outflows (`authorizeWithdrawal`) only — never the settlement path. |
| Inductive invariant | At the deployed default `F = 10000` the third clause **is** `S' >= L0'`, so a book that satisfies `S >= L0` keeps satisfying it after every admitted settlement (asserted as "N-1" in both suites). |

Two consequences worth recording, both captured by tests rather than prose:

1. **The ordering rule is dormant at the approved parameters.** With `Cmin = 15000 > 10000`,
   the hard cap binds first, so `setSettlementFloor(15000)` reverts `SettlementFloorTooHigh`
   (not `AboveCoverage`) and `F = Cmin` is unreachable. `test/ModelB.Phase2.test.js` now
   demonstrates the `F <= Cmin` branch by first lowering `Cmin` below 100%.
2. **A weakened floor is a deliberate governance choice, not an invariant.** The fuzz
   sweep exercises `F ∈ {0, 1, 10000}`; the N-1 inductive step is therefore asserted
   under the restored default `F = 10000`, which is what the deployment ships with.

Verification for this checkpoint: `npx hardhat compile --force` (clean),
`npx hardhat test` → **129 passing, 0 failing**, `npx tsc --noEmit` (clean),
`git diff --check` (clean). The Phase-3 suite needed **no** economic change — its diff is
an additive, event-derived settlement-ledger breakdown (EQ-5); the audited
`authorizeWithdrawal` boundary at exactly 150% coverage and the
`SETTLEMENT − 49,960,000 + 47,961,600 + 95,923,200` conservation figure are unchanged.

Phase 5 stays blocked until explicitly requested.

*Document status: RESOLVED — Option C approved, implemented and verified (Phase 4 checkpoint).*
