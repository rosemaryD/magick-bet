use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Market, MarketStatus, BetEntry};
use crate::errors::OracleBetError;

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Vault PDA принимает SOL
    #[account(
        mut,
        seeds = [b"vault", market_id.to_le_bytes().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub bettor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<PlaceBet>,
    _market_id: u64,
    side: u8,    // 0 = Yes, 1 = No
    amount: u64, // in lamports
) -> Result<()> {
    require!(amount > 0, OracleBetError::InvalidBetAmount);
    require!(side <= 1, OracleBetError::InvalidSide);
    require!(
        ctx.accounts.market.status == MarketStatus::Open,
        OracleBetError::MarketNotOpen
    );
    require!(
        ctx.accounts.market.bets.len() < Market::MAX_BETS,
        OracleBetError::MaxBetsReached
    );

    // Перевод SOL в Vault
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.bettor.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, amount)?;

    let market = &mut ctx.accounts.market;

    // Обновляем тотализатор
    if side == 0 {
        market.total_yes = market.total_yes.checked_add(amount).unwrap();
    } else {
        market.total_no = market.total_no.checked_add(amount).unwrap();
    }

    // Сохраняем ставку в Market напрямую (фолбэк вместо UserPosition PDA)
    market.bets.push(BetEntry {
        bettor: ctx.accounts.bettor.key(),
        side,
        amount,
    });

    Ok(())
}
