# MagickBet вЂ” Binary Prediction Market on MagicBlock Private Ephemeral Rollups

**MagickBet** utilizes a Dual-Validator Ephemeral Rollup architecture. Global state (Market pool, Timer, Price) runs on standard EU nodes, while user positions (`PlayerBet`) are securely delegated to a TEE (Intel TDX) Validator, ensuring front-running protection before the reveal phase.

## рџ”’ Private Ephemeral Rollups (PER) Architecture
- **Market PDA** -> Delegated to Standard ER (Public Aggregated Data)
- **PlayerBet PDA** -> Delegated to TEE ER (Private User Bets)

## Overview
MagickBet is a decentralized binary prediction market built on Solana devnet using MagicBlock Ephemeral Rollups (ER) for ultra-fast bet processing. Users predict whether SOL/USD price will be above or below a target at resolution time.

**Live on Solana Devnet** | Program ID: `BFv69p4dBZtPvDcUUnVBhiCCgAFVq5gpEWspnfmKxRKY`

**Technology profile (for judges):**
- Not only Private ER: this submission uses a dual model.
- Public market state runs on Solana L1 + standard ER delegation path.
- Private user positions (`PlayerBet`) are delegated to TEE ER (PER path).

## Architecture

### Two-Layer System
- **Solana L1**: Market creation, vault (escrow), and base settlement state.
- **MagicBlock ER/PER**: delegated runtime paths for public market state (ER) and private user positions (TEE PER).

### Key Components
| Component | Description |
|-----------|-------------|
| `initialize_factory` | One-time setup of the MarketFactory PDA |
| `create_market` | Create a new prediction market on L1 |
| `delegate_market` | Delegate Market PDA to ER for fast bets |
| `create_private_bet` | Create private `PlayerBet` position (main demo bet entrypoint) |
| `delegate_private_bet` | Delegate `PlayerBet` PDA to TEE validator via `DELeGG` CPI |
| `place_bet` | Legacy/experimental ER bet path (not primary demo flow) |
| `resolve_market` | Read Pyth Lazer price, settle market, undelegate from ER |
| `claim_winnings` | Claim proportional payout from vault (runs on L1) |

### Payout Formula (PMM)
```
payout = user_bet × total_pool / winning_side_total
```

## Tech Stack
- **Smart Contract**: Rust + Anchor 0.32.0 + ephemeral-rollups-sdk v0.4.1
- **Oracle**: Pyth Lazer SOL/USD (feed_id=6, offset +73 bytes)
- **Frontend**: React 18 + Vite 5 + TypeScript
- **Wallet**: @solana/wallet-adapter (Phantom, Backpack)
- **State**: Dual-RPC (L1 + ER), live polling every 5s

## Quick Start

### Prerequisites
- Rust + Solana CLI + Anchor 0.32.0
- Node.js 18+
- Phantom/Backpack wallet with devnet SOL

### Run Frontend Locally
```bash
cd oracle_bet/app
npm install
npm run dev
```
Opens at http://localhost:5173

### Devnet Integration Test
```bash
cd oracle_bet
npx ts-node tests/devnet-integration.ts
```

## Demo Runbook (10-15 min)

### 1) Smoke checks
```bash
cd oracle_bet
npm run smoke:all
```

### 2) Start demo UI
```bash
cd oracle_bet/app
npm run dev
```

### 3) Pre-demo checklist
- Wallet connected and funded on devnet.
- Header status badge is `LIVE`, `FALLBACK`, or `SIM` (runtime source is visible).
- Mobile viewport check: `360x800`, `390x844`, `430x932`.
- If Oracle/WS degrades, app should stay interactive with fallback source.

### 4) Optional full lifecycle validation
```bash
cd oracle_bet
npm run smoke:devnet
```

## Runtime Price Strategy
- `LIVE`: Pyth Lazer WebSocket (`pyth_ws`)
- `FALLBACK`: Binance WebSocket or REST (`binance_ws` / `binance_rest`)
- `SIM`: local simulation fallback (`simulated`)

