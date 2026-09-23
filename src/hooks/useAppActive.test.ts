import { AppState, type AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useAppActive } from './useAppActive';

describe('useAppActive', () => {
  let emit: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    emit = undefined;
    remove.mockClear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (s: AppStateStatus) => void
    ) => {
      emit = handler;
      return { remove };
    }) as never);
  });

  afterEach(() => jest.restoreAllMocks());

  test('is false while the app is in the background', async () => {
    const { result, unmount } = await renderHook(() => useAppActive());

    await act(() => emit?.('background'));
    expect(result.current).toBe(false);
    await act(() => emit?.('active'));
    expect(result.current).toBe(true);

    await unmount();
    expect(remove).toHaveBeenCalled();
  });
});
