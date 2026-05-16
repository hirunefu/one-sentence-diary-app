describe('localAuth under E2E flag', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('authenticate() returns true immediately when IS_E2E', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const mockAuth = jest.fn();
    jest.doMock('expo-local-authentication', () => ({
      authenticateAsync: mockAuth,
      hasHardwareAsync: jest.fn(),
      isEnrolledAsync: jest.fn(),
    }));
    const { authenticate } = require('./localAuth');
    await expect(authenticate()).resolves.toBe(true);
    expect(mockAuth).not.toHaveBeenCalled();
  });

  test('isLocalAuthAvailable() returns true immediately when IS_E2E', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const mockHw = jest.fn();
    jest.doMock('expo-local-authentication', () => ({
      hasHardwareAsync: mockHw,
      isEnrolledAsync: jest.fn(),
      authenticateAsync: jest.fn(),
    }));
    const { isLocalAuthAvailable } = require('./localAuth');
    await expect(isLocalAuthAvailable()).resolves.toBe(true);
    expect(mockHw).not.toHaveBeenCalled();
  });

  test('falls through to real APIs when EXPO_PUBLIC_E2E is unset', async () => {
    delete process.env.EXPO_PUBLIC_E2E;
    const mockAuth = jest.fn().mockResolvedValue({ success: true });
    jest.doMock('expo-local-authentication', () => ({
      authenticateAsync: mockAuth,
      hasHardwareAsync: jest.fn().mockResolvedValue(true),
      isEnrolledAsync: jest.fn().mockResolvedValue(true),
    }));
    const { authenticate } = require('./localAuth');
    await authenticate();
    expect(mockAuth).toHaveBeenCalledTimes(1);
  });
});
