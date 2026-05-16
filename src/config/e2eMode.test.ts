describe('IS_E2E', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_E2E;
  });

  test('is false when EXPO_PUBLIC_E2E is unset', () => {
    const { IS_E2E } = require('./e2eMode');
    expect(IS_E2E).toBe(false);
  });

  test('is true when EXPO_PUBLIC_E2E equals "1"', () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const { IS_E2E } = require('./e2eMode');
    expect(IS_E2E).toBe(true);
  });

  test('is false for any other value', () => {
    process.env.EXPO_PUBLIC_E2E = 'true';
    const { IS_E2E } = require('./e2eMode');
    expect(IS_E2E).toBe(false);
  });
});
