use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::DelegationProgram;
use ephemeral_rollups_sdk::cpi::{delegate_account, DelegateAccounts, DelegateConfig};
use crate::state::PlayerBet;

const TEE_VALIDATOR: &str = "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA";

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct DelegatePrivateBet<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"bet", market_id.to_le_bytes().as_ref(), payer.key().as_ref()],
        bump = player_bet.bump,
    )]
    pub player_bet: Account<'info, PlayerBet>,

    /// CHECK: Buffer PDA for delegation.
    #[account(mut)]
    pub buffer: UncheckedAccount<'info>,

    /// CHECK: Delegation record PDA.
    #[account(mut)]
    pub delegation_record: UncheckedAccount<'info>,

    /// CHECK: Delegation metadata PDA.
    #[account(mut)]
    pub delegation_metadata: UncheckedAccount<'info>,

    pub delegation_program: Program<'info, DelegationProgram>,

    /// CHECK: owner program = oracle_bet.
    pub owner_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DelegatePrivateBet>, market_id: u64) -> Result<()> {
    let market_id_bytes = market_id.to_le_bytes();
    let player_key = ctx.accounts.payer.key();
    let pda_seeds: &[&[u8]] = &[b"bet", &market_id_bytes, player_key.as_ref()];

    let mut config = DelegateConfig::default();
    config.validator = Some(Pubkey::try_from(TEE_VALIDATOR).map_err(|_| DelegatePrivateBetError::InvalidValidator)?);

    delegate_account(
        DelegateAccounts {
            payer: &ctx.accounts.payer.to_account_info(),
            pda: &ctx.accounts.player_bet.to_account_info(),
            owner_program: &ctx.accounts.owner_program.to_account_info(),
            buffer: &ctx.accounts.buffer.to_account_info(),
            delegation_record: &ctx.accounts.delegation_record.to_account_info(),
            delegation_metadata: &ctx.accounts.delegation_metadata.to_account_info(),
            delegation_program: &ctx.accounts.delegation_program.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        },
        pda_seeds,
        config,
    )?;

    Ok(())
}

#[error_code]
pub enum DelegatePrivateBetError {
    #[msg("TEE validator pubkey is invalid")]
    InvalidValidator,
}
