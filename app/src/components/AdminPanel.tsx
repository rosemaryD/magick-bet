import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCreateMarket } from "../hooks/useCreateMarket";
import { useDelegateMarket } from "../hooks/useDelegateMarket";
import { LoadingSpinner } from "./LoadingSpinner";

export function AdminPanel() {
  // Legacy demo tool: this panel is intentionally not wired into the primary one-screen UX flow.
  const { publicKey } = useWallet();
  
  // Create Market form state
  const [question, setQuestion] = useState("Will SOL be above $200 in 5 minutes?");
  const [resolutionPrice, setResolutionPrice] = useState("200");
  const [resolutionMinutes, setResolutionMinutes] = useState("5");
  const [marketIdInput, setMarketIdInput] = useState("2");
  
  // Delegate form state
  const [delegateMarketId, setDelegateMarketId] = useState("1");
  
  const { createMarket, creating, txSig: createTx, error: createError } = useCreateMarket();
  const { delegateMarket, delegating, txSig: delegateTx, error: delegateError } = useDelegateMarket();

  if (!publicKey) {
    return (
      <div className="admin-panel admin-panel--locked">
        <h2>рџ”’ Admin Panel</h2>
        <p>Connect your wallet to access admin functions.</p>
      </div>
    );
  }

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    const marketId = BigInt(parseInt(marketIdInput));
    const resolutionPriceRaw = BigInt(Math.round(parseFloat(resolutionPrice) * 1_000_000_000));
    const resolutionTime = Math.floor(Date.now() / 1000) + parseInt(resolutionMinutes) * 60;
    
    await createMarket({
      marketId,
      question,
      resolutionPrice: resolutionPriceRaw,
      resolutionTime,
    });
  };

  const handleDelegateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    await delegateMarket(BigInt(parseInt(delegateMarketId)));
  };

  return (
    <div className="admin-panel">
      <h2>вљ™пёЏ Admin Panel</h2>
      <p className="admin-wallet">Wallet: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-4)}</p>

      {/* Create Market */}
      <section className="admin-section">
        <h3>рџ“Љ Create Market</h3>
        <form onSubmit={handleCreateMarket} className="admin-form">
          <div className="form-group">
            <label>Market ID</label>
            <input
              type="number"
              min="1"
              value={marketIdInput}
              onChange={(e) => setMarketIdInput(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="form-input"
              maxLength={200}
            />
          </div>
          <div className="form-group">
            <label>Resolution Price (USD)</label>
            <input
              type="number"
              step="0.01"
              value={resolutionPrice}
              onChange={(e) => setResolutionPrice(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Resolution in (minutes)</label>
            <input
              type="number"
              min="1"
              max="1440"
              value={resolutionMinutes}
              onChange={(e) => setResolutionMinutes(e.target.value)}
              className="form-input"
            />
          </div>
          {creating ? (
            <LoadingSpinner message="Creating market on L1..." />
          ) : (
            <button type="submit" className="btn btn-primary">
              Create Market
            </button>
          )}
          {createError && <p className="error-text">{createError}</p>}
          {createTx && <p className="success-text">вњ… Market created! TX: {createTx.slice(0, 12)}...</p>}
        </form>
      </section>

      {/* Delegate Market */}
      <section className="admin-section">
        <h3>вљЎ Delegate to ER</h3>
        <p className="admin-hint">Delegates Market PDA to ER (locks betting, enables ER resolution)</p>
        <form onSubmit={handleDelegateMarket} className="admin-form">
          <div className="form-group">
            <label>Market ID to delegate</label>
            <input
              type="number"
              min="1"
              value={delegateMarketId}
              onChange={(e) => setDelegateMarketId(e.target.value)}
              className="form-input"
            />
          </div>
          {delegating ? (
            <LoadingSpinner message="Delegating to Ephemeral Rollup..." />
          ) : (
            <button type="submit" className="btn btn-er">
              вљЎ Delegate to ER
            </button>
          )}
          {delegateError && <p className="error-text">{delegateError}</p>}
          {delegateTx && <p className="success-text">вњ… Delegated! TX: {delegateTx.slice(0, 12)}...</p>}
        </form>
      </section>
    </div>
  );
}

