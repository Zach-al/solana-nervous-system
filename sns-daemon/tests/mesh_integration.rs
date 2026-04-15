#[cfg(test)]
mod tests {
    // We import required modules locally to test
    use sns_daemon::identity::NodeIdentity;
    use libp2p::PeerId;

    #[test]
    fn test_identity_persistence() {
        // Since std::env runs parallel in tests, we use a unique file limit.
        std::env::set_var("SOLNET_KEY_PATH", "./test_keypair.bin");
        std::env::remove_var("SOLNET_NODE_KEY"); // Ensure fallback
        
        // Generate identity
        let kp1 = NodeIdentity::load_or_generate();
        let peer_id_1 = libp2p::PeerId::from(kp1.public());

        // Should load same identity from disk/env
        let kp2 = NodeIdentity::load_or_generate();
        let peer_id_2 = libp2p::PeerId::from(kp2.public());

        // Same peer ID = stable identity
        assert_eq!(peer_id_1, peer_id_2);

        // cleanup
        let _ = std::fs::remove_file("./test_keypair.bin");
    }

    #[test]
    fn test_config_relay_defaults() {
        // Default: not a relay
        std::env::remove_var("SOLNET_IS_RELAY");
        let cfg = sns_daemon::config::Config::from_env();
        assert_eq!(cfg.is_relay, false);
    }

    #[test]
    fn test_config_relay_enabled() {
        std::env::set_var("SOLNET_IS_RELAY", "true");
        // Config should have is_relay: true
        let cfg = sns_daemon::config::Config::from_env();
        assert_eq!(cfg.is_relay, true);
        std::env::remove_var("SOLNET_IS_RELAY");
    }

    #[test]
    fn test_bootstrap_parsing() {
        let addr = "/dns4/solnet-production.up.railway.app/tcp/9001/p2p/12D3KooWTest";
        // Should parse as valid multiaddr
        let parsed: Result<libp2p::Multiaddr, _> = addr.parse();
        assert!(parsed.is_ok());
    }
}
