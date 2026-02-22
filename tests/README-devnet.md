# OracleBet DevNet Integration Test

Standalone TypeScript script for validating the full OracleBet ER roundtrip on Solana devnet.

## Prerequisites

- `oracle_bet/wallet.json` with at least `0.5 SOL` on devnet
- OracleBet program deployed: `BFv69p4dBZtPvDcUUnVBhiCCgAFVq5gpEWspnfmKxRKY`

```bash
cd oracle_bet
npm install
```

## Run

```bash
cd oracle_bet
npm run smoke:devnet
```

## What gets tested

| Step | Instruction / Action | Network | Description |
|---|---|---|---|
| 1 | `initialize_factory` | L1 | Creates `MarketFactory` PDA (`["factory"]`) if missing |
| 2 | `create_market` | L1 | Creates `Market` + `Vault` for a fresh auto-generated `market_id` |
| 3 | `place_bet` | L1 | Sends user bet and funds vault on base layer |
| 4 | `delegate_market` | L1 -> ER | Delegates `Market` PDA into ER |
| 4.5 | `bootstrap_er_fee` | L1 | Prepares ER fee escrow via `top_up_ephemeral_balance` + `delegate_ephemeral_balance` |
| 5 | `resolve_market` | ER -> L1 | Resolves in ER and waits for `commit_and_undelegate` sync on L1 |
| 6 | `claim_winnings` | L1 | Attempts payout claim on L1 |

## PDA map

| Account | Seeds | Program |
|---|---|---|
| `MarketFactory` | `["factory"]` | `oracle_bet` |
| `Market` | `["market", market_id_le_bytes]` | `oracle_bet` |
| `Vault` | `["vault", market_id_le_bytes]` | `oracle_bet` |
| `Market Buffer` | `["buffer", market_pubkey]` | `oracle_bet` |
| `Market DelegationRecord` | `["delegation", market_pubkey]` | `delegation_program` |
| `Market DelegationMetadata` | `["delegation-metadata", market_pubkey]` | `delegation_program` |
| `Escrow` | `["balance", wallet_pubkey, index]` | `delegation_program` |
| `Escrow Buffer` | `["buffer", escrow_pubkey]` | `system_program` |
| `Escrow DelegationRecord` | `["delegation", escrow_pubkey]` | `delegation_program` |
| `Escrow DelegationMetadata` | `["delegation-metadata", escrow_pubkey]` | `delegation_program` |
| `MagicContext` | fixed address `MagicContext1111111111111111111111111111111` | `magic_program` |

## Default parameters

- `market_id`: auto-generated per run (`Date.now()`)
- `resolution_time`: now + 120s
- `bet_amount`: `0.05 SOL`
- `bet_side`: `YES`
- ER fee bootstrap:
  - `ER_ESCROW_INDEX = 0`
  - `ER_MIN_ESCROW_LAMPORTS = 5_000_000`
  - `ER_DELEGATE_COMMIT_FREQUENCY_MS = 0`

## Re-run behavior

- Fresh `market_id` is generated every run, so manual increment is not required.
- Escrow bootstrap is idempotent:
  - top-up happens only if escrow balance is below threshold;
  - escrow delegation is skipped if already delegated.

## Troubleshooting

### `InvalidAccountForFee`
ER fee escrow is missing or not delegated. Ensure Step `4.5` succeeds.

### `ResolutionTimeNotReached`
`resolve_market` was called too early. Wait until timer expires.

### `Unauthorized`
Resolver wallet must match market creator wallet.

### `MarketNotResolved` on claim
L1 sync may still be in progress. Wait and rerun claim.

## Network endpoints

- L1: `https://api.devnet.solana.com`
- ER: `https://devnet.magicblock.app`
