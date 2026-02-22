import React from "react";
import ReactDOM from "react-dom/client";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { Toaster } from "sonner";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { L1_RPC } from "./constants";
import "./styles/index.css";
import "@solana/wallet-adapter-react-ui/styles.css";

// Web runtime polyfill for Anchor/web3 codepaths that use Buffer.
if (!(globalThis as { Buffer?: typeof Buffer }).Buffer) {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

console.log("[BOOT] main.tsx loaded");
console.log("[BOOT] L1_RPC =", L1_RPC);

let wallets: (PhantomWalletAdapter | SolflareWalletAdapter)[] = [];
try {
  console.log("[BOOT] creating wallet adapters...");
  wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
  console.log("[BOOT] wallet adapters created OK");
} catch (e) {
  console.error("[BOOT] wallet adapter creation FAILED:", e);
}

console.log("[BOOT] calling ReactDOM.createRoot...");

const rootEl = document.getElementById("root");
console.log("[BOOT] #root element:", rootEl);

ReactDOM.createRoot(rootEl!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConnectionProvider endpoint={L1_RPC}>
        <WalletProvider
          wallets={wallets}
          autoConnect
          onError={(error) => {
            console.error("[WalletProvider] onError:", error);
          }}
        >
          <WalletModalProvider>
            <App />
            <Toaster
              position="top-right"
              theme="dark"
              toastOptions={{
                style: {
                  background: 'rgba(8,11,20,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#F8FAFC',
                },
              }}
            />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

console.log("[BOOT] render() called");
