use anchor_lang::prelude::*;
use crate::state::{Market, MarketFactory, MarketStatus, Outcome};
use crate::errors::OracleBetError;

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Market::MAX_SIZE,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Vault PDA — хранит SOL ставок, никогда не делегируется
    #[account(
        mut,
        seeds = [b"vault", market_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory.bump,
    )]
    pub factory: Account<'info, MarketFactory>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateMarket>,
    market_id: u64,
    question: String,
    resolution_price: i64,
    resolution_time: i64,
) -> Result<()> {
    require!(question.len() <= Market::MAX_QUESTION_LEN, OracleBetError::QuestionTooLong);
    require!(resolution_time > Clock::get()?.unix_timestamp, OracleBetError::InvalidResolutionTime);

    let market = &mut ctx.accounts.market;
    market.market_id = market_id;
    market.creator = ctx.accounts.creator.key();
    market.question = question;
    market.resolution_price = resolution_price;
    market.resolution_time = resolution_time;
    market.total_yes = 0;
    market.total_no = 0;
    market.status = MarketStatus::Open;
    market.outcome = Outcome::Unresolved;
    market.vault_bump = ctx.bumps.vault;
    market.bump = ctx.bumps.market;
    market.is_delegated = false;
    market.bets = Vec::new();

    let factory = &mut ctx.accounts.factory;
    factory.market_count += 1;

    Ok(())
}
