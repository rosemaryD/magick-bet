use anchor_lang::prelude::*;
use crate::state::PlayerBet;

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreatePrivateBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + PlayerBet::MAX_SIZE,
        seeds = [b"bet", market_id.to_le_bytes().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub player_bet: Account<'info, PlayerBet>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreatePrivateBet>, market_id: u64, side: u8, amount: u64) -> Result<()> {
    require!(side <= 1, CreatePrivateBetError::InvalidSide);
    require!(amount > 0, CreatePrivateBetError::InvalidAmount);

    let player_bet = &mut ctx.accounts.player_bet;
    player_bet.market_id = market_id;
    player_bet.player = ctx.accounts.payer.key();
    player_bet.side = side;
    player_bet.amount = amount;
    player_bet.bump = ctx.bumps.player_bet;

    Ok(())
}

#[error_code]
pub enum CreatePrivateBetError {
    #[msg("Side must be 0 (YES) or 1 (NO)")]
    InvalidSide,
    #[msg("Amount must be greater than 0")]
    InvalidAmount,
}
