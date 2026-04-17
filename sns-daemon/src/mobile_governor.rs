/// mobile_governor.rs
///
/// Battery-aware throttling for SOLNET mobile nodes.
/// The React Native layer reads device state and calls into this module
/// via the C FFI exported in lib.rs.
///
/// ThrottleState::FullPower  — Charging + WiFi (50 conns, 10s heartbeat)
/// ThrottleState::Conserve   — Charging XOR WiFi (10 conns, 60s heartbeat)
/// ThrottleState::Standby    — Unplugged + Cellular (2 conns, 300s heartbeat)

use std::sync::Arc;
use std::sync::atomic::{AtomicU8, Ordering};

// ─── ThrottleState ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ThrottleState {
    FullPower = 0,
    Conserve  = 1,
    Standby   = 2,
}

impl ThrottleState {
    pub fn from_u8(val: u8) -> Self {
        match val {
            0 => ThrottleState::FullPower,
            1 => ThrottleState::Conserve,
            _ => ThrottleState::Standby,
        }
    }

    /// Parse from the string names sent by the React Native bridge.
    pub fn from_str(s: &str) -> Self {
        match s {
            "FULL_POWER" => ThrottleState::FullPower,
            "CONSERVE"   => ThrottleState::Conserve,
            _            => ThrottleState::Standby,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            ThrottleState::FullPower => "FULL_POWER",
            ThrottleState::Conserve  => "CONSERVE",
            ThrottleState::Standby   => "STANDBY",
        }
    }
}

// ─── MobileGovernor ───────────────────────────────────────────────────────────

/// Thread-safe governor that every RPC handler queries before accepting work.
#[derive(Clone)]
pub struct MobileGovernor {
    state: Arc<AtomicU8>,
}

impl MobileGovernor {
    pub fn new() -> Self {
        Self {
            state: Arc::new(AtomicU8::new(ThrottleState::Standby as u8)),
        }
    }

    pub fn set_state(&self, new_state: ThrottleState) {
        let old = ThrottleState::from_u8(self.state.swap(new_state as u8, Ordering::Release));
        if old != new_state {
            tracing::info!(
                "[MobileGovernor] Throttle: {} → {}",
                old.as_str(),
                new_state.as_str()
            );
        }
    }

    pub fn get_state(&self) -> ThrottleState {
        ThrottleState::from_u8(self.state.load(Ordering::Acquire))
    }

    // ── Policy queries ──────────────────────────────────────────────────────

    /// Whether the daemon should accept a new inbound RPC request.
    /// `payload_bytes` is the Content-Length of the request body.
    pub fn should_accept_request(&self, payload_bytes: usize) -> bool {
        match self.get_state() {
            ThrottleState::FullPower => true,
            ThrottleState::Conserve  => payload_bytes < 10_000,
            ThrottleState::Standby   => payload_bytes < 1_000,
        }
    }

    /// Maximum simultaneous RPC connections to serve.
    pub fn max_concurrent_connections(&self) -> usize {
        match self.get_state() {
            ThrottleState::FullPower => 50,
            ThrottleState::Conserve  => 10,
            ThrottleState::Standby   => 2,
        }
    }

    /// P2P mesh heartbeat interval in seconds.
    pub fn heartbeat_interval_secs(&self) -> u64 {
        match self.get_state() {
            ThrottleState::FullPower => 10,
            ThrottleState::Conserve  => 60,
            ThrottleState::Standby   => 300,
        }
    }

    /// Serialise current status as JSON (used by the /health endpoint).
    pub fn status_json(&self) -> serde_json::Value {
        let state = self.get_state();
        serde_json::json!({
            "throttle_state": state.as_str(),
            "max_connections": self.max_concurrent_connections(),
            "heartbeat_interval_secs": self.heartbeat_interval_secs(),
        })
    }
}

impl Default for MobileGovernor {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn throttle_round_trip() {
        let gov = MobileGovernor::new();
        assert_eq!(gov.get_state(), ThrottleState::Standby);

        gov.set_state(ThrottleState::FullPower);
        assert_eq!(gov.get_state(), ThrottleState::FullPower);
        assert!(gov.should_accept_request(1_000_000)); // any size

        gov.set_state(ThrottleState::Conserve);
        assert!(gov.should_accept_request(9_999));
        assert!(!gov.should_accept_request(10_000));

        gov.set_state(ThrottleState::Standby);
        assert!(gov.should_accept_request(999));
        assert!(!gov.should_accept_request(1_000));
    }

    #[test]
    fn parse_from_str() {
        assert_eq!(ThrottleState::from_str("FULL_POWER"), ThrottleState::FullPower);
        assert_eq!(ThrottleState::from_str("CONSERVE"), ThrottleState::Conserve);
        assert_eq!(ThrottleState::from_str("STANDBY"), ThrottleState::Standby);
        assert_eq!(ThrottleState::from_str("GARBAGE"), ThrottleState::Standby);
    }
}
