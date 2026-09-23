import { AccessibilityInfo } from 'react-native';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useReduceMotion } from './useReduceMotion';

describe('useReduceMotion', () => {
  let emit: ((enabled: boolean) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    emit = undefined;
    remove.mockClear();
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_event: string, handler: (v: boolean) => void) => {
      emit = handler;
      return { remove };
    }) as never);
  });

  afterEach(() => jest.restoreAllMocks());

  test('follows the OS setting and its later changes', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { result, unmount } = await renderHook(() => useReduceMotion());
    await waitFor(() => expect(result.current).toBe(true));

    await act(() => emit?.(false));
    expect(result.current).toBe(false);

    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
