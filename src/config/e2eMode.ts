// EXPO_PUBLIC_E2E=1 is set by the E2E build profile. The EXPO_PUBLIC_
// prefix is required for Expo's bundler to statically inline the value at
// build time, so IS_E2E becomes a compile-time constant in production
// (undefined → false → the branches that read it are eliminated by DCE).
export const IS_E2E = process.env.EXPO_PUBLIC_E2E === '1';
