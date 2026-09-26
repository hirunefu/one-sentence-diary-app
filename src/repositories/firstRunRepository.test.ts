import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadFirstRun, saveFirstRun, type FirstRun } from './firstRunRepository';

describe('firstRunRepository', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('has no state before one is saved', async () => {
    expect(await loadFirstRun()).toBeNull();
  });

  test.each<FirstRun>([
    { kind: 'returning' },
    { kind: 'new' },
    { kind: 'started', day: '2026-09-26', offer: 'open' },
    { kind: 'started', day: '2026-09-26', offer: 'closed' },
  ])('round-trips %p', async (state) => {
    await saveFirstRun(state);
    expect(await loadFirstRun()).toEqual(state);
  });

  test.each([
    'garbage',
    '',
    '{"v":2,"kind":"new"}',
    '{"v":1,"kind":"later"}',
    '{"v":1,"kind":"started","day":"2026-9-26","offer":"open"}',
    '{"v":1,"kind":"started","day":"2026-09-26","offer":"maybe"}',
    '{"v":1,"kind":"started","offer":"open"}',
  ])('loads %p as none', async (raw) => {
    await AsyncStorage.setItem('firstRun.state', raw);
    expect(await loadFirstRun()).toBeNull();
  });
});
