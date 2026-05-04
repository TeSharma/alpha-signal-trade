# Liquidator Keeper Bot — Detailed Plan

## What it is

A standalone Node.js worker (separate repo, **not** part of this Vite app) that:

1. Watches every open position in `TradingPlatformV2`.
2. Polls the Chainlink-backed `PriceOracleV2` for current prices.
3. Computes each position's equity = `margin + unrealizedPnL` against the contract's `maintenanceMarginBps` (currently 1000 bps = 10%).
4. When equity falls below maintenance margin, sends a `liquidate(positionId)` tx and earns the `liquidatorRewardBps` (currently 30%) of the remaining margin.

This is the same role MEV searchers play on Aave / GMX / Hyperliquid. Without one, the **protocol is the loser of last resort** — underwater positions bleed past their maintenance buffer and the contract becomes insolvent (treasury covers the gap).

---

## Why we need it

### Current state (no keeper)

- `TradingPlatformV2.liquidate(positionId)` exists and is `external` — **anyone** can call it.
- In production we have **zero callers**. Positions that should liquidate at 10% margin can decay to 0% and beyond.
- The contract has `maxProfitBps = 30000` (300% cap) but no symmetric floor on losses below maintenance — once equity goes negative, the close path returns 0 and the user keeps their (negative) PnL on the protocol's books.
- This is fine on Amoy testnet (play money). On mainnet it is an **existential risk**.

### After keeper

- Positions are closed at exactly maintenance margin (or as close as block-time allows).
- The 30% liquidator reward funds the bot's gas + a small profit margin.
- Protocol solvency is preserved; treasury never has to cover bad debt.
- Users get a deterministic liquidation experience instead of "I logged in and my position vanished mysteriously."

### How it improves our **proposed goals**

| Goal | Without keeper | With keeper |
|---|---|---|
| Mainnet launch | Cannot launch safely | Required precondition ✅ |
| Higher leverage tiers (50x) | Too risky | Safe — fast liquidation enforces margin |
| Onboarding non-crypto users | Bad debt erodes treasury silently | Predictable risk model |
| Listing more crypto pairs | Each new pair multiplies insolvency risk | Risk scales linearly, not exponentially |
| Future Pyth/forex execution | Blocked — forex moves fast on news, manual liquidation impossible | Bot handles 24/5 forex liquidations automatically |

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Keeper Bot (separate repo: alpha-signal-keeper)           │
│  ──────────────────────────────────────────────────────    │
│  • Node 20 + ethers v6 + pino (structured logs)            │
│  • Hosted on Fly.io / Railway / a small VPS (~$5/mo)       │
│  • Funded hot wallet (0.5 POL float, auto-refill alert)    │
└──────────┬─────────────────────────────────────────────────┘
           │
           │ 1. eth_getLogs every block (or WS subscription)
           │    → track PositionOpened / PositionClosed / PositionModified
           │
           ▼
┌────────────────────────────────────────────────────────────┐
│  In-memory position cache (Map<positionId, Position>)      │
│  • Persisted to Redis (optional) for restart resilience    │
└──────────┬─────────────────────────────────────────────────┘
           │
           │ 2. Every block (~2s on Polygon):
           │    a. Multicall PriceOracleV2.getPrice(pairId) for active pairs
           │    b. For each cached position, compute equity off-chain
           │    c. If equity ≤ maintenance threshold → enqueue liquidation
           │
           ▼
