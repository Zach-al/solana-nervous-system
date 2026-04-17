// mobile-app/index.js
// Polyfills MUST load before anything else.
// Order is load-bearing — do not reorder these four lines.
import 'react-native-get-random-values';
import { polyfillWebCrypto } from 'expo-standard-web-crypto';
import { Buffer } from 'buffer';

global.Buffer = Buffer;
polyfillWebCrypto();

// Expo Router entry — this replaces App.js entirely.
// The app/ directory handles all routing from here.
import 'expo-router/entry';
