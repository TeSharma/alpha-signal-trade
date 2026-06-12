import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Swallow unhandled promise rejections originating from injected wallet extensions
// (MetaMask, Phantom, etc.). Their auto-connect attempts can otherwise blank the screen.
window.addEventListener('unhandledrejection', (event) => {
  const reason: any = event.reason;
  const message = (reason?.message || String(reason || '')).toLowerCase();
  const stack = (reason?.stack || '').toLowerCase();

  const isWalletExtensionError =
    stack.includes('chrome-extension://') ||
    stack.includes('moz-extension://') ||
    stack.includes('inpage.js') ||
    message.includes('failed to connect to metamask') ||
    message.includes('user rejected') ||
    message.includes('metamask') ||
    message.includes('phantom');

  if (isWalletExtensionError) {
    console.warn('[wallet-extension] suppressed:', reason);
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
