const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      // Ensure sqlite storage is properly resolved
      'react-native-sqlite-storage': require.resolve('react-native-sqlite-storage'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);