module.exports = ({ config }) => ({
  ...config,
  name: 'Mumbai Flood',
  userInterfaceStyle: 'automatic',
  plugins: [...(config.plugins || []), ['expo-location', {
    locationWhenInUsePermission: 'Allow Mumbai Flood to locate you on the map and set your route start.',
  }], ['react-native-maps', {
    androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || '',
    iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY || '',
  }]],
})
