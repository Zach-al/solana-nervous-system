const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// 1. pnpm/Monorepo Resolution Strategy
// We expose both the local node_modules and the pnpm virtual store node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules/.pnpm/node_modules'),
];

// 2. The "Nuclear" pnpm Fix
// Official flag to stop Metro from failing when it enters symlinked .pnpm folders
config.resolver.disableHierarchicalLookup = true;

// 3. Modern Package Support (Required for SDK 54)
config.resolver.unstable_enablePackageExports = true;

// 4. Solana web3.js ESM support (.mjs)
config.resolver.sourceExts = ['mjs', ...config.resolver.sourceExts];

// 5. Global Node Polyfills
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('expo-standard-web-crypto'),
  stream: require.resolve('readable-stream'),
};

module.exports = withNativeWind(config, { input: './global.css' });
