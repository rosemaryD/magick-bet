use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Market, MarketStatus, Outcome};
use crate::errors::OracleBetError;

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct ClaimWinnings<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Vault PDA — источник выплат
    #[account(
        mut,
        seeds = [b"vault", market_id.to_le_bytes().as_ref()],
        bump = market.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub claimant: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimWinnings>, market_id: u64) -> Result<()> {
    require!(
        ctx.accounts.market.status == MarketStatus::Resolved,
        OracleBetError::MarketNotResolved
    );

    let winning_side: u8 = match ctx.accounts.market.outcome {
        Outcome::Yes => 0,
        Outcome::No => 1,
        Outcome::Unresolved => return Err(OracleBetError::MarketNotResolved.into()),
    };

    let claimant_key = ctx.accounts.claimant.key();

    // Агрегируем ВСЕ ставки пользователя на выигрышной стороне (копируем суммы)
    let user_winning_bets: Vec<u64> = ctx.accounts.market.bets
        .iter()
        .filter(|b| b.bettor == claimant_key && b.side == winning_side)
        .map(|b| b.amount)
        .collect();

    require!(!user_winning_bets.is_empty(), OracleBetError::NoWinningPosition);

    let total_user_bet: u64 = user_winning_bets.iter().sum();

    let total_winning = if winning_side == 0 {
        ctx.accounts.market.total_yes
    } else {
        ctx.accounts.market.total_no
    };

    // PMM формула: payout = user_bet * total_pool / winning_total
    let total_pool = ctx.accounts.market.total_yes
        .checked_add(ctx.accounts.market.total_no)
        .unwrap_or(u64::MAX);

    let payout = if total_winning == 0 {
        total_user_bet // возврат если никто не проиграл
    } else {
        ((total_user_bet as u128)
            .checked_mul(total_pool as u128)
            .unwrap_or(0)
            / total_winning as u128) as u64
    };

    // Защита от превышения баланса vault
    let vault_balance = ctx.accounts.vault.lamports();
    let payout = payout.min(vault_balance);

    require!(payout > 0, OracleBetError::NoWinningPosition);

    // Удаляем ВСЕ выигрышные ставки пользователя из market.bets (защита от double-claim)
    // borrow завершён выше через .collect(), поэтому .retain() безопасен
    ctx.accounts.market.bets.retain(|b| {
        !(b.bettor == claimant_key && b.side == winning_side)
    });

    // Перевод из Vault claimant'у через PDA signer
    let market_id_bytes = market_id.to_le_bytes();
    let vault_bump = ctx.accounts.market.vault_bump;
    let vault_seeds = &[b"vault".as_ref(), market_id_bytes.as_ref(), &[vault_bump]];
    let signer_seeds = &[vault_seeds.as_ref()];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.claimant.to_account_info(),
        },
        signer_seeds,
    );
    system_program::transfer(cpi_ctx, payout)?;

    Ok(())
}
