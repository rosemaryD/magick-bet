use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod errors;
pub mod instructions;
pub mod state;

pub use errors::OracleBetError;

use instructions::*;

declare_id!("BFv69p4dBZtPvDcUUnVBhiCCgAFVq5gpEWspnfmKxRKY");

#[ephemeral]
#[program]
pub mod oracle_bet {
    use super::*;

    // L1 Instructions

    pub fn initialize_factory(ctx: Context<InitializeFactory>) -> Result<()> {
        instructions::initialize_factory::handler(ctx)
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        market_id: u64,
        question: String,
        resolution_price: i64,
        resolution_time: i64,
    ) -> Result<()> {
        instructions::create_market::handler(ctx, market_id, question, resolution_price, resolution_time)
    }

    pub fn delegate_market(ctx: Context<DelegateMarket>, market_id: u64) -> Result<()> {
        instructions::delegate_market::handler(ctx, market_id)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>, market_id: u64) -> Result<()> {
        instructions::claim_winnings::handler(ctx, market_id)
    }

    // ER Instructions (выполняются в Ephemeral Rollup)

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        market_id: u64,
        side: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::place_bet::handler(ctx, market_id, side, amount)
    }

    pub fn create_private_bet(
        ctx: Context<CreatePrivateBet>,
        market_id: u64,
        side: u8,
        amount: u64,
    ) -> Result<()> {
        instructions::create_private_bet::handler(ctx, market_id, side, amount)
    }

    pub fn delegate_private_bet(ctx: Context<DelegatePrivateBet>, market_id: u64) -> Result<()> {
        instructions::delegate_private_bet::handler(ctx, market_id)
    }

    pub fn resolve_market(ctx: Context<ResolveMarket>, market_id: u64) -> Result<()> {
        instructions::resolve_market::handler(ctx, market_id)
    }
}
