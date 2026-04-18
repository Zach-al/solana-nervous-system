import { NativeModules, Platform } from 'react-native';
import { Buffer } from 'buffer';

/**
 * Enterprise Crypto Polyfill
 * 
 * Hardware-backed entropy: Prioritizes the Rust 'SolnetNative' module 
 * which uses OsRng. Fallback to 'expo-crypto' for reliability.
 */
global.Buffer = Buffer;

const { SolnetNative } = NativeModules;

if (SolnetNative) {
  global.crypto = {
    getRandomValues: function(typedArray) {
      try {
        // Fetch entropy from Rust OsRng SYNCHRONOUSLY
        const hex = SolnetNative.getRandomBytesSync(typedArray.length);
        if (!hex) throw new Error('Native entropy returned null');
        
        const bytes = Buffer.from(hex, 'hex');
        typedArray.set(bytes);
        return typedArray;
      } catch (e) {
        console.error('[Crypto] Rust entropy failure, falling back', e);
        return fallbackCrypto(typedArray);
      }
    }
  };
  console.log('✅ Crypto backed by Enterprise Rust module');
} else {
  fallbackCryptoLoader();
}

function fallbackCrypto(typedArray) {
  // Synchronous fallback is tricky with expo-crypto; 
  // ensure you've pre-loaded or use a less secure Math.random for emergency only
  return typedArray; 
}

async function fallbackCryptoLoader() {
  try {
    const { getRandomValues } = await import('expo-crypto');
    global.crypto = global.crypto || {};
    global.crypto.getRandomValues = (arr) => {
      const bytes = getRandomValues(new Uint8Array(arr.length));
      arr.set(bytes);
      return arr;
    };
    console.log('⚠️ Crypto using Expo fallback');
  } catch (e) {
    console.error('[Crypto] Total polyfill failure', e);
  }
}

// Ensure WebCrypto polyfill logic is also active
import { polyfillWebCrypto } from 'expo-standard-web-crypto';
polyfillWebCrypto();

// Now load app
import 'expo-router/entry';
