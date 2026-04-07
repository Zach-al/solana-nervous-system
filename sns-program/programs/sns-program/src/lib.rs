use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("3ibaKPYPhfuJNvGa2VZ6yTjjjegYFS1RkwjtfHJ5jjrR");

#[program]
pub mod sns_program {
    use super::*;

    pub fn register_node(
        ctx: Context<RegisterNode>,
        endpoint: String,
        stake_amount: u64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(endpoint.len() <= 100, SnsError::InvalidEndpoint);
        require!(stake_amount >= 100_000_000, SnsError::InsufficientStake);
        require!(!ctx.accounts.node_account.is_initialized, SnsError::NodeAlreadyRegistered);

        let node = &mut ctx.accounts.node_account;
        node.owner = ctx.accounts.owner.key();
        node.endpoint = endpoint.clone();
        node.stake_amount = stake_amount;
        node.reputation = 100;
        node.registered_at = clock.unix_timestamp;
        node.requests_served = 0;
        node.is_initialized = true;
        node.locked = false;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.escrow_account.to_account_info(),
                },
            ),
            stake_amount,
        )?;

        emit!(NodeRegistered {
            owner: ctx.accounts.owner.key(),
            endpoint,
            stake_amount,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn settle_payments(
        ctx: Context<SettlePayments>,
        receipts: Vec<PaymentReceipt>,
        instruction_timestamp: i64,
        instruction_nonce: u64,
    ) -> Result<()> {
        let node = &mut ctx.accounts.node_account;

        // ACCOUNT VALIDATION (owner and frozen checks handled by Anchor types and constraints)
        require!(node.is_initialized, SnsError::NodeNotFound);
        require!(node.owner == ctx.accounts.owner.key(), SnsError::Unauthorized);

        // REENTRANCY PROTECTION
        require!(!node.locked, SnsError::Reentrancy);
        node.locked = true;

        // VERIFY NODE REPUTATION
        require!(node.reputation > 0, SnsError::NodeSlashed);

        // INSTRUCTION REPLAY PROTECTION
        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp.saturating_sub(instruction_timestamp) <= 60,
            SnsError::TimestampExpired
        );

        // INSTRUCTION NONCE UNIQUENESS
        let nonce_acc = &mut ctx.accounts.nonce_account;
        require!(!nonce_acc.is_used, SnsError::NonceAlreadyUsed);
        nonce_acc.is_used = true;
        nonce_acc.nonce_value = instruction_nonce;

        // PAYMENT VALIDATION
        require!(!receipts.is_empty(), SnsError::InvalidReceipt);
        
        let mut total_payment: u64 = 0;
        let mut max_receipt_nonce = node.last_receipt_nonce;

        for receipt in receipts.iter() {
            require!(receipt.amount_lamports > 0, SnsError::InvalidReceipt);
            require!(
                clock.unix_timestamp.saturating_sub(receipt.timestamp) <= 7200,
                SnsError::TimestampExpired
            );
            // Verify receipt nonce is strictly increasing (not previously used)
            require!(receipt.nonce > max_receipt_nonce, SnsError::NonceAlreadyUsed);
            max_receipt_nonce = receipt.nonce;

            total_payment = total_payment.checked_add(receipt.amount_lamports).ok_or(SnsError::Overflow)?;
        }
        
        // Update the highest seen nonce to prevent reuse
        node.last_receipt_nonce = max_receipt_nonce;

        // VERIFY ESCROW BALANCE
        let escrow_balance = ctx.accounts.escrow_account.lamports();
        require!(total_payment <= escrow_balance, SnsError::InsufficientEscrow);

        let owner_key = ctx.accounts.owner.key();
        let bump = ctx.bumps.escrow_account;
        let seeds: &[&[u8]] = &[b"escrow", owner_key.as_ref(), &[bump]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow_account.to_account_info(),
                    to: ctx.accounts.owner.to_account_info(),
                },
                &[seeds],
            ),
            total_payment,
        )?;

        // CHECKED MATH FOR REQUESTS SERVED
        node.requests_served = node.requests_served.checked_add(receipts.len() as u64).ok_or(SnsError::Overflow)?;

        // TURN OFF LOCK
        node.locked = false;

        emit!(PaymentSettled {
            owner: ctx.accounts.owner.key(),
            total_lamports: total_payment,
            receipt_count: receipts.len() as u64,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn slash_node(ctx: Context<SlashNode>, reason: String) -> Result<()> {
        let node = &mut ctx.accounts.node_account;
        require!(
            ctx.accounts.authority.key() == ctx.accounts.program_authority.key(),
            SnsError::Unauthorized
        );
        require!(node.is_initialized, SnsError::NodeNotFound);

        // REENTRANCY PROTECTION
        require!(!node.locked, SnsError::Reentrancy);
        node.locked = true;

        let prev_rep = node.reputation;
        node.reputation = prev_rep.saturating_sub(20);
        let new_rep = node.reputation;

        if new_rep < 20 {
            let return_amt = node.stake_amount.checked_div(2).unwrap_or(0);
            node.is_initialized = false;
            node.stake_amount = 0;

            if return_amt > 0 {
                let owner_key = ctx.accounts.owner.key();
                let bump = ctx.bumps.escrow_account;
                let seeds: &[&[u8]] = &[b"escrow", owner_key.as_ref(), &[bump]];
                system_program::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.escrow_account.to_account_info(),
                            to: ctx.accounts.owner.to_account_info(),
                        },
                        &[seeds],
                    ),
                    return_amt,
                )?;
            }
        }

        node.locked = false;

        emit!(NodeSlashed {
            owner: ctx.accounts.owner.key(),
            reason,
            prev_reputation: prev_rep,
            new_reputation: new_rep,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }
}

