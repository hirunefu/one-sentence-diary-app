import { act, renderHook } from '@testing-library/react-native';
import type { LayoutChangeEvent } from 'react-native';

let mockWindow = { width: 360, height: 640, fontScale: 2, scale: 3 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow,
}));

import { useRoom } from './useRoom';

const layout = (height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width: 324, height } } }) as LayoutChangeEvent;
const SLOT = ['dots', 'offer', 'first-day'];

type Props = { wanting: string[] };
async function setup(wanting: string[]) {
  const hook = await renderHook(({ wanting: w }: Props) => useRoom(w, SLOT), {
    initialProps: { wanting },
  });
  const r = () => hook.result.current;
  return { ...hook, r };
}

describe('useRoom', () => {
  beforeEach(() => {
    mockWindow = { width: 360, height: 640, fontScale: 2, scale: 3 };
  });

  test('a line that gave way stays away while nothing changes, even as the body grows into its place', async () => {
    const { r } = await setup(['privacy', 'dots']);
    await act(async () => {
      r().measure('privacy')(layout(66));
      r().measure('dots')(layout(66));
      r().onNeed(146);
      r().onBody(layout(150));
    });
    expect(r().fits('privacy')).toBe(true);
    expect(r().fits('dots')).toBe(false);

    await act(async () => r().onBody(layout(216)));
    expect(r().fits('dots')).toBe(false);
  });

  test('decides again when the lines that want to show change', async () => {
    const { r, rerender } = await setup(['offer', 'first-day']);
    await act(async () => {
      r().measure('offer')(layout(134));
      r().measure('first-day')(layout(66));
      r().onNeed(83);
      r().onBody(layout(40));
    });
    expect(r().fits('offer')).toBe(true);
    expect(r().fits('first-day')).toBe(false);

    // The offer is answered: 「1日目」 has the room again.
    await rerender({ wanting: ['first-day'] });
    await act(async () => r().onBody(layout(174)));
    expect(r().fits('first-day')).toBe(true);
  });

  test('decides again for a new window, from its own measurements only', async () => {
    const { r, rerender } = await setup(['privacy', 'dots']);
    await act(async () => {
      r().measure('privacy')(layout(66));
      r().measure('dots')(layout(66));
      r().onNeed(146);
      r().onBody(layout(150));
    });
    expect(r().fits('dots')).toBe(false);

    // Unfolded: nothing is decided from the small window's numbers.
    mockWindow = { width: 600, height: 900, fontScale: 2, scale: 3 };
    await rerender({ wanting: ['privacy', 'dots'] });
    expect(r().fits('dots')).toBe(true);
    await act(async () => {
      r().measure('privacy')(layout(44));
      r().measure('dots')(layout(44));
      r().onNeed(120);
      r().onBody(layout(420));
    });
    expect(r().fits('privacy')).toBe(true);
    expect(r().fits('dots')).toBe(true);
  });

  // React Native may clear a layout event once its handler returns.
  test('reads a layout event at once', async () => {
    const { r } = await setup(['privacy']);
    await act(async () => {
      // A pending update first, so React computes the next ones later.
      r().onNeed(10);
      for (const [handler, height] of [
        [r().onBody, 200],
        [r().measure('privacy'), 66],
      ] as const) {
        const e = layout(height) as { nativeEvent: unknown };
        handler(e as LayoutChangeEvent);
        e.nativeEvent = null;
      }
    });
    expect(r().fits('privacy')).toBe(true);
  });
});

