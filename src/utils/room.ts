// Which of Home's optional lines fit without taking what the Entry field needs
// (the whole Prompt while it is empty, one line once written). On a small
// phone at a large font size they do not all fit (ADR 0002, E2).
export type Fitting = { id: string; height: number | undefined };

// Walks `items` in keep order: a line stays while its height fits the room
// left, and is dropped otherwise. A line not measured yet counts as fitting.
// Dropped lines stay dropped, so nothing comes and goes as heights change.
export function pickFitting(
  room: number,
  items: readonly Fitting[],
  dropped: ReadonlySet<string>
): ReadonlySet<string> {
  let left = room;
  const next = new Set(dropped);
  for (const { id, height } of items) {
    if (next.has(id) || height === undefined) continue;
    if (height <= left) left -= height;
    else next.add(id);
  }
  return next.size === dropped.size ? dropped : next;
}
