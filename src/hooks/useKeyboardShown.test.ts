import { Keyboard } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useKeyboardShown } from './useKeyboardShown';

describe('useKeyboardShown', () => {
  const handlers: Record<string, () => void> = {};
  const remove = jest.fn();

  beforeEach(() => {
    remove.mockClear();
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      handler: () => void
    ) => {
      handlers[event] = handler;
      return { remove };
    }) as never);
  });
  afterEach(() => jest.restoreAllMocks());

  test('starts from whether the keyboard is up, then follows it', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const { result, unmount } = await renderHook(() => useKeyboardShown());
    expect(result.current).toBe(true);

    await act(() => handlers.keyboardDidHide?.());
    expect(result.current).toBe(false);
    await act(() => handlers.keyboardDidShow?.());
    expect(result.current).toBe(true);

    await unmount();
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
