module.exports = ({ config }) => {
  const shared = {
    ...config,
    android: {
      ...config.android,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
    },
    plugins: [
      ...(config.plugins || []),
      'react-native-blob-util',
      '@config-plugins/react-native-pdf',
      '@config-plugins/react-native-blob-util',
      './plugins/withFmtCompatibility',
    ],
  };
  const personalPreview = process.env.VFIXURPC_PERSONAL_IOS === '1';
  if (!personalPreview) return shared;

  return {
    ...shared,
    name: 'VfixurPC Preview',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.vfixurpc.app.personal',
    },
    // Entitlement mods execute in reverse registration order.
    plugins: ['./plugins/withPersonalPreview', ...shared.plugins],
    extra: { ...config.extra, personalPreview: true },
  };
};
