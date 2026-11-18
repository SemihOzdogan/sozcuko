module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((@)?react-native|@react-native(-community)?|react-native-gesture-handler|@react-navigation)/)',
  ],
  moduleNameMapper: {
    '^react-native-gesture-handler$':
      '<rootDir>/__mocks__/react-native-gesture-handler.js',
    '^react-native-linear-gradient$':
      '<rootDir>/__mocks__/react-native-linear-gradient.js',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/__mocks__/async-storage.js',
    '^@react-native-google-signin/google-signin$':
      '<rootDir>/__mocks__/google-signin.js',
    '^@invertase/react-native-apple-authentication$':
      '<rootDir>/__mocks__/apple-authentication.js',
  },
};
