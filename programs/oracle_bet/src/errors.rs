use anchor_lang::prelude::*;

#[error_code]
pub enum OracleBetError {
    #[msg("Question exceeds maximum length of 128 characters")]
    QuestionTooLong,
    #[msg("Resolution time must be in the future")]
    InvalidResolutionTime,
    #[msg("Market is not open")]
    MarketNotOpen,
    #[msg("Market is not resolved")]
    MarketNotResolved,
    #[msg("User has no winning position")]
    NoWinningPosition,
    #[msg("Winnings already claimed")]
    AlreadyClaimed,
    #[msg("Maximum number of bets reached")]
    MaxBetsReached,
    #[msg("Bet amount must be greater than zero")]
    InvalidBetAmount,
    #[msg("Side must be 0 (Yes) or 1 (No)")]
    InvalidSide,
    #[msg("Resolution time has not been reached yet")]
    ResolutionTimeNotReached,
    #[msg("Only market creator can resolve")]
    Unauthorized,
    #[msg("Invalid price feed data")]
    InvalidPriceFeed,
}
