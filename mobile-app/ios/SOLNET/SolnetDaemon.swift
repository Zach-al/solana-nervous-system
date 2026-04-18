import Foundation
import React
import Security

/// SolnetDaemon — iOS native module bridging React Native ↔ Rust daemon.
///
/// Security model:
///   1. On first launch, generates a 32-byte session token via SecRandomCopyBytes.
///   2. Stores the token in the iOS Keychain (kSecClassGenericPassword).
///   3. Calls rust_init_governor(token, 32) to initialise the Rust governor.
///   4. All subsequent throttle calls use rust_set_throttle_state_authenticated().
///
/// FFI functions are imported via SOLNET-Bridging-Header.h → solnet_ffi.h.
/// No @_silgen_name is used — all symbols come from the bridging header.
@objc(SolnetDaemon)
class SolnetDaemon: RCTEventEmitter {

  private var daemonRunning = false
  private var sessionToken: Data?

  // MARK: — Lifecycle

  override init() {
    super.init()
    initializeGovernor()
  }

  // MARK: — RCTEventEmitter

  override func supportedEvents() -> [String]! {
    return ["DaemonThrottleChanged", "DaemonLogLine"]
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  // MARK: — Governor initialisation

  private func initializeGovernor() {
    // Try to load existing token from Keychain
    if let existing = loadFromKeychain(key: "solnet_governor_token") {
      sessionToken = existing
    } else {
      // Generate a new 32-byte token
      var bytes = [UInt8](repeating: 0, count: 32)
      let status = SecRandomCopyBytes(kSecRandomDefault, 32, &bytes)
      guard status == errSecSuccess else {
        NSLog("[SolnetDaemon] CRITICAL: SecRandomCopyBytes failed: \(status)")
        return
      }
      let token = Data(bytes)
      saveToKeychain(key: "solnet_governor_token", value: token)
      sessionToken = token
    }

    // Initialise the Rust governor with the token
    guard let token = sessionToken else { return }
    token.withUnsafeBytes { rawBuffer in
      guard let ptr = rawBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self) else { return }
      let result = rust_init_governor(ptr, 32)
      if !result {
        NSLog("[SolnetDaemon] Governor already initialised (duplicate init call)")
      }
    }
  }

  // MARK: — React Methods

  @objc
  func setThrottleState(
    _ state: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let token = sessionToken else {
      reject("NO_TOKEN", "Governor session token not initialised", nil)
      return
    }

    let stateCode: UInt8
    switch state {
    case "FULL_POWER": stateCode = 0
    case "CONSERVE":   stateCode = 1
    default:           stateCode = 2 // STANDBY
    }

    let success = token.withUnsafeBytes { rawBuffer -> Bool in
      guard let ptr = rawBuffer.baseAddress?.assumingMemoryBound(to: UInt8.self) else {
        return false
      }
      return rust_set_throttle_state_authenticated(stateCode, ptr, 32)
    }

    if success {
      sendEvent(withName: "DaemonThrottleChanged", body: state)
      resolve(nil)
    } else {
      reject("AUTH_FAILED", "Throttle state authentication failed", nil)
    }
  }

  @objc
  func startDaemon(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard !daemonRunning else {
      resolve(nil)
      return
    }
    daemonRunning = true
    rust_start_daemon()
    resolve(nil)
  }

  @objc
  func stopDaemon(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard daemonRunning else {
      resolve(nil)
      return
    }
    daemonRunning = false
    rust_stop_daemon()
    resolve(nil)
  }

  @objc
  func getDaemonStats(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    var statsPtr: UnsafeMutablePointer<CChar>? = rust_get_daemon_stats()
    defer {
      rust_free_string(statsPtr)
      statsPtr = nil
    }

    guard let raw = statsPtr,
          let jsonStr = String(cString: raw, encoding: .utf8),
          let data = jsonStr.data(using: .utf8),
          let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      resolve([
        "requests_served": 0,
        "connections": 0,
        "uptime_secs": 0,
        "throttle_state": "STANDBY"
      ] as [String: Any])
      return
    }

    resolve(dict)
  }

  // MARK: — Relay lifecycle

  @objc func startRelay(
      _ configJson: String,
      resolver resolve: @escaping RCTPromiseResolveBlock,
      rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
      // Validate HTTPS before calling into Rust
      guard configJson.contains("https://") else {
          reject("INVALID_CONFIG", "relay_url must use HTTPS", nil)
          return
      }

      // Ensure governor is initialized (idempotent)
      initializeGovernor()

      // Call Rust on a background thread — never block the JS thread
      DispatchQueue.global(qos: .utility).async {
          guard let cStr = configJson.cString(using: .utf8) else {
              DispatchQueue.main.async {
                  reject("INVALID_CONFIG", "Config not valid UTF-8", nil)
              }
              return
          }
          let result = rust_start_relay(cStr)
          DispatchQueue.main.async {
              if result {
                  resolve(["ok": true, "mode": "relay"])
              } else {
                  reject("START_FAILED", "rust_start_relay returned false", nil)
              }
          }
      }
  }

  @objc func stopRelay(
      _ resolve: @escaping RCTPromiseResolveBlock,
      rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
      let result = rust_stop_relay()
      resolve(["ok": result])
  }

  // MARK: — Keychain helpers

  private func saveToKeychain(key: String, value: Data) {
    let query: [String: Any] = [
      kSecClass as String:       kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecValueData as String:   value,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    // Delete any existing entry first
    SecItemDelete(query as CFDictionary)
    let status = SecItemAdd(query as CFDictionary, nil)
    if status != errSecSuccess {
      NSLog("[SolnetDaemon] Keychain save failed: \(status)")
    }
  }

  private func loadFromKeychain(key: String) -> Data? {
    let query: [String: Any] = [
      kSecClass as String:       kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecReturnData as String:  true,
      kSecMatchLimit as String:  kSecMatchLimitOne,
    ]
    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else { return nil }
    return data
  }
}
