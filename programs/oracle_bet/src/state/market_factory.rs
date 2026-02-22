use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct MarketFactory {
    pub authority: Pubkey,
    pub market_count: u64,
    pub bump: u8,
}

impl MarketFactory {
    pub const MAX_SIZE: usize = 32 + 8 + 1;

    pub fn seeds() -> &'static [&'static [u8]] {
        &[b"factory"]
    }
}
