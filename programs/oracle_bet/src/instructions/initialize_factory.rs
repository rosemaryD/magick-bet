use anchor_lang::prelude::*;
use crate::state::MarketFactory;

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + MarketFactory::MAX_SIZE,
        seeds = [b"factory"],
        bump,
    )]
    pub factory: Account<'info, MarketFactory>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeFactory>) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    factory.authority = ctx.accounts.authority.key();
    factory.market_count = 0;
    factory.bump = ctx.bumps.factory;
    Ok(())
}
