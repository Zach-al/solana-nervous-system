import 'react-native-get-random-values';
import { polyfillWebCrypto } from 'expo-standard-web-crypto';
import { Buffer } from 'buffer';

// Force polyfill BEFORE anything else
global.Buffer = Buffer;
polyfillWebCrypto();

// Fallback if expo polyfill fails
if (typeof global.crypto?.getRandomValues !== 'function') {
  const { getRandomValues } = require('expo-crypto');
  global.crypto = global.crypto || {};
  global.crypto.getRandomValues = (arr) => {
    const bytes = getRandomValues(new Uint8Array(arr.length));
    arr.set(bytes);
    return arr;
  };
}

// Now load app
import 'expo-router/entry';
