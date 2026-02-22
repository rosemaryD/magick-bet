use anchor_lang::prelude::*;

/// UserPosition PDA — хранится на L1
/// ВАЖНО: создавать на L1 ДО делегирования Market в ER
/// Если init_if_needed не работает в ER — использовать BetEntry в Market напрямую
#[account]
#[derive(Default)]
pub struct UserPosition {
    pub market_id: u64,
    pub bettor: Pubkey,
    pub side: u8,        // 0 = Yes, 1 = No
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl UserPosition {
    pub const MAX_SIZE: usize = 8 + 32 + 1 + 8 + 1 + 1;
}
