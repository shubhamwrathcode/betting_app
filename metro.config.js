const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')

const defaultConfig = getDefaultConfig(__dirname)
const { assetExts, sourceExts } = defaultConfig.resolver

/** @type {import('@react-native/metro-config').MetroConfig} */
const svgConfig = {
  transformer: {
    ...defaultConfig.transformer,
    babelTransformerPath: require.resolve('react-native-svg-transformer/react-native'),
  },
  resolver: {
    ...defaultConfig.resolver,
    assetExts: [...assetExts.filter(ext => ext !== 'svg'), 'mp4'],
    sourceExts: [...sourceExts, 'svg'],
  },
}

if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

module.exports = mergeConfig(defaultConfig, svgConfig)
