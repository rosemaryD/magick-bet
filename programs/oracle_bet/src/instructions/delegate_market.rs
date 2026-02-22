use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::DelegationProgram;
use ephemeral_rollups_sdk::cpi::{delegate_account, DelegateAccounts, DelegateConfig};
use crate::state::Market;

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct DelegateMarket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Buffer PDA для делегирования — вычисляется SDK автоматически
    #[account(mut)]
    pub buffer: UncheckedAccount<'info>,

    /// CHECK: Delegation record PDA — создаётся Delegation Program
    #[account(mut)]
    pub delegation_record: UncheckedAccount<'info>,

    /// CHECK: Delegation metadata PDA — создаётся Delegation Program
    #[account(mut)]
    pub delegation_metadata: UncheckedAccount<'info>,

    pub delegation_program: Program<'info, DelegationProgram>,

    /// CHECK: owner program = oracle_bet itself
    pub owner_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DelegateMarket>, market_id: u64) -> Result<()> {
    let market_id_bytes = market_id.to_le_bytes();
    let pda_seeds: &[&[u8]] = &[b"market", &market_id_bytes];
    // Do not mutate market data in the same instruction that transfers ownership.
    // Runtime rejects data diffs when account owner is switched via delegation CPI.

    delegate_account(
        DelegateAccounts {
            payer: &ctx.accounts.payer.to_account_info(),
            pda: &ctx.accounts.market.to_account_info(),
            owner_program: &ctx.accounts.owner_program.to_account_info(),
            buffer: &ctx.accounts.buffer.to_account_info(),
            delegation_record: &ctx.accounts.delegation_record.to_account_info(),
            delegation_metadata: &ctx.accounts.delegation_metadata.to_account_info(),
            delegation_program: &ctx.accounts.delegation_program.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        },
        pda_seeds,
        DelegateConfig::default(),
    )?;

    Ok(())
}
