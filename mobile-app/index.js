// mobile-app/index.js
// ──────────────────────────────────────────────────────
// CRITICAL: Polyfills MUST load before ANYTHING else.
// Order is load-bearing. Do not reorder these lines.
// ──────────────────────────────────────────────────────

// Step 1: Seed the PRNG — must be absolute first import
import 'react-native-get-random-values';

// Step 2: Web Crypto API polyfill
import { polyfillWebCrypto } from 'expo-standard-web-crypto';

// Step 3: Buffer global (required by @solana/web3.js)
import { Buffer } from 'buffer';

global.Buffer = Buffer;
polyfillWebCrypto();

// Step 4: Verify crypto.getRandomValues is callable.
// Falls back to expo-crypto native impl if the polyfill silently failed.
if (typeof global.crypto?.getRandomValues !== 'function') {
  console.warn('[SOLNET] crypto.getRandomValues not defined after polyfill — applying expo-crypto fallback');
  const { getRandomValues: expoGetRandomValues } = require('expo-crypto');
  global.crypto = {
    ...(global.crypto ?? {}),
    getRandomValues: (array) => {
      const randomBytes = expoGetRandomValues(new Uint8Array(array.byteLength));
      array.set(randomBytes);
      return array;
    },
  };
} else {
  console.log('[SOLNET] crypto.getRandomValues OK');
}

// ──────────────────────────────────────────────────────
// Expo Router entry — app/ directory handles all routing.
// Do NOT import App.js — this project uses expo-router.
// ──────────────────────────────────────────────────────
import 'expo-router/entry';
