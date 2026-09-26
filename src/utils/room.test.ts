import { pickFitting } from './room';

const none = new Set<string>();

describe('pickFitting', () => {
  test('keeps every line when there is room', () => {
    const items = [
      { id: 'privacy', height: 30 },
      { id: 'dots', height: 30 },
    ];
    expect(pickFitting(60, items, none)).toEqual(none);
  });

  test('drops lines in keep order until the field has what it needs', () => {
    const items = [
      { id: 'privacy', height: 66 },
      { id: 'dots', height: 66 },
    ];
    expect([...pickFitting(69, items, none)]).toEqual(['dots']);
    expect([...pickFitting(10, items, none)].sort()).toEqual(['dots', 'privacy']);
  });

  test('keeps a later, smaller line when an earlier one does not fit', () => {
    const items = [
      { id: 'offer', height: 134 },
      { id: 'first-day', height: 30 },
    ];
    expect([...pickFitting(100, items, none)]).toEqual(['offer']);
  });

  test('never brings back a line it dropped', () => {
    const items = [{ id: 'dots', height: 30 }];
    expect([...pickFitting(500, items, new Set(['dots']))]).toEqual(['dots']);
  });

  test('a line not measured yet counts as fitting', () => {
    const items = [
      { id: 'privacy', height: undefined },
      { id: 'dots', height: 66 },
    ];
    expect(pickFitting(66, items, none)).toEqual(none);
  });
});
