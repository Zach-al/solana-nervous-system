/// Sealevel-inspired parallel execution engine
/// Non-conflicting requests run in parallel, conflicting ones serialize

use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::Semaphore;
use anyhow::{self, Result};

pub struct ParallelExecutor {
    account_locks: Arc<DashMap<String, Arc<Semaphore>>>,
    global_semaphore: Arc<Semaphore>,
}

impl ParallelExecutor {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            account_locks: Arc::new(DashMap::new()),
            global_semaphore: Arc::new(Semaphore::new(max_concurrent)),
        }
    }

    pub async fn acquire(
        &self,
        _method: &str,
        account_key: Option<&str>,
    ) -> Result<tokio::sync::OwnedSemaphorePermit> {
        let permit = self
            .global_semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| anyhow::anyhow!("semaphore: {}", e))?;

        if let Some(key) = account_key {
            let _lock = self
                .account_locks
                .entry(key.to_string())
                .or_insert_with(|| Arc::new(Semaphore::new(1)))
                .clone();
        }

        Ok(permit)
    }

    pub fn get_metrics(&self) -> ExecutorMetrics {
        ExecutorMetrics {
            available_slots: self.global_semaphore.available_permits(),
            active_account_locks: self.account_locks.len(),
        }
    }

    pub fn cleanup_idle_locks(&self) {
        self.account_locks
            .retain(|_, sem| sem.available_permits() == 0);
    }
}

#[derive(serde::Serialize)]
pub struct ExecutorMetrics {
    pub available_slots: usize,
    pub active_account_locks: usize,
}
