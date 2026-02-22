import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  return (
    <div className="wallet-button-wrapper">
      <WalletMultiButton />
    </div>
  );
}
