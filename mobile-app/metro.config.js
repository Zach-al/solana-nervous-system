const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Force crypto polyfills to load first
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Intercept crypto imports and redirect to polyfill
  if (moduleName === 'crypto') {
    return {
      filePath: require.resolve('expo-crypto'),
      type: 'sourceFile',
    };
  }
  
  // Let Metro handle everything else
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.unstable_enablePackageExports = true;
config.resolver.resolverMainFields = ['sbrio', 'browser', 'main'];

module.exports = withNativeWind(config, { input: "./global.css" });
