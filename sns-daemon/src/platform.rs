use std::time::Duration;

#[derive(Debug, Clone, PartialEq)]
#[allow(non_camel_case_types)]
pub enum PlatformTarget {
    MacOS,
    Linux,
    Windows,
    iOS,
    Android,
    RaspberryPi,
}

#[derive(Debug, Clone)]
pub struct PlatformConfig {
    pub max_concurrent_requests: usize,
    pub batch_interval: Duration,
    pub p2p_enabled: bool,
    pub cache_size_mb: usize,
    pub http_port: u16,
    pub p2p_port: u16,
    pub battery_mode: bool,
    pub log_level: &'static str,
    pub platform_name: &'static str,
}

pub struct Platform;

impl Platform {
    /// Detect current platform at compile time
    pub fn detect() -> PlatformTarget {
        #[cfg(target_os = "ios")]
        return PlatformTarget::iOS;

        #[cfg(target_os = "android")]
        return PlatformTarget::Android;

        #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
        return PlatformTarget::RaspberryPi;

        #[cfg(target_os = "macos")]
        return PlatformTarget::MacOS;

        #[cfg(target_os = "windows")]
        return PlatformTarget::Windows;

        #[cfg(all(target_os = "linux", not(target_arch = "aarch64")))]
        return PlatformTarget::Linux;

        // Default fallback
        #[allow(unreachable_code)]
        PlatformTarget::Linux
    }

    /// Get optimal config for detected platform
    pub fn get_config() -> PlatformConfig {
        match Self::detect() {
            PlatformTarget::iOS => PlatformConfig {
                max_concurrent_requests: 8,
                batch_interval: Duration::from_secs(7200),
                p2p_enabled: false,
                cache_size_mb: 12,
                http_port: 9000,
                p2p_port: 9001,
                battery_mode: true,
                log_level: "warn",
                platform_name: "iOS",
            },
            PlatformTarget::Android => PlatformConfig {
                max_concurrent_requests: 12,
                batch_interval: Duration::from_secs(7200),
                p2p_enabled: false,
                cache_size_mb: 16,
                http_port: 9000,
                p2p_port: 9001,
                battery_mode: true,
                log_level: "warn",
                platform_name: "Android",
            },
            PlatformTarget::RaspberryPi => PlatformConfig {
                max_concurrent_requests: 50,
                batch_interval: Duration::from_secs(3600),
                p2p_enabled: true,
                cache_size_mb: 64,
                http_port: 9000,
                p2p_port: 9001,
                battery_mode: false,
                log_level: "info",
                platform_name: "Raspberry Pi",
            },
            PlatformTarget::MacOS |
            PlatformTarget::Linux |
            PlatformTarget::Windows => PlatformConfig {
                max_concurrent_requests: 500,
                batch_interval: Duration::from_secs(3600),
                p2p_enabled: true,
                cache_size_mb: 256,
                http_port: 9000,
                p2p_port: 9001,
                battery_mode: false,
                log_level: "info",
                platform_name: "Desktop",
            },
        }
    }

    /// Print platform banner on startup
    pub fn print_banner(config: &PlatformConfig) {
        println!("╔══════════════════════════════════════╗");
        println!("║     SOLNET Mobile/Desktop Daemon     ║");
        println!("╠══════════════════════════════════════╣");
        println!("║  PLATFORM : {:<25}║", config.platform_name);
        println!("║  MAX CONC : {:<25}║", config.max_concurrent_requests);
        println!("║  P2P MESH : {:<25}║",
            if config.p2p_enabled { "ENABLED" } else { "DISABLED (mobile)" });
        println!("║  BATTERY  : {:<25}║",
            if config.battery_mode { "OPTIMIZED" } else { "PERFORMANCE" });
        println!("║  CACHE    : {}MB{:<22}║", config.cache_size_mb, "");
        println!("╚══════════════════════════════════════╝");
    }
}
