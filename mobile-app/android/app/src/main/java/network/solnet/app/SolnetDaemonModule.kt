package network.solnet.app

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.Mac
import javax.crypto.SecretKey

/**
 * SolnetDaemonModule — Android Kotlin native module.
 *
 * Security model:
 *   1. On first launch, generates a 32-byte session token and stores
 *      it in the Android Keystore (hardware-backed on supported devices).
 *   2. Initialises the Rust governor via JNI: rustInitGovernor(token, 32).
 *   3. All throttle calls use rustSetThrottleStateAuthenticated().
 *
 * JNI functions map 1:1 to #[no_mangle] extern "C" in sns-daemon/src/lib.rs.
 */
class SolnetDaemonModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "SolnetDaemon"
        private const val THROTTLE_CHANGED_EVENT = "DaemonThrottleChanged"
        private const val LOG_LINE_EVENT = "DaemonLogLine"
        private const val KEYSTORE_ALIAS = "solnet_governor_token"

        private var nativeAvailable = false

        init {
            try {
                System.loadLibrary("sns_daemon")
                nativeAvailable = true
            } catch (e: UnsatisfiedLinkError) {
                android.util.Log.w(MODULE_NAME, "libsns_daemon.so not found — stub mode")
            }
        }
    }

    private var daemonRunning = false
    private var sessionToken: ByteArray? = null

    init {
        initializeGovernor()
    }

    override fun getName(): String = MODULE_NAME

    // ── Governor initialisation ─────────────────────────────────────────────

    private fun initializeGovernor() {
        if (!nativeAvailable) return

        // Generate or retrieve session token
        sessionToken = loadOrCreateToken()
        val token = sessionToken ?: return

        val result = rustInitGovernor(token, token.size)
        if (!result) {
            android.util.Log.w(MODULE_NAME, "Governor already initialised")
        }
    }

    private fun loadOrCreateToken(): ByteArray? {
        return try {
            val keyStore = KeyStore.getInstance("AndroidKeyStore")
            keyStore.load(null)

            if (!keyStore.containsAlias(KEYSTORE_ALIAS)) {
                // Generate a new AES key and derive 32 bytes from it
                val keyGen = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_HMAC_SHA256,
                    "AndroidKeyStore"
                )
                val spec = KeyGenParameterSpec.Builder(
                    KEYSTORE_ALIAS,
                    KeyProperties.PURPOSE_SIGN
                ).build()
                keyGen.init(spec)
                keyGen.generateKey()
            }

            // Derive a deterministic 32-byte token from the stored key
            val entry = keyStore.getEntry(KEYSTORE_ALIAS, null) as KeyStore.SecretKeyEntry
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(entry.secretKey)
            mac.doFinal("solnet_governor_session".toByteArray())
        } catch (e: Exception) {
            android.util.Log.e(MODULE_NAME, "Keystore token generation failed: ${e.message}")
            // Fallback: generate random bytes in memory (not persistent but functional)
            val fallback = ByteArray(32)
            java.security.SecureRandom().nextBytes(fallback)
            fallback
        }
    }

    // ── React Native Methods ────────────────────────────────────────────────

    @ReactMethod
    fun setThrottleState(state: String, promise: Promise) {
        val token = sessionToken
        if (token == null || !nativeAvailable) {
            promise.resolve(null) // stub mode
            return
        }

        try {
            val stateCode: Int = when (state) {
                "FULL_POWER" -> 0
                "CONSERVE"   -> 1
                else         -> 2 // STANDBY
            }

            val success = rustSetThrottleStateAuthenticated(
                stateCode.toByte(),
                token,
                token.size
            )

            if (success) {
                sendEvent(THROTTLE_CHANGED_EVENT, state)
                promise.resolve(null)
            } else {
                promise.reject("AUTH_FAILED", "Throttle state auth failed")
            }
        } catch (e: UnsatisfiedLinkError) {
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("THROTTLE_STATE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startDaemon(promise: Promise) {
        try {
            if (daemonRunning || !nativeAvailable) {
                promise.resolve(null)
                return
            }
            rustStartDaemon()
            daemonRunning = true
            promise.resolve(null)
        } catch (e: UnsatisfiedLinkError) {
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DAEMON_START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopDaemon(promise: Promise) {
        try {
            if (!daemonRunning || !nativeAvailable) {
                promise.resolve(null)
                return
            }
            rustStopDaemon()
            daemonRunning = false
            promise.resolve(null)
        } catch (e: UnsatisfiedLinkError) {
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DAEMON_STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getDaemonStats(promise: Promise) {
        if (!nativeAvailable) {
            val map = Arguments.createMap().apply {
                putInt("requests_served", 0)
                putInt("connections", 0)
                putInt("uptime_secs", 0)
                putString("throttle_state", "STANDBY")
            }
            promise.resolve(map)
            return
        }

        var statsPtr: String? = null
        try {
            statsPtr = rustGetDaemonStats()
            val jsonStr = statsPtr ?: """
                {"requests_served":0,"connections":0,"uptime_secs":0,"throttle_state":"STANDBY"}
            """.trimIndent()

            val map = Arguments.createMap()
            val json = org.json.JSONObject(jsonStr)
            map.putInt("requests_served", json.optInt("requests_served", 0))
            map.putInt("connections", json.optInt("connections", 0))
            map.putInt("uptime_secs", json.optInt("uptime_secs", 0))
            map.putString("throttle_state", json.optString("throttle_state", "STANDBY"))
            promise.resolve(map)
        } catch (e: Exception) {
            val map = Arguments.createMap().apply {
                putInt("requests_served", 0)
                putInt("connections", 0)
                putInt("uptime_secs", 0)
                putString("throttle_state", "STANDBY")
            }
            promise.resolve(map)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) { /* no-op */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

    // ── Private helpers ─────────────────────────────────────────────────────

    private fun sendEvent(eventName: String, payload: Any?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, payload)
    }

    // ── JNI declarations — map to #[no_mangle] extern "C" in lib.rs ────────

    private external fun rustInitGovernor(token: ByteArray, len: Int): Boolean
    private external fun rustSetThrottleStateAuthenticated(
        state: Byte, token: ByteArray, tokenLen: Int
    ): Boolean
    private external fun rustStartDaemon()
    private external fun rustStopDaemon()
    private external fun rustGetDaemonStats(): String?
    private external fun rustStartRelay(configJson: String): Boolean
    private external fun rustStopRelay(): Boolean

    // ── Relay lifecycle ─────────────────────────────────────────────────────

    @ReactMethod
    fun startRelay(configJson: String, promise: Promise) {
        // Validate HTTPS before crossing JNI boundary
        if (!configJson.contains("https://")) {
            promise.reject("INVALID_CONFIG", "relay_url must use HTTPS")
            return
        }
        // JNI calls must be on a worker thread — never the JS/UI thread
        Thread {
            try {
                val result = rustStartRelay(configJson)
                promise.resolve(
                    Arguments.createMap().apply {
                        putBoolean("ok", result)
                        putString("mode", "relay")
                    }
                )
            } catch (e: UnsatisfiedLinkError) {
                promise.resolve(
                    Arguments.createMap().apply {
                        putBoolean("ok", false)
                        putBoolean("isStub", true)
                    }
                )
            }
        }.start()
    }

    @ReactMethod
    fun stopRelay(promise: Promise) {
        try {
            val result = rustStopRelay()
            promise.resolve(
                Arguments.createMap().apply {
                    putBoolean("ok", result)
                }
            )
        } catch (e: UnsatisfiedLinkError) {
            promise.resolve(
                Arguments.createMap().apply {
                    putBoolean("ok", true)
                    putBoolean("isStub", true)
                }
            )
        }
    }
}
