use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("3ibaKPYPhfuJNvGa2VZ6yTjjjegYFS1RkwjtfHJ5jjrR");

/// Solana Nervous System — on-chain node registry and payment settlement.
#[program]
pub mod sns_program {
    use super::*;

    /// Register a new SNS node. Creates NodeAccount PDA and stakes SOL in escrow.
    pub fn register_node(
        ctx: Context<RegisterNode>,
        endpoint: String,
        stake_amount: u64,
    ) -> Result<()> {
        require!(endpoint.len() <= 100, SnsError::InvalidEndpoint);
        require!(stake_amount >= 100_000_000, SnsError::InsufficientStake);
        require!(!ctx.accounts.node_account.is_initialized, SnsError::NodeAlreadyRegistered);

        let node = &mut ctx.accounts.node_account;
        node.owner = ctx.accounts.owner.key();
        node.endpoint = endpoint.clone();
        node.stake_amount = stake_amount;
        node.reputation = 100;
        node.registered_at = Clock::get()?.unix_timestamp;
        node.requests_served = 0;
        node.is_initialized = true;

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
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Settle earned payments — moves SOL from escrow to node owner.
    pub fn settle_payments(
        ctx: Context<SettlePayments>,
        receipts: Vec<PaymentReceipt>,
    ) -> Result<()> {
        require!(ctx.accounts.node_account.is_initialized, SnsError::NodeNotFound);
        require!(
            ctx.accounts.node_account.owner == ctx.accounts.owner.key(),
            SnsError::Unauthorized
        );
        require!(!receipts.is_empty(), SnsError::InvalidReceipt);

        let total_payment: u64 = receipts.iter().map(|r| r.amount_lamports).sum();
        require!(total_payment > 0, SnsError::InvalidReceipt);

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

        ctx.accounts.node_account.requests_served += receipts.len() as u64;

        emit!(PaymentSettled {
            owner: ctx.accounts.owner.key(),
            total_lamports: total_payment,
            receipt_count: receipts.len() as u64,
            timestamp: Clock::get()?.unix_timestamp,
        });
        Ok(())
    }

    /// Slash a misbehaving node (authority-only).
    pub fn slash_node(ctx: Context<SlashNode>, reason: String) -> Result<()> {
        require!(
            ctx.accounts.authority.key() == ctx.accounts.program_authority.key(),
            SnsError::Unauthorized
        );
        require!(ctx.accounts.node_account.is_initialized, SnsError::NodeNotFound);

        let prev_rep = ctx.accounts.node_account.reputation;
        ctx.accounts.node_account.reputation = prev_rep.saturating_sub(20);
        let new_rep = ctx.accounts.node_account.reputation;

        if new_rep < 20 {
            let return_amt = ctx.accounts.node_account.stake_amount / 2;
            ctx.accounts.node_account.is_initialized = false;
            ctx.accounts.node_account.stake_amount = 0;

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

    /// CHECK: PDA that holds staked SOL — seeds are validated below
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump,
    )]
    pub escrow_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettlePayments<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"node", owner.key().as_ref()],
        bump,
    )]
    pub node_account: Account<'info, NodeAccount>,

    /// CHECK: Escrow PDA — seeds validated in constraint
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump,
    )]
    pub escrow_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SlashNode<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Node owner — identity validated in instruction
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

    /// CHECK: Escrow PDA — seeds validated
    #[account(
        mut,
        seeds = [b"escrow", owner.key().as_ref()],
        bump,
    )]
    pub escrow_account: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────────────────────
// Account State
// ─────────────────────────────────────────────────────────────

#[account]
pub struct NodeAccount {
    pub owner: Pubkey,        // 32
    pub endpoint: String,     // 4 + 100
    pub stake_amount: u64,    // 8
    pub reputation: u8,       // 1
    pub registered_at: i64,   // 8
    pub requests_served: u64, // 8
    pub is_initialized: bool, // 1
}

impl NodeAccount {
    pub const SPACE: usize = 8 + 32 + (4 + 100) + 8 + 1 + 8 + 8 + 1;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PaymentReceipt {
    pub client: Pubkey,
    pub amount_lamports: u64,
    pub nonce: u64,
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
}
