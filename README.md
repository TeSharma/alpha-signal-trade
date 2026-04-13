#                           Shtraders (Alpha-Signal-Trade) 

Shtraders is an AI powered decentralized trading platform that combines real time market analysis, automated signal generation, and integrated trade execution.

It is designed to bridge the gap between traditional trading platforms and Web3 by providing intelligent, data driven trading decisions with seamless execution.

---

## Overview

Shtraders enables users to:

* Receive AI generated trading signals (Forex & Crypto)
* Execute trades directly through an integrated trading engine
* Validate manual trades using AI confirmation
* Manage portfolios with real time balance tracking
* Automate signal generation with scheduled AI pipelines

---

## Core Features

### 1. AI Signal Generation Engine

* Multi step pipeline (Market Data → Analysis → AI → Validation)
* Supports Forex & Crypto markets
* Uses technical indicators (RSI, ATR, Trend detection)
* Enforces:

  * Minimum Risk/Reward ratio (≥ 2.0)
  * Confidence thresholds
  * Market condition filters

---

### 2. Smart Signal Filtering

* Eliminates low quality or choppy market signals
* Ensures trend alignment
* Adaptive learning using historical performance

---

### 3. Trade Execution System

* Execute trades directly from signals
* Integrated with wallet infrastructure
* Supports:

  * Manual execution
  * AI assisted confirmation

---

### 4. AI Trade Confirmation

Users can submit their own trades and receive:

*  Validation (Good trade)
*  Warning (Risky trade)
*  Rejection (Invalid setup)

---

### 5. Automated Signal Scheduling

* Runs every 15 minutes using Supabase Edge Functions
* Covers multiple trading pairs:

  * BTC/USD
  * ETH/USD
  * POL/USD
  * EUR/USD
  * GBP/USD
  * USD/JPY

---

### 6. Portfolio & Risk Management

* Real time balance tracking
* Demo & live trading modes
* Risk level classification (Low / Moderate / High)

---

##  Architecture

### Backend

* Supabase (PostgreSQL, Auth, Edge Functions)
* AI Gateway (structured tool calling)
* Cron jobs via `pg_cron`

### Frontend

* React + TypeScript
* Real time UI updates
* Trading dashboard interface

### AI Pipeline

Market Data → Technical Analysis → AI Generation → Validation → Risk Management → Database

---

##  Edge Functions

### `generate-signal`

* Generates AI trading signals
* Runs manually or via scheduled cron
* Inserts validated signals into database

### `confirm-trade`

* Validates user submitted trades
* Returns AI confidence and recommendation

---

##  Database (Core Tables)

* `trading_signals` — Stores all AI generated signals
* `signal_performances` — Tracks win rate & strategy performance
* `trades` — Executed trades
* `account_balances` — User portfolio data

---

##  Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/TeSharma/alpha-signal-trade.git
cd alpha-signal-trade
```

### 2. Install dependencies

```bash
npm install
```

### 3. Setup environment variables

Create `.env`:

```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_api_key
```

---

### 4. Run locally

```bash
npm run dev
```

---

### 5. Deploy Edge Functions

```bash
supabase functions deploy generate-signal
supabase functions deploy confirm-trade
```

---

### 6. Run database migrations

```bash
supabase db push
```

---

##  License

MIT License

---

##  Author

**Sharma**
tesharma2@gmail.com
Forex Trader • AI Builder • Web3 Developer

---

##  Vision

To build the next generation of trading platforms where:

> AI doesn't just suggest trades — it executes and manages them intelligently.

