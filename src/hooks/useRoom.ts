import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { pickFitting } from '../utils/room';

const NONE: ReadonlySet<string> = new Set();

// Home's optional lines give way when the Entry field would lose what it
// needs (utils/room). `wanting`: the ids that would show, in keep order;
// `inSlot`: those drawn above the body (their height comes out of it).
// A line that gave way stays away for this window size and font scale.
export function useRoom(wanting: readonly string[], inSlot: readonly string[]) {
  const { width, height, fontScale } = useWindowDimensions();
  const key = `${width}x${height}@${fontScale}`;
  // The body's height, with the slot lines that were drawn above it then: a
  // line that has just gone leaves the body short until it lays out again.
  const [body, setBody] = useState<{ height: number; slot: readonly string[] }>();
  const [need, setNeed] = useState<number>();
  const [heights, setHeights] = useState<Readonly<Record<string, number>>>({});
  const [dropped, setDropped] = useState({ key, ids: NONE });
  const ids = dropped.key === key ? dropped.ids : NONE;

  const measure = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
    },
    []
  );
  const shown = wanting.filter((id) => !ids.has(id));
  const slotRef = useRef<readonly string[]>([]);
  const shownSlot = shown.filter((id) => inSlot.includes(id));
  useLayoutEffect(() => {
    slotRef.current = shownSlot;
  });
  const onBody = useCallback(
    (e: LayoutChangeEvent) => setBody({ height: e.nativeEvent.layout.height, slot: slotRef.current }),
    []
  );

  // Decided only once everything showing has been measured, so a line that has
  // just appeared never makes another give way.
  const measured =
    shown.every((id) => heights[id] !== undefined) &&
    (body?.slot ?? []).every((id) => heights[id] !== undefined);
  const base =
    body === undefined ? undefined : body.slot.reduce((sum, id) => sum + (heights[id] ?? 0), body.height);
  const next =
    base !== undefined && need !== undefined && measured
      ? pickFitting(base - need, wanting.map((id) => ({ id, height: heights[id] })), ids)
      : ids;
  useLayoutEffect(() => {
    if (next !== ids) setDropped({ key, ids: next });
  }, [next, ids, key]);

  return { fits: (id: string) => !next.has(id), measure, onBody, onNeed: setNeed };
}