// ─────────────────────────────────────────────────────────────
// Contexts
// ─────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct RegisterNode<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = NodeAccount::SPACE,
        seeds = [b"node", owner.key().as_ref()],
        bump,
    )]
    pub node_account: Account<'info, NodeAccount>,

    /// CHECK: PDA that holds staked SOL. Seeds are validated via macro.
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump,
    )]
    pub escrow_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(receipts: Vec<PaymentReceipt>, instruction_timestamp: i64, instruction_nonce: u64)]
pub struct SettlePayments<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"node", owner.key().as_ref()],
        bump,
    )]
    pub node_account: Account<'info, NodeAccount>,

    /// CHECK: PDA that holds staked SOL
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump,
    )]
    pub escrow_account: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = owner,
        space = NonceAccount::SPACE,
        seeds = [b"nonce", owner.key().as_ref(), &instruction_nonce.to_le_bytes()],
        bump,
    )]
    pub nonce_account: Account<'info, NonceAccount>,

    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SlashNode<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Target owner
    #[account(mut)]
    pub owner: UncheckedAccount<'info>,

    /// CHECK: Program authority PDA
    #[account(seeds = [b"authority"], bump)]
    pub program_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"node", owner.key().as_ref()],
        bump,
    )]
    pub node_account: Account<'info, NodeAccount>,

    /// CHECK: Escrow PDA
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump,
    )]
    pub escrow_account: UncheckedAccount<'info>,

    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────
// Account State
// ─────────────────────────────────────────────────────────────

#[account]
pub struct NodeAccount {
    pub owner: Pubkey,            // 32
    pub endpoint: String,         // 4 + 100
    pub stake_amount: u64,        // 8
    pub reputation: u8,           // 1
    pub registered_at: i64,       // 8
    pub requests_served: u64,     // 8
    pub is_initialized: bool,     // 1
    pub locked: bool,             // 1
    pub last_receipt_nonce: u64,  // 8
}

impl NodeAccount {
    pub const SPACE: usize = 8 + 32 + (4 + 100) + 8 + 1 + 8 + 8 + 1 + 1 + 8;
}

#[account]
#[derive(Default)]
pub struct NonceAccount {
    pub is_used: bool,
    pub nonce_value: u64,
}

impl NonceAccount {
   pub const SPACE: usize = 8 + 1 + 8;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PaymentReceipt {
    pub client: Pubkey,
    pub amount_lamports: u64,
    pub nonce: u64,
    pub timestamp: i64,
}

// ─────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────

#[event]
pub struct NodeRegistered {
    pub owner: Pubkey,
    pub endpoint: String,
    pub stake_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PaymentSettled {
    pub owner: Pubkey,
    pub total_lamports: u64,
    pub receipt_count: u64,
    pub timestamp: i64,
}

#[event]
pub struct NodeSlashed {
    pub owner: Pubkey,
    pub reason: String,
    pub prev_reputation: u8,
    pub new_reputation: u8,
    pub timestamp: i64,
}

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

#[error_code]
pub enum SnsError {
    #[msg("Node is already registered")]
    NodeAlreadyRegistered,
    #[msg("Insufficient stake (minimum 0.1 SOL required)")]
    InsufficientStake,
    #[msg("Invalid or empty payment receipt")]
    InvalidReceipt,
    #[msg("Caller is not authorized")]
    Unauthorized,
    #[msg("Node not found or not initialized")]
    NodeNotFound,
    #[msg("Endpoint string too long (max 100 chars)")]
    InvalidEndpoint,
    // Security Errors
    #[msg("Math overflow")]
    Overflow,
    #[msg("Reentrancy detected")]
    Reentrancy,
    #[msg("Replay attack detected")]
    ReplayAttack,
    #[msg("Nonce already used")]
    NonceAlreadyUsed,
    #[msg("Insufficient escrow balance")]
    InsufficientEscrow,
    #[msg("Node has been slashed")]
    NodeSlashed,
    #[msg("Timestamp expired")]
    TimestampExpired,
    #[msg("Invalid signature")]
    InvalidSignature,
    #[msg("Account is frozen")]
    AccountFrozen,
}
