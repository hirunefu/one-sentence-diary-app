import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { pickFitting } from '../utils/room';

const NONE: ReadonlySet<string> = new Set();

type Measured = {
  // The window they were taken in: another window's numbers never decide.
  window: string;
  // The body's height, with the slot lines that were drawn above it then: a
  // line that has just gone leaves the body short until it lays out again.
  body?: { height: number; slot: readonly string[] };
  need?: number;
  heights: Readonly<Record<string, number>>;
};

// Home's optional lines give way when the Entry field would lose what it
// needs (utils/room). `wanting`: the ids that would show, in keep order;
// `inSlot`: those drawn above the body (their height comes out of it).
// A line that gave way stays away while the window, the lines that want to
// show and what the field needs stay the same, so heights that change as
// lines come and go never make them flicker; any of those changing decides
// again.
export function useRoom(wanting: readonly string[], inSlot: readonly string[]) {
  const { width, height, fontScale } = useWindowDimensions();
  const window = `${width}x${height}@${fontScale}`;
  const windowRef = useRef(window);
  const [measured, setMeasured] = useState<Measured>({ window, heights: {} });
  const m: Measured = measured.window === window ? measured : { window, heights: {} };

  // Every update starts from the current window's measurements.
  const update = useCallback((change: (m: Measured) => Measured) => {
    setMeasured((prev) =>
      change(prev.window === windowRef.current ? prev : { window: windowRef.current, heights: {} })
    );
  }, []);
  const measure = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      update((prev) => (prev.heights[id] === h ? prev : { ...prev, heights: { ...prev.heights, [id]: h } }));
    },
    [update]
  );
  const onNeed = useCallback((need: number) => update((prev) => ({ ...prev, need })), [update]);

  const decision = `${window}|${wanting.join(',')}|${m.need}`;
  const [dropped, setDropped] = useState({ decision, ids: NONE });
  const ids = dropped.decision === decision ? dropped.ids : NONE;

  const shown = wanting.filter((id) => !ids.has(id));
  const shownSlot = shown.filter((id) => inSlot.includes(id));
  const slotRef = useRef<readonly string[]>([]);
  useLayoutEffect(() => {
    windowRef.current = window;
    slotRef.current = shownSlot;
  });
  const onBody = useCallback(
    (e: LayoutChangeEvent) =>
      update((prev) => ({ ...prev, body: { height: e.nativeEvent.layout.height, slot: slotRef.current } })),
    [update]
  );

  // Decided only once everything showing has been measured in this window, so
  // a line that has just appeared never makes another give way.
  const { body, need, heights } = m;
  const ready =
    body !== undefined &&
    need !== undefined &&
    shown.every((id) => heights[id] !== undefined) &&
    body.slot.every((id) => heights[id] !== undefined);
  const next = ready
    ? pickFitting(
        body.slot.reduce((sum, id) => sum + (heights[id] ?? 0), body.height) - need,
        wanting.map((id) => ({ id, height: heights[id] })),
        ids
      )
    : ids;
  useLayoutEffect(() => {
    if (next !== ids) setDropped({ decision, ids: next });
  }, [next, ids, decision]);

  return { fits: (id: string) => !next.has(id), measure, onBody, onNeed };
}
