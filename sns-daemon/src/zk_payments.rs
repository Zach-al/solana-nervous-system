use sha2::{Sha256, Digest};
use anyhow::Result;

pub struct ZkReceiptBatch {
    receipts: Vec<PaymentReceipt>,
    batch_id: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct PaymentReceipt {
    pub client_ip_hash: String,  // hashed, never store raw IP
    pub amount_lamports: u64,
    pub method: String,
    pub timestamp: u64,
    pub nonce: String,
    pub node_signature: String,
}

impl Default for ZkReceiptBatch {
    fn default() -> Self {
        Self::new()
    }
}

impl ZkReceiptBatch {
    pub fn new() -> Self {
        Self {
            receipts: Vec::new(),
            batch_id: uuid::Uuid::new_v4().to_string(),
        }
    }

    pub fn add_receipt(&mut self, receipt: PaymentReceipt) {
        self.receipts.push(receipt);
    }

    // Compress all receipts into single commitment
    pub fn compress(&self) -> CompressedBatch {
        let total_lamports: u64 = self.receipts
            .iter()
            .map(|r| r.amount_lamports)
            .sum();

        let receipt_count = self.receipts.len() as u64;

        // Build merkle tree of receipts
        let leaves: Vec<[u8; 32]> = self.receipts
            .iter()
            .map(|r| {
                let mut hasher = Sha256::new();
                hasher.update(r.client_ip_hash.as_bytes());
                hasher.update(r.amount_lamports.to_le_bytes());
                hasher.update(r.nonce.as_bytes());
                hasher.update(r.timestamp.to_le_bytes());
                hasher.finalize().into()
            })
            .collect();

        let merkle_root = Self::compute_merkle_root(&leaves);

        CompressedBatch {
            batch_id: self.batch_id.clone(),
            merkle_root: hex::encode(merkle_root),
            total_lamports,
            receipt_count,
            compressed_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        }
    }

    fn compute_merkle_root(leaves: &[[u8; 32]]) -> [u8; 32] {
        if leaves.is_empty() {
            return [0u8; 32];
        }
        if leaves.len() == 1 {
            return leaves[0];
        }

        let mut current_level = leaves.to_vec();
        
        while current_level.len() > 1 {
            let mut next_level = Vec::new();
            let mut i = 0;
            while i < current_level.len() {
                let left = current_level[i];
                let right = if i + 1 < current_level.len() {
                    current_level[i + 1]
                } else {
                    current_level[i] // duplicate last if odd
                };
                
                let mut hasher = Sha256::new();
                hasher.update(left);
                hasher.update(right);
                next_level.push(hasher.finalize().into());
                i += 2;
            }
            current_level = next_level;
        }
        
        current_level[0]
    }

    pub async fn persist_and_clear(
        &mut self,
        path: &str,
    ) -> Result<CompressedBatch> {
        let batch = self.compress();
        
        // Ensure directory exists
        tokio::fs::create_dir_all(path).await?;

        // Save raw receipts to disk
        let json = serde_json::to_string_pretty(&self.receipts)?;
        tokio::fs::write(
            format!("{}/batch_{}.json", path, self.batch_id),
            json
        ).await?;
        
        // Clear in-memory receipts
        self.receipts.clear();
        self.batch_id = uuid::Uuid::new_v4().to_string();
        
        Ok(batch)
    }
}

pub fn batch_id_to_bytes(batch_id: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(batch_id.as_bytes());
    hasher.finalize().into()
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct CompressedBatch {
    pub batch_id: String,
    pub merkle_root: String,
    pub total_lamports: u64,
    pub receipt_count: u64,
    pub compressed_at: u64,
}
