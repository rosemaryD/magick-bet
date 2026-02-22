# MagickBet - Binary Prediction Market on MagicBlock

MagickBet is a Solana devnet prediction market demo built for hackathon submission.

The project uses a dual model:
- public market state on Solana L1 and standard ER delegation path
- private user positions (`PlayerBet`) delegated to TEE ER (PER path)

Program ID:
`BFv69p4dBZtPvDcUUnVBhiCCgAFVq5gpEWspnfmKxRKY`

## What Works Now

- `CreatePrivateBet` instruction
- `DelegatePrivateBet` instruction (CPI to `DELeGG...`)
- onchain delegation proof in explorer logs (`Program DELeGG... success`)
- single-screen demo UI flow in `app/src/App.tsx`
- source-aware price badge (`Pyth` preferred, `Binance` fallback, `Simulated` fallback)

## Current Demo Limits

- private-bet settlement and payout claim are not production-complete in this submission
- `place_bet` is kept as a legacy/experimental ER path and is not the primary demo flow

## Architecture

### Two-Layer Runtime
- Solana L1: market creation, vault, base settlement state
- MagicBlock ER/PER: delegated runtime for public market state and private user positions

### Main Instructions

| Instruction | Purpose |
|---|---|
| `initialize_factory` | initialize factory PDA |
| `create_market` | create market on L1 |
| `delegate_market` | delegate market PDA via `DELeGG` |
| `create_private_bet` | create private `PlayerBet` position |
| `delegate_private_bet` | delegate `PlayerBet` PDA to TEE validator |
| `place_bet` | legacy ER bet path (not primary demo flow) |
| `resolve_market` | resolve with oracle price and commit/undelegate |
| `claim_winnings` | L1 payout claim path |

## Tech Stack

- Rust + Anchor 0.32.0
- `ephemeral-rollups-sdk` v0.4.1
- React 18 + Vite 5 + TypeScript
- Solana Wallet Adapter (Phantom/Solflare)
- Oracle feed integration with fallback runtime strategy

## Quick Start

### Prerequisites
- Rust
- Solana CLI
- Anchor 0.32.0
- Node.js 18+
- funded devnet wallet

### Run Frontend Locally
```bash
cd oracle_bet/app
npm install
npm run dev
```

Local dev URL:
`http://localhost:5173`

This localhost URL is only for local development on your machine.

### Run Devnet Integration Test
```bash
cd oracle_bet
npx ts-node tests/devnet-integration.ts
```

## Demo Runbook (10-15 min)

1. Build checks:
```bash
cd oracle_bet
npm run smoke:all
```

2. Start UI:
```bash
cd oracle_bet/app
npm run dev
```

3. Demo checklist:
- wallet connected on devnet
- place private bet
- show explorer tx with `CreatePrivateBet` + `DelegatePrivateBet`
- show `DELeGG` program success in logs

## Runtime Price Strategy

- `LIVE`: Pyth stream
- `FALLBACK`: Binance stream/rest
- `SIM`: simulated local source

If Pyth stream is unavailable, the badge may show `Binance`.

## Project Structure

```text
oracle_bet/
|-- programs/oracle_bet/src/
|   |-- lib.rs
|   |-- errors.rs
|   |-- state/
|   |   |-- market.rs
|   |   |-- market_factory.rs
|   |   |-- player_bet.rs
|   |   `-- user_position.rs
|   `-- instructions/
|       |-- initialize_factory.rs
|       |-- create_market.rs
|       |-- delegate_market.rs
|       |-- create_private_bet.rs
|       |-- delegate_private_bet.rs
|       |-- place_bet.rs
|       |-- resolve_market.rs
|       `-- claim_winnings.rs
|-- app/
|   `-- src/
|-- tests/
|   |-- devnet-integration.ts
|   `-- README-devnet.md
`-- Anchor.toml
```

## Deployed Addresses (Devnet)

- Program: `BFv69p4dBZtPvDcUUnVBhiCCgAFVq5gpEWspnfmKxRKY`
- Delegation Program: `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`
- Pyth Lazer Storage: `3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL`

## Planned Next (Time-Limited)

- complete private-bet settlement pipeline (`PlayerBet` -> vault accounting -> claim)
- harden ER runtime edge cases (fee bootstrap, retries, monitoring)