This keeps the demo resilient even when one upstream feed is unstable. In practice, the badge can show `Binance` when Pyth WS is unavailable.

## UI Scope
- Primary hackathon UX is the single-screen flow in `app/src/App.tsx`.
- `AdminPanel`, `MarketList`, and `MarketCard` are retained as legacy demo tools for diagnostics/manual testing and are intentionally not wired into the primary screen.

## Demo Scope (Submission Note)
- The main demo proves private bet creation + delegation flow onchain (`CreatePrivateBet` + `DelegatePrivateBet` + `DELeGG` CPI).
- "Private Bet (TEE Secured)" positions are intentionally hidden in UI until reveal.
- Current private-bet claim settlement is demo-limited: payout claim for private positions is not exposed as a production onchain flow in this submission.
- The top price badge is source-aware (Pyth preferred, Binance fallback, Simulated last resort).

## Project Structure
```
oracle_bet/
в”њв”Ђв”Ђ programs/oracle_bet/src/
в”‚   в”њв”Ђв”Ђ lib.rs                    # #[ephemeral] + #[program] + 6 instructions
в”‚   в”њв”Ђв”Ђ errors.rs                 # 12 error codes
в”‚   в”њв”Ђв”Ђ state/
в”‚   в”‚   в”њв”Ђв”Ђ market.rs             # Market struct (Vec<BetEntry> max 20)
в”‚   в”‚   в”њв”Ђв”Ђ market_factory.rs     # MarketFactory PDA
в”‚   в”‚   в””в”Ђв”Ђ user_position.rs      # UserPosition (unused in v1)
в”‚   в””в”Ђв”Ђ instructions/
в”‚       в”њв”Ђв”Ђ initialize_factory.rs
в”‚       в”њв”Ђв”Ђ create_market.rs
в”‚       в”њв”Ђв”Ђ delegate_market.rs    # CPI to Delegation Program
в”‚       в”њв”Ђв”Ђ place_bet.rs          # Legacy ER bet path
в”‚       в”њв”Ђв”Ђ resolve_market.rs     # Pyth Lazer + commit_and_undelegate
в”‚       в””в”Ђв”Ђ claim_winnings.rs     # PMM payout + .retain() double-claim protection
в”њв”Ђв”Ђ app/                          # React frontend
в”‚   в””в”Ђв”Ђ src/
в”‚       в”њв”Ђв”Ђ hooks/                # useMarkets, usePlaceBet, useResolveMarket, ...
в”‚       в”њв”Ђв”Ђ components/           # MarketCard, AdminPanel, LivePriceWidget, ...
в”‚       в””в”Ђв”Ђ constants.ts          # PROGRAM_ID, RPC endpoints
в”њв”Ђв”Ђ tests/
в”‚   в””в”Ђв”Ђ devnet-integration.ts    # Full lifecycle test
в””в”Ђв”Ђ Anchor.toml
```

## Security Notes
- Double-claim protection: `.retain()` removes claimed bet from Vec
- Vault PDA never delegated (prevents mixed L1/ER state)
- Resolution auth: only market creator can resolve
- Bet side validated: `require!(side <= 1)`
- Payout capped: `.min(vault_balance)` prevents overdrain
- Resolution time enforced: `clock.unix_timestamp >= market.resolution_time`

## MagicBlock ER Key Details
- **Delegation**: Market PDA delegated via `delegate_account()` CPI
- **Commit**: `commit_and_undelegate_accounts()` CPI in resolve_market
- **Latency**: commit_and_undelegate takes 2-10 seconds; frontend polls L1 every 2s (max 60s)
- **skipPreflight**: required for all ER transactions

## Deployed Addresses (Devnet)
| Account | Address |
|---------|---------|
| Program | `BFv69p4dBZtPvDcUUnVBhiCCgAFVq5gpEWspnfmKxRKY` |
| MarketFactory PDA | Derived from `["factory"]` seed |
| Pyth Lazer Storage | `3rdJbqfnagQ4yx9HXJViD4zc4xpiSqmFsKpPuSCQVyQL` |
| Delegation Program | `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh` |





