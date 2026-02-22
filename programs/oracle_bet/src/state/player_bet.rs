use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct PlayerBet {
    pub market_id: u64,
    pub player: Pubkey,
    pub side: u8, // 0 = Yes, 1 = No
    pub amount: u64,
    pub bump: u8,
}

impl PlayerBet {
    pub const MAX_SIZE: usize = 8 + 8 + 32 + 1 + 8 + 1;
}