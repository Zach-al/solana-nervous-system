/**
 * polyfills.js
 * 
 * SOLNET Production Bootloader - Final Stage Polyfills
 * This file MUST be imported before everything else.
 */

try {
  // 1. Process Guard (Safe root-level require)
  if (typeof global.process === 'undefined') {
    global.process = require('process');
  }
  
  if (global.process && !global.process.env) {
    global.process.env = {};
  }

  // 2. Buffer (Required for Solana Web3 serialization)
  if (typeof global.Buffer === 'undefined') {
    global.Buffer = require('buffer').Buffer;
  }

  // 3. Text Encoding (Required for cryptographic string/byte conversions)
  if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('text-encoding');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
  }

  // 4. WHATWG URL / URLSearchParams (Required for network request parsing)
  if (typeof global.URL === 'undefined') {
    const { URL, URLSearchParams } = require('whatwg-url');
    global.URL = URL;
    global.URLSearchParams = URLSearchParams;
  }

  // 5. WHATWG Fetch (Mandatory for expo-router / metro-runtime polyfill stack)
  if (typeof global.fetch === 'undefined') {
    require('whatwg-fetch');
  }

  // 6. Fabric Event Guard (Zero-Crash Insurance for iOS)
  // Prevents "Unsupported top level event type topSvgLayout" from crashing the app
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (error && error.message && error.message.includes('topSvgLayout')) {
      console.warn('⚠️ SOLNET Bootloader: Suppressed unhandled Fabric event (topSvgLayout)');
      return;
    }
    originalHandler(error, isFatal);
  });

  console.log('✅ SOLNET Bootloader: Environment Ready');
} catch (e) {
  console.error('❌ SOLNET Bootloader: Critical initialization failure:', e);
}
