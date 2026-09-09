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

// Recover from transient dynamic-import (chunk load) failures by reloading once.
// These happen when Vite/HMR aborts a module fetch mid-flight (often during the
// wallet-extension error storm) and would otherwise leave a blank screen.
const handleChunkLoadFailure = (msg: string) => {
  if (!msg) return;
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  ) {
    const key = '__chunk_reload_attempted__';
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      window.location.reload();
    }
  }
};
window.addEventListener('error', (e) => {
  handleChunkLoadFailure(e?.message || String(e?.error || ''));
});
window.addEventListener('unhandledrejection', (e) => {
  handleChunkLoadFailure((e?.reason?.message || String(e?.reason || '')));
});
// Clear the guard once the app has successfully mounted.
window.addEventListener('load', () => {
  setTimeout(() => sessionStorage.removeItem('__chunk_reload_attempted__'), 2000);
});

createRoot(document.getElementById("root")!).render(<App />);
