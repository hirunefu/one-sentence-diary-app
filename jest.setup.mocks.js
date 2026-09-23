// Native modules without a JS fallback throw as soon as they are imported in
// jest, so every test that reaches them through a context or a hook gets the
// libraries' own mocks.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
