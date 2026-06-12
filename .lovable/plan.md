# Improve MetaMask connection error handling

## Diagnosis
The error `Failed to connect to MetaMask` (caused by `MetaMask extension not found`) comes from MetaMask's own injected script — the page-side provider can't reach the extension's background process. Causes are outside the app: a stale/crashed MetaMask service worker, or testing inside the Lovable preview iframe where extensions can't complete the handshake.

## User actions (no code)
1. Click the MetaMask icon and unlock it manually
2. Reload MetaMask in `chrome://extensions`, or restart the browser
3. Test wallet connection on the published URL (https://alpha-signal-trade.lovable.app) instead of the preview

## App-side improvements
1. **Detect this specific failure in `useWallet.connectWallet`** — catch errors whose message includes "Failed to connect to MetaMask" / "extension not found" and show a clear toast: "MetaMask isn't responding. Open the MetaMask extension, unlock it, then try again. If you're in the Lovable preview, use the published site."
2. **Detect iframe context** — if `window.self !== window.top`, show a hint near the Connect Wallet button that wallet connections work best on the published site, with a link.
3. **Add a retry path** — after the failure toast, keep the button enabled so the user can retry immediately once MetaMask is awake.

## Technical details
- Files: `src/hooks/useWallet.ts` (error classification + toasts), `src/components/wallet/WalletConnectButton.tsx` (iframe hint + retry UX)
- No backend, contract, or config changes
