import React, { useState } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { MarketData } from "../hooks/useMarkets";
import { usePlaceBet, BetSide } from "../hooks/usePlaceBet";
import { LoadingSpinner } from "./LoadingSpinner";
import { PROGRAM_ID } from "../constants";

interface BetFormProps {
  market: MarketData;
  onClose: () => void;
  onSuccess: () => void;
}

function deriveVaultPda(marketId: bigint): PublicKey {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(marketId, 0);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), idBuf],
    PROGRAM_ID
  );
  return pda;
}

export function BetForm({ market, onClose, onSuccess }: BetFormProps) {
  const [side, setSide] = useState<BetSide>(0);
  const [amount, setAmount] = useState("0.1");
  const { placeBet, placing, txSig, error } = usePlaceBet();
  const betLocked = market.status !== "Open" || market.isDelegated;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (betLocked) {
      return;
    }
    const amountLamports = BigInt(Math.round(parseFloat(amount) * LAMPORTS_PER_SOL));
    const vaultPda = deriveVaultPda(market.marketId);
    await placeBet({
      marketId: market.marketId,
      marketPda: market.publicKey,
      vaultPda,
      side,
      amountLamports,
    });
  };

  // When txSig appears, trigger success after a tick
  React.useEffect(() => {
    if (txSig) {
      const t = setTimeout(onSuccess, 500);
      return () => clearTimeout(t);
    }
  }, [txSig, onSuccess]);

  return (
    <div className="bet-form-overlay" onClick={onClose}>
      <div className="bet-form" onClick={(e) => e.stopPropagation()}>
        <h3>Place Bet</h3>
        <p className="bet-form__question">{market.question}</p>
        <p className="bet-form__note">This action runs on L1 and is available only before delegation.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Side</label>
            <div className="side-buttons">
              <button
                type="button"
                className={`side-btn side-btn--yes${side === 0 ? " active" : ""}`}
                onClick={() => setSide(0)}
                disabled={betLocked}
              >
                YES
              </button>
              <button
                type="button"
                className={`side-btn side-btn--no${side === 1 ? " active" : ""}`}
                onClick={() => setSide(1)}
                disabled={betLocked}
              >
                NO
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Amount (SOL)</label>
            <input
              type="number"
              min="0.001"
              max="10"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="form-input"
              disabled={betLocked}
            />
          </div>

          {placing ? (
            <LoadingSpinner message="Sending bet on L1..." />
          ) : (
            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={betLocked}>
                Confirm Bet
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          )}

          {betLocked && (<p className="error-text">Betting is available only for open, non-delegated markets.</p>)}
          {error && <p className="error-text">{error}</p>}
          {txSig && (
            <p className="success-text">
              вњ… Bet placed! TX: {txSig.slice(0, 8)}...
            </p>
          )}
        </form>
      </div>
    </div>
  );
}


