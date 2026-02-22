use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MarketStatus {
    Open,
    Resolved,
    Cancelled,
}

impl Default for MarketStatus {
    fn default() -> Self {
        MarketStatus::Open
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Side {
    Yes,
    No,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Outcome {
    Yes,
    No,
    Unresolved,
}

impl Default for Outcome {
    fn default() -> Self {
        Outcome::Unresolved
    }
}

/// Ставка, хранимая прямо в Market (фолбэк вместо UserPosition PDA)
/// Используется если init_if_needed не работает в ER контексте
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct BetEntry {
    pub bettor: Pubkey,
    pub side: u8, // 0 = Yes, 1 = No
    pub amount: u64,
}

#[account]
#[derive(Default)]
pub struct Market {
    pub market_id: u64,
    pub creator: Pubkey,
    pub question: String,         // max 128 chars
    pub resolution_price: i64,    // target price in USD (scaled)
    pub resolution_time: i64,     // unix timestamp
    pub total_yes: u64,
    pub total_no: u64,
    pub status: MarketStatus,
    pub outcome: Outcome,
    pub vault_bump: u8,
    pub bump: u8,
    pub is_delegated: bool,
    // Fallback: хранить ставки прямо в Market (до 20 ставок)
    // Используется вместо UserPosition PDA если ER не поддерживает init_if_needed
    pub bets: Vec<BetEntry>,      // max 20 entries
}

impl Market {
    pub const MAX_QUESTION_LEN: usize = 128;
    pub const MAX_BETS: usize = 20;

    pub const MAX_SIZE: usize = 8          // market_id
        + 32                               // creator
        + 4 + Self::MAX_QUESTION_LEN       // question (string prefix + data)
        + 8                                // resolution_price
        + 8                                // resolution_time
        + 8                                // total_yes
        + 8                                // total_no
        + 1                                // status
        + 1                                // outcome
        + 1                                // vault_bump
        + 1                                // bump
        + 1                                // is_delegated
        + 4 + (Self::MAX_BETS * (32 + 1 + 8)); // bets vec (prefix + entries)
}
