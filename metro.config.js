// Resolver overrides the Privy Expo SDK needs (from Privy's Expo install guide).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // jose's package exports pick its Node build (imports `crypto`); force the browser build.
  if (moduleName === 'jose') {
    const ctx = { ...context, unstable_conditionNames: ['browser'] };
    return ctx.resolveRequest(ctx, moduleName, platform);
  }
  // isows (via viem) and zustand@4 ship package exports Metro can't use.
  if (moduleName === 'isows' || moduleName.startsWith('zustand')) {
    const ctx = { ...context, unstable_enablePackageExports: false };
    return ctx.resolveRequest(ctx, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
