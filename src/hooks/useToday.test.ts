import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useToday } from './useToday';

describe('useToday', () => {
  let onChange: ((state: string) => void) | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_e: string, h: (s: string) => void) => {
      onChange = h;
      return { remove: jest.fn() };
    }) as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('rolls over at local midnight while the app stays open', async () => {
    jest.setSystemTime(new Date(2026, 8, 23, 23, 59, 0));
    const { result } = await renderHook(() => useToday());
    expect(result.current).toBe('2026-09-23');

    await act(() => jest.advanceTimersByTime(2 * 60 * 1000));
    expect(result.current).toBe('2026-09-24');
  });

  test('catches up when the app comes back on a later day', async () => {
    jest.setSystemTime(new Date(2026, 8, 23, 12, 0, 0));
    const { result } = await renderHook(() => useToday());

    jest.setSystemTime(new Date(2026, 8, 25, 8, 0, 0));
    await act(() => onChange?.('active'));
    expect(result.current).toBe('2026-09-25');
  });
});
