/// Platform abstraction layer for SOLNET V2.0
/// Enables cross-compilation for mobile (iOS/Android) and handles
/// platform-specific directory and networking logic.

use std::path::PathBuf;

pub enum Platform {
    Linux,
    MacOS,
    Windows,
    IOS,
    Android,
}

impl Platform {
    pub fn current() -> Self {
        if cfg!(target_os = "ios") {
            Platform::IOS
        } else if cfg!(target_os = "android") {
            Platform::Android
        } else if cfg!(target_os = "macos") {
            Platform::MacOS
        } else if cfg!(target_os = "windows") {
            Platform::Windows
        } else {
            Platform::Linux
        }
    }

    pub fn get_storage_dir() -> PathBuf {
        match Self::current() {
            Platform::IOS | Platform::Android => {
                // Mobile: Use standard application data directory
                dirs::data_dir().unwrap_or_else(|| PathBuf::from("./data"))
            }
            _ => {
                // Desktop: Use local directory for hackathon/V2.0 demo or standard paths
                PathBuf::from("./")
            }
        }
    }

    pub fn is_mobile(&self) -> bool {
        matches!(self, Platform::IOS | Platform::Android)
    }

    pub fn get_network_interface() -> &'static str {
        match Self::current() {
            Platform::IOS | Platform::Android => "wlan0",
            Platform::MacOS => "en0",
            _ => "eth0",
        }
    }
}
