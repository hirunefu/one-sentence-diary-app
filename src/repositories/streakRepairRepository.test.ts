import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadDeclinedRepairDay, saveDeclinedRepairDay } from './streakRepairRepository';

describe('streakRepairRepository', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('has no declined day before one is saved', async () => {
    expect(await loadDeclinedRepairDay()).toBeNull();
  });

  test('round-trips a day', async () => {
    await saveDeclinedRepairDay('2026-05-14');
    expect(await loadDeclinedRepairDay()).toBe('2026-05-14');
  });

  test.each(['garbage', '2026-5-14', ''])('loads %p as none', async (raw) => {
    await AsyncStorage.setItem('streakRepair.declinedDay', raw);
    expect(await loadDeclinedRepairDay()).toBeNull();
  });
});
