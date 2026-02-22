use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::MagicProgram;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use crate::state::{Market, MarketStatus, Outcome};
use crate::errors::OracleBetError;

/// Смещение данных Pyth Lazer price в PDA аккаунте
pub const PYTH_LAZER_PRICE_OFFSET: usize = 73;

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct ResolveMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Pyth Lazer Price Feed PDA
    /// feed_id для SOL/USD devnet: проверить через https://pyth.network/developers/price-feed-ids
    pub price_feed: UncheckedAccount<'info>,

    /// CHECK: Magic Context — системный аккаунт MagicBlock ER
    #[account(mut)]
    pub magic_context: UncheckedAccount<'info>,

    pub magic_program: Program<'info, MagicProgram>,

    #[account(mut)]
    pub resolver: Signer<'info>,
}

pub fn handler(ctx: Context<ResolveMarket>, _market_id: u64) -> Result<()> {
    // Проверки в отдельном скоупе чтобы освободить иммутабельный borrow
    {
        let market = &ctx.accounts.market;
        require!(
            market.status == MarketStatus::Open,
            OracleBetError::MarketNotOpen
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= market.resolution_time,
            OracleBetError::ResolutionTimeNotReached
        );

        require!(
            ctx.accounts.resolver.key() == market.creator,
            OracleBetError::Unauthorized
        );
    }

    // Читаем цену из Pyth Lazer PDA по смещению +73 байта
    let current_price = {
        let price_data = ctx.accounts.price_feed.try_borrow_data()?;
        require!(
            price_data.len() > PYTH_LAZER_PRICE_OFFSET + 8,
            OracleBetError::InvalidPriceFeed
        );
        let bytes: [u8; 8] = price_data[PYTH_LAZER_PRICE_OFFSET..PYTH_LAZER_PRICE_OFFSET + 8]
            .try_into()
            .map_err(|_| OracleBetError::InvalidPriceFeed)?;
        i64::from_le_bytes(bytes)
    };

    // Мутабельный borrow — в отдельном скоупе после освобождения иммутабельных
    {
        let market = &mut ctx.accounts.market;
        market.outcome = if current_price >= market.resolution_price {
            Outcome::Yes
        } else {
            Outcome::No
        };
        market.status = MarketStatus::Resolved;
        market.is_delegated = false;
        // Anchor account must be flushed before commit+undelegate changes ownership context.
        market.exit(&crate::ID)?;
    }

    // Commit state to L1 + Undelegate Market PDA
    // Важно: skipPreflight: true на клиенте, занимает несколько секунд для финализации
    commit_and_undelegate_accounts(
        &ctx.accounts.resolver.to_account_info(),
        vec![&ctx.accounts.market.to_account_info()],
        &ctx.accounts.magic_context.to_account_info(),
        &ctx.accounts.magic_program.to_account_info(),
    )?;

    Ok(())
}
