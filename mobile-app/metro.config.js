const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// ── PNPM RECONCILIATION ───────────────────────────────────────────
// Force all dependencies to resolve to the root node_modules.
// This prevents "Tried to register two views with the same name"
// by ensuring there's exactly one copy of react-native in the bundle.
const extraNodeModules = {
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'react': path.resolve(projectRoot, 'node_modules/react'),
  '@react-native-async-storage/async-storage': path.resolve(projectRoot, 'node_modules/@react-native-async-storage/async-storage'),
};

config.resolver.extraNodeModules = extraNodeModules;

// Keep it simple - avoid multiple nodeModulesPaths which can cause 
// the duplicate view registration issues in monorepos or pnpm setups.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Ensure we look for .js and .json in the correct order
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = withNativeWind(config, { input: './global.css' });
