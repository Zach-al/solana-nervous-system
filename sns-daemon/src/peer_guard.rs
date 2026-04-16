use dashmap::DashMap;
use std::sync::Arc;
use libp2p::PeerId;

/// Tracks peer behavior and enforces reputation scoring
/// Bad actors get progressively restricted then banned
pub struct PeerGuard {
    /// Peer reputation scores (0-100, start at 50)
    scores: Arc<DashMap<PeerId, PeerRecord>>,
    /// Permanently banned peers
    banned: Arc<DashMap<PeerId, BanRecord>>,
}

#[derive(Clone)]
pub struct PeerRecord {
    pub score: i32,          // 0-100
    pub connections: u32,
    pub failed_handshakes: u32,
    pub spam_attempts: u32,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub first_seen: u64,
    pub last_seen: u64,
}

#[derive(Clone)]
pub struct BanRecord {
    pub reason: String,
    pub banned_at: u64,
    pub expires_at: Option<u64>, // None = permanent
}

impl Default for PeerGuard {
    fn default() -> Self {
        Self::new()
    }
}

impl PeerGuard {
    pub fn new() -> Self {
        Self {
            scores: Arc::new(DashMap::new()),
            banned: Arc::new(DashMap::new()),
        }
    }

    /// Check if peer is allowed to connect
    pub fn is_allowed(&self, peer: &PeerId) -> bool {
        // Check permanent/active bans first
        if let Some(ban) = self.banned.get(peer) {
            if let Some(expires) = ban.expires_at {
                let now = Self::now();
                if now < expires {
                    return false; // Still banned
                }
                drop(ban);
                self.banned.remove(peer); // Expired
            } else {
                return false; // Permanent ban
            }
        }

        // Check reputation score
        if let Some(record) = self.scores.get(peer) {
            if record.score <= 0 {
                return false; // Score too low
            }
        }

        true
    }

    /// Called when peer connects successfully
    pub fn on_connected(&self, peer: &PeerId) {
        let now = Self::now();
        let mut record = self.scores
            .entry(*peer)
            .or_insert(PeerRecord {
                score: 50,
                connections: 0,
                failed_handshakes: 0,
                spam_attempts: 0,
                bytes_sent: 0,
                bytes_received: 0,
                first_seen: now,
                last_seen: now,
            });
        record.connections += 1;
        record.last_seen = now;
        // Good behavior: small score boost
        record.score = (record.score + 1).min(100);
    }

    /// Called on failed handshake — likely attack
    pub fn on_failed_handshake(&self, peer: &PeerId) {
        let mut record = self.scores
            .entry(*peer)
            .or_insert(self.default_record());
        record.failed_handshakes += 1;
        record.score -= 10; // Heavy penalty
        
        tracing::warn!(
            "Failed handshake from peer {}: \
             score now {}",
            peer, record.score
        );

        // Auto-ban after 5 failed handshakes
        if record.failed_handshakes >= 5 {
            drop(record);
            self.ban(
                peer,
                "5 failed handshakes".into(),
                Some(Self::now() + 3600), // 1 hour
            );
        }
    }

    /// Called when peer sends malformed data
    pub fn on_protocol_violation(&self, peer: &PeerId) {
        let mut record = self.scores
            .entry(*peer)
            .or_insert(self.default_record());
        record.score -= 25; // Severe penalty
        record.spam_attempts += 1;

        tracing::warn!(
            "Protocol violation from {}: score {}",
            peer, record.score
        );

        if record.score <= 0 {
            drop(record);
            self.ban(
                peer,
                "protocol violation".into(),
                None, // Permanent
            );
        }
    }

    /// Called on successful RPC forwarding
    pub fn on_successful_relay(
        &self,
        peer: &PeerId,
        bytes: u64,
    ) {
        let mut record = self.scores
            .entry(*peer)
            .or_insert(self.default_record());
        record.bytes_received += bytes;
        record.last_seen = Self::now();
        // Good behavior: score recovery
        record.score = (record.score + 2).min(100);
    }

    pub fn ban(
        &self,
        peer: &PeerId,
        reason: String,
        expires_at: Option<u64>,
    ) {
        tracing::warn!(
            "Banning peer {}: {} (expires: {:?})",
            peer, reason, expires_at
        );
        self.banned.insert(*peer, BanRecord {
            reason,
            banned_at: Self::now(),
            expires_at,
        });
        self.scores.remove(peer);
    }

    pub fn get_stats(&self) -> PeerGuardStats {
        let total_peers = self.scores.len();
        let banned_peers = self.banned.len();
        let healthy = self.scores
            .iter()
            .filter(|r| r.score >= 50)
            .count();

        PeerGuardStats {
            total_known_peers: total_peers,
            banned_peers,
            healthy_peers: healthy,
            degraded_peers: total_peers - healthy,
        }
    }

    fn default_record(&self) -> PeerRecord {
        let now = Self::now();
        PeerRecord {
            score: 50,
            connections: 0,
            failed_handshakes: 0,
            spam_attempts: 0,
            bytes_sent: 0,
            bytes_received: 0,
            first_seen: now,
            last_seen: now,
        }
    }

    fn now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    /// Cleanup expired bans and stale peers
    pub fn cleanup(&self) {
        let now = Self::now();
        // Remove expired bans
        self.banned.retain(|_, ban| {
            ban.expires_at
                .map(|exp| now < exp)
                .unwrap_or(true) // Keep permanent bans
        });
        // Remove peers not seen in 24 hours
        self.scores.retain(|_, r| {
            now - r.last_seen < 86400
        });
    }
}

#[derive(serde::Serialize)]
pub struct PeerGuardStats {
    pub total_known_peers: usize,
    pub banned_peers: usize,
    pub healthy_peers: usize,
    pub degraded_peers: usize,
}