┌────────────────────────────────────────────────────────────┐
│  Liquidation queue (priority = how-underwater)             │
│  • Sends `liquidate(positionId)` with EIP-1559 fees        │
│  • Bumps gas if pending > 30s (private mempool optional)   │
│  • Confirms → emits structured log + Discord/Slack alert   │
└────────────────────────────────────────────────────────────┘
```

### Why off-chain equity calc

The contract's `getPositionEquity(positionId)` view exists but costs an RPC call per position. With 1k+ positions on mainnet this would burn rate limits in seconds. We replicate the formula off-chain (pure math, deterministic) and only spend RPC budget on the **prices** (~1 multicall per block). Final on-chain `liquidate(...)` re-checks atomically — no race condition.

---

## File / module breakdown (keeper repo)

```
alpha-signal-keeper/
├── src/
│   ├── index.ts              # entrypoint, graceful shutdown
│   ├── config.ts             # RPC URLs, contract addrs, wallet PK from env
│   ├── chain/
│   │   ├── provider.ts       # ethers provider with WS + HTTP fallback
│   │   ├── contracts.ts      # typed TradingPlatformV2 + PriceOracleV2
│   │   └── multicall.ts      # batched price reads
│   ├── state/
│   │   ├── positions.ts      # cache + log indexer (rebuild from chain on cold start)
│   │   └── prices.ts         # latest price per pairId
│   ├── engine/
│   │   ├── equity.ts         # off-chain PnL/equity formula (mirrors contract)
│   │   ├── scanner.ts        # per-block sweep → liquidation candidates
│   │   └── executor.ts       # sends + monitors liquidate() txs
│   ├── ops/
│   │   ├── alerts.ts         # Discord webhook on liquidations / errors / low gas
│   │   └── metrics.ts        # Prometheus /metrics endpoint
│   └── utils/logger.ts
├── test/
│   ├── equity.test.ts        # property tests vs contract math
│   └── scanner.test.ts       # mocked-chain end-to-end
├── Dockerfile
├── fly.toml                  # or railway.json
├── .env.example
└── README.md
```

**~800–1200 LOC.** Boring on purpose.

---

## Build phases

| Phase | Effort | Deliverable |
|---|---|---|
| **1. Skeleton + chain reads** | 0.5 day | Connect to Amoy, subscribe to events, log every PositionOpened |
| **2. Position cache + cold-start rebuild** | 0.5 day | Restart-safe; rebuilds from chain history in < 30s |
| **3. Off-chain equity engine + tests** | 1 day | Property tests vs Solidity math (run forge fuzz against same inputs) |
| **4. Scanner + dry-run mode** | 0.5 day | Logs "would liquidate position X" without sending tx |
| **5. Executor (real txs on Amoy)** | 1 day | End-to-end liquidation on testnet with bumping/retry |
| **6. Ops: alerts, metrics, Docker** | 0.5 day | Discord pings, Prometheus, deployable image |
| **7. Mainnet shadow run (1 week)** | passive | Run in dry-run on mainnet, compare to manual checks |
| **8. Mainnet go-live** | flip flag | Switch dry-run off, announce in Discord |

**Total active engineering: 4–4.5 days.** Plus 1 week passive shadow before flipping the switch.

---

## Operational considerations

### Hot wallet funding

- Bot holds **only enough POL for ~1 week of gas** (~5 POL initially). Never the protocol treasury.
- Liquidation rewards (the 30% bps) are sent to a **separate cold collection address**, not the hot wallet — only the gas float stays hot.
- Alert fires when hot wallet < 1 POL.

### Failure modes & mitigations

| Failure | Mitigation |
|---|---|
| RPC down | Multi-provider fallback (Alchemy primary, public Polygon RPC secondary) |
| Bot crashes mid-tx | On restart, replays mempool — idempotent because contract state determines outcome |
| Price oracle stalls | Bot does NOT liquidate if `oracle.updatedAt` > 60s old — prevents wrongful liquidations on stale data (matches contract's own staleness check) |
| Gas spike | EIP-1559 cap on `maxFeePerGas` — bot waits rather than overpays during congestion |
| Two keepers race for same position | Loser's tx reverts (position already closed) — wasted gas, not a safety issue |
| Hot wallet key compromised | Cold collection wallet is unaffected; rotate keeper key, keeper has no admin role on contract |

### Permissions

- The keeper wallet has **zero special privileges** on `TradingPlatformV2`. `liquidate(...)` is permissionless by design. This is critical — if the keeper bot disappears, anyone in the world can step in and earn the 30% reward. The protocol survives without us.

### Cost model (mainnet, 100 active positions, normal volatility)

- ~5 liquidations/week average
- Gas per liquidation: ~150k @ 50 gwei = ~0.0075 POL ≈ $0.005
- Reward per liquidation (avg position margin $50, 30% of remaining): ~$3
- Net: bot is **profit-positive** at scale. We can later open-source it and let third-party keepers run too.

---

## How the keeper interacts with the rest of the roadmap

- **ERC-4337 gasless trading (next phase):** Independent. Users get gasless trades; keeper still uses normal txs (it's a bot, not a UX surface).
- **Pyth forex oracle:** Keeper picks up forex pairs automatically once the new `IPriceOracleV2` adapter is live. Forex-aware staleness check (Pyth updates on demand) added in keeper config.
- **XAU/USD live trading:** Same as above — keeper is oracle-agnostic, it just reads `PriceOracleV2.getPrice(pairId)`.

---

## Decision needed

1. **Hosting:** Fly.io (recommended — free tier covers it, easy deploy) vs Railway vs your own VPS.
2. **Repo location:** New separate GitHub repo (recommended — different lifecycle, different secrets) vs subdirectory of this project.
3. **Reward collection wallet:** Use existing treasury (`0x09C2B58F6004176bD83cc000d804eD3c1041754E`) or generate a fresh one for liquidation rewards only?

Once you confirm those three, we can scaffold the keeper repo and start phase 1.
