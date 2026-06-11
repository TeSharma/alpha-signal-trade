# Plan: Performance Optimizations + Remove Hedera

## Part A — Remove Hedera from the app

Hedera is only referenced in a handful of frontend files and isn't pulled from npm, so removal is purely a cleanup.

**Delete**
- `src/lib/hedera.ts`
- `src/hooks/useHederaWallet.ts`
- `src/components/wallet/HederaWalletConnect.tsx`
- `TOKENIZATION_DEPLOYMENT.md` (Hedera-specific deployment doc)

**Edit**
- `src/pages/Wallet.tsx` — remove `HederaWalletConnect` import and its "Hedera Network" section.
- `src/components/wallet/MobileWallet.tsx` — same removal.
- `mem://index.md` and related memory files — drop Hedera entries (multi-chain strategy, Hedera config, currency tokenization Hedera notes) so future sessions don't reintroduce it.

No backend, contracts, or trading logic changes. Polygon (live) and Tron (funding bridge) remain untouched.

## Part B — Performance improvements

Goal: shrink the initial JS payload for `/` and `/login`, defer heavy modules until needed, and cache vendor code across deploys. No visual changes.

### 1. Lazy-load all routes (`src/App.tsx`)
Convert page imports to `React.lazy` and wrap `<Routes>` in `<Suspense fallback={...}>`. Keep `Index` and `Login` eager (the most common landing routes) or lazy-load everything — both fine; default to lazy-loading everything except `Index`.

### 2. Scope `MarketDataProvider` to authenticated routes
Currently wraps the whole app, so `/` and `/login` pay for `crypto-prices` / `forex-prices` edge calls. Move it down so it only wraps `Dashboard`, `Trade`, `Signals` (via a small `<MarketRoutes>` layout component or by wrapping each route element).

### 3. Vite `manualChunks` (`vite.config.ts`)
Split vendor bundles for long-term caching:
```text
react        -> react, react-dom, react-router-dom
supabase     -> @supabase/*
web3         -> ethers, tronweb, @walletconnect/*
ui           -> @radix-ui/*, lucide-react
charts       -> recharts, lightweight-charts (if present)
```

### 4. Dynamic-import Web3 in wallet components
`src/lib/web3.js` and Tron imports become `await import(...)` inside connect handlers / `useEffect`s, so `ethers` and `tronweb` aren't in the landing bundle.

### 5. Defer TradingView widget
Only mount `TradingViewChart` once the chart tab/section is visible (intersection observer or tab activation). Script tag injected on mount only.

### 6. `index.html` hints
- `<link rel="preconnect" href="https://trbgjsurjfubezcdzpao.supabase.co" crossorigin>`
- `font-display: swap` if any custom fonts use `@font-face`.

### 7. AuthGuard fallback
Only render the full-screen spinner on protected routes (it already does, but verify there's no global blocking spinner during session bootstrap on `/`).

## Out of scope
- No UI redesign, no contract changes, no Supabase schema changes.
- Tron and Polygon stay.
- No new dependencies.

## Expected impact
- Landing/login JS payload ~60–75% smaller.
- Vendor chunks cached across deploys → faster repeat visits.
- Authenticated pages load Web3 + market data on demand.
