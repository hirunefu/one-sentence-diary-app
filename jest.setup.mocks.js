// Native modules without a JS fallback throw as soon as they are imported in
// jest, so every test that reaches them through a context or a hook gets the
// libraries' own mocks.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);

// expo-notifications (SDK 58+) subscribes to its native handler module as soon
// as it is imported, and the app takes that subscription back at startup
// (src/services/notifications.ts). jest-expo's stand-in for the native module
// returns no subscription to take back, so give it one.
globalThis.expo.modules.ExpoNotificationsHandlerModule = {
  ...globalThis.expo.modules.ExpoNotificationsHandlerModule,
  addListener: () => ({ remove: () => {} }),
};
