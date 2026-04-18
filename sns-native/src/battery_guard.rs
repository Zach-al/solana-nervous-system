/// Battery-aware throttling for mobile nodes
/// Reduces workload when battery is low
/// iOS and Android nodes should never drain battery
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};

pub struct BatteryGuard {
    /// Is battery mode active
    battery_mode: bool,
    /// Current simulated battery level (0-100)
    /// On real mobile this reads from system API
    battery_level: Arc<AtomicU8>,
    /// Is charging
    is_charging: Arc<AtomicBool>,
    /// Is throttled right now
    throttled: Arc<AtomicBool>,
}

impl BatteryGuard {
    pub fn new(battery_mode: bool) -> Self {
        Self {
            battery_mode,
            battery_level: Arc::new(AtomicU8::new(100)),
            is_charging: Arc::new(AtomicBool::new(true)),
            throttled: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Check if we should accept a new request
    /// Returns false when battery is critically low
    pub fn should_accept_request(&self) -> bool {
        if !self.battery_mode {
            return true; // Desktop: always accept
        }

        let level = self.battery_level.load(Ordering::Relaxed);
        let charging = self.is_charging.load(Ordering::Relaxed);

        // Always accept if charging
        if charging {
            self.throttled.store(false, Ordering::Relaxed);
            return true;
        }

        // Throttle below 20% battery
        if level < 20 {
            self.throttled.store(true, Ordering::Relaxed);
            tracing::warn!("Battery {}% — throttling requests", level);
            return false;
        }

        // Reduce to 50% capacity below 40%
        if level < 40 {
            self.throttled.store(true, Ordering::Relaxed);
            // Accept every other request
            let count = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            return count.is_multiple_of(2);
        }

        self.throttled.store(false, Ordering::Relaxed);
        true
    }

    pub fn set_battery_level(&self, level: u8) {
        self.battery_level.store(level, Ordering::Relaxed);
    }

    pub fn set_charging(&self, charging: bool) {
        self.is_charging.store(charging, Ordering::Relaxed);
    }

    pub fn is_throttled(&self) -> bool {
        self.throttled.load(Ordering::Relaxed)
    }

    pub fn get_status(&self) -> BatteryStatus {
        BatteryStatus {
            battery_mode: self.battery_mode,
            level: self.battery_level.load(Ordering::Relaxed),
            charging: self.is_charging.load(Ordering::Relaxed),
            throttled: self.throttled.load(Ordering::Relaxed),
        }
    }
}

#[derive(serde::Serialize)]
pub struct BatteryStatus {
    pub battery_mode: bool,
    pub level: u8,
    pub charging: bool,
    pub throttled: bool,
}
