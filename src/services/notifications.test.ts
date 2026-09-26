jest.mock('expo-notifications', () => ({
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('scheduled-id'),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', canAskAgain: true }),
  getPresentedNotificationsAsync: jest.fn().mockResolvedValue([]),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  deleteNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
  AndroidImportance: { UNKNOWN: 0, UNSPECIFIED: 1, NONE: 2, MIN: 3, LOW: 4, DEFAULT: 5, HIGH: 6, MAX: 7 },
}));

import * as Notifications from 'expo-notifications';
import {
  rescheduleReminders,
  cancelAllReminders,
  requestNotificationPermission,
  notificationPermission,
  REMINDER_NOTIFICATION_ID_PREFIX,
  LEGACY_REMINDER_ID,
  FALLBACK_CHANNEL_ID,
} from './notifications';
import { REMINDER_TITLE, STREAK_IN_REMINDER_MIN } from './reminderCopy';
import { promptFor } from './promptCopy';
import { addDays } from '../utils/date';
import { currentStretch, streakBreakOf, stretchesOf } from '../utils/streak';

const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockGetAll = Notifications.getAllScheduledNotificationsAsync as jest.Mock;
const mockRequestPerm = Notifications.requestPermissionsAsync as jest.Mock;
const mockPresented = Notifications.getPresentedNotificationsAsync as jest.Mock;
const mockDismiss = Notifications.dismissNotificationAsync as jest.Mock;
const mockGetChannel = Notifications.getNotificationChannelAsync as jest.Mock;
const mockSetChannel = Notifications.setNotificationChannelAsync as jest.Mock;
const mockDeleteChannel = Notifications.deleteNotificationChannelAsync as jest.Mock;
const { AndroidImportance } = Notifications;

type Scheduled = {
  identifier: string;
  content: { title: string; body: string };
  trigger: { channelId?: string };
};
const scheduled = (): Scheduled[] => mockSchedule.mock.calls.map((c) => c[0] as Scheduled);
const dateOf = (identifier: string) => identifier.slice(REMINDER_NOTIFICATION_ID_PREFIX.length);
// The days `end`, `end - 1`, ... : a Streak of `length` days ending on `end`.
const streakEnding = (end: string, length: number) =>
  new Set(Array.from({ length }, (_, i) => addDays(end, -i)));
const shown = (date: string, body: string) => ({
  request: { identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}${date}`, content: { title: REMINDER_TITLE, body } },
});
const deferred = () => {
  let release!: () => void;
  const promise = new Promise<unknown[]>((resolve) => (release = () => resolve([])));
  return { promise, release };
};

describe('notifications service', () => {
  beforeEach(() => {
    mockCancel.mockClear();
    mockSchedule.mockClear();
    mockGetAll.mockClear();
    mockGetAll.mockResolvedValue([]);
    mockRequestPerm.mockClear();
    mockPresented.mockReset().mockResolvedValue([]);
    mockDismiss.mockClear();
    mockGetChannel.mockReset().mockResolvedValue(null);
    mockSetChannel.mockClear();
    mockDeleteChannel.mockClear();
    jest.useFakeTimers();
    // 2026-04-28 09:00 ローカル
    jest.setSystemTime(new Date(2026, 3, 28, 9, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('rescheduleReminders schedules upcoming days, skipping recorded dates', async () => {
    const recordedDates = new Set(['2026-04-28', '2026-04-30']);
    await rescheduleReminders({
      hour: 21,
      minute: 0,
      recordedDates,
      daysAhead: 5,
    });
    // 04-28 (today, recorded) → skip
    // 04-29 → schedule
    // 04-30 (recorded) → skip
    // 05-01 → schedule
    // 05-02 → schedule
    expect(mockSchedule).toHaveBeenCalledTimes(3);
    const ids = mockSchedule.mock.calls.map((c) => c[0].identifier);
    expect(ids).toEqual([
      `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29`,
      `${REMINDER_NOTIFICATION_ID_PREFIX}2026-05-01`,
      `${REMINDER_NOTIFICATION_ID_PREFIX}2026-05-02`,
    ]);
  });

  test('rescheduleReminders skips today if reminder time has already passed', async () => {
    // Now = 09:00, reminder time = 08:00 → already passed today
    await rescheduleReminders({
      hour: 8,
      minute: 0,
      recordedDates: new Set(),
      daysAhead: 1,
    });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  test('rescheduleReminders schedules today if reminder time is in the future', async () => {
    // Now = 09:00, reminder time = 21:00 → still in future today
    await rescheduleReminders({
      hour: 21,
      minute: 0,
      recordedDates: new Set(),
      daysAhead: 1,
    });
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0]?.[0].identifier).toBe(
      `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-28`
    );
  });

  test('rescheduleReminders cancels existing reminders before scheduling', async () => {
    mockGetAll.mockResolvedValueOnce([
      { identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29` },
      { identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-30` },
    ]);
    await rescheduleReminders({
      hour: 21,
      minute: 0,
      recordedDates: new Set(),
      daysAhead: 0,
    });
    // legacy + 2 per-day
    expect(mockCancel).toHaveBeenCalledWith(LEGACY_REMINDER_ID);
    expect(mockCancel).toHaveBeenCalledWith(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29`);
    expect(mockCancel).toHaveBeenCalledWith(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-30`);
  });

  test('cancelAllReminders cancels legacy ID and per-day reminders, ignores others', async () => {
    mockGetAll.mockResolvedValueOnce([
      { identifier: `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29` },
      { identifier: 'other-notification' },
    ]);
    await cancelAllReminders();
    expect(mockCancel).toHaveBeenCalledWith(LEGACY_REMINDER_ID);
    expect(mockCancel).toHaveBeenCalledWith(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29`);
    expect(mockCancel).not.toHaveBeenCalledWith('other-notification');
  });

  describe('what a Reminder says', () => {
    test('every Reminder is titled 「今日の一文」 and asks the Prompt of its own date', async () => {
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 5 });
      expect(scheduled()).toHaveLength(5);
      for (const { identifier, content } of scheduled()) {
        expect(content.title).toBe(REMINDER_TITLE);
        expect(content.body).toBe(promptFor(dateOf(identifier)));
      }
    });

    test('the nearest Reminder shows the Streak Home will show on its day', async () => {
      await rescheduleReminders({
        hour: 21,
        minute: 0,
        recordedDates: streakEnding('2026-04-27', STREAK_IN_REMINDER_MIN),
      });
      const [first] = scheduled();
      expect(first?.identifier).toBe(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-28`);
      expect(first?.content.body).toBe(`${STREAK_IN_REMINDER_MIN}日連続。${promptFor('2026-04-28')}`);
    });

    test('later Reminders never show a number: it could change before they fire', async () => {
      await rescheduleReminders({
        hour: 21,
        minute: 0,
        recordedDates: streakEnding('2026-04-27', 14),
        daysAhead: 14,
      });
      const [first, ...later] = scheduled();
      expect(first?.content.body).toMatch(/^14日連続。/);
      expect(later).toHaveLength(13);
      for (const { identifier, content } of later) {
        expect(content.body).toBe(promptFor(dateOf(identifier)));
      }
    });

    // Entries dated after today can exist from old versions.
    test('only the nearest Reminder shows a number, even after future Entries', async () => {
      await rescheduleReminders({
        hour: 21,
        minute: 0,
        recordedDates: new Set(['2026-04-29', '2026-04-30', '2026-05-01']),
        daysAhead: 6,
      });
      const bodies = Object.fromEntries(scheduled().map((n) => [dateOf(n.identifier), n.content.body]));
      expect(bodies['2026-04-28']).toBe(promptFor('2026-04-28'));
      expect(bodies['2026-05-02']).toBe(promptFor('2026-05-02'));
    });

    test('below the minimum, the nearest Reminder shows only the Prompt', async () => {
      await rescheduleReminders({
        hour: 21,
        minute: 0,
        recordedDates: streakEnding('2026-04-27', STREAK_IN_REMINDER_MIN - 1),
      });
      expect(scheduled()[0]?.content.body).toBe(promptFor('2026-04-28'));
    });

    test("with today written, the nearest Reminder is tomorrow's and counts today", async () => {
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: streakEnding('2026-04-28', 4) });
      const [first] = scheduled();
      expect(first?.identifier).toBe(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29`);
      expect(first?.content.body).toBe(`4日連続。${promptFor('2026-04-29')}`);
    });

    // Tomorrow Home offers to write today instead of showing 10: no number.
    test("with today unwritten and its time passed, tomorrow's Reminder shows no number", async () => {
      await rescheduleReminders({ hour: 8, minute: 0, recordedDates: streakEnding('2026-04-27', 10) });
      const [first] = scheduled();
      expect(first?.identifier).toBe(`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-29`);
      expect(first?.content.body).toBe(promptFor('2026-04-29'));
    });

    test('the number is always the one Home shows, for every pattern of the last ten days', async () => {
      const today = '2026-04-28';
      for (let mask = 0; mask < 1024; mask++) {
        const recorded = new Set<string>();
        for (let i = 0; i < 10; i++) if (mask & (1 << i)) recorded.add(addDays(today, -i));
        for (const hour of [21, 8]) {
          mockSchedule.mockClear();
          await rescheduleReminders({ hour, minute: 0, recordedDates: recorded, daysAhead: 2 });
          const day = !recorded.has(today) && hour === 21 ? today : addDays(today, 1);
          // What Home shows on that day, the way EntriesContext works it out.
          const desc = [...recorded].sort().reverse();
          const stretches = stretchesOf(desc, day);
          const headline = streakBreakOf(stretches, day, null).headline;
          const length = currentStretch(stretches, day)?.length ?? 0;
          const expected =
            headline === 'count' && length >= STREAK_IN_REMINDER_MIN
              ? `${length}日連続。${promptFor(day)}`
              : promptFor(day);
          const [first] = scheduled();
          expect(first?.identifier).toBe(`${REMINDER_NOTIFICATION_ID_PREFIX}${day}`);
          expect(first?.content.body).toBe(expected);
        }
      }
    });
  });

  describe('the notification channel', () => {
    test('every Reminder goes to the 「リマインダー」 channel, created before anything is scheduled', async () => {
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 3 });
      expect(mockSetChannel).toHaveBeenCalledWith('reminder', {
        name: 'リマインダー',
        description: '記録のない日に、設定した時刻に届きます',
        importance: AndroidImportance.DEFAULT,
        // As Expo's own channel did, so a phone on vibrate still feels it.
        enableVibrate: true,
      });
      for (const { trigger } of scheduled()) expect(trigger.channelId).toBe('reminder');
      expect(mockSetChannel.mock.invocationCallOrder[0]).toBeLessThan(
        mockSchedule.mock.invocationCallOrder[0] as number
      );
    });

    // The user owns a channel's settings once it exists, so a Reminder that was
    // turned down on the old channel stays down.
    test('a lowered importance on the old channel carries over, and the old channel goes', async () => {
      for (const [old, expected] of [
        [AndroidImportance.NONE, AndroidImportance.NONE],
        [AndroidImportance.LOW, AndroidImportance.LOW],
        [AndroidImportance.HIGH, AndroidImportance.DEFAULT],
      ] as const) {
        mockGetChannel.mockResolvedValueOnce({ importance: old });
        mockSetChannel.mockClear();
        mockDeleteChannel.mockClear();
        await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 1 });
        expect(mockGetChannel).toHaveBeenCalledWith(FALLBACK_CHANNEL_ID);
        expect(mockSetChannel.mock.calls[0]?.[1].importance).toBe(expected);
        expect(mockDeleteChannel).toHaveBeenCalledWith(FALLBACK_CHANNEL_ID);
      }
      mockDeleteChannel.mockClear();
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 1 });
      expect(mockDeleteChannel).not.toHaveBeenCalled();
    });

    test('a sound or vibration turned off on the old channel stays off', async () => {
      mockGetChannel.mockResolvedValueOnce({
        importance: AndroidImportance.HIGH,
        sound: null,
        enableVibrate: false,
      });
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 1 });
      expect(mockSetChannel.mock.calls[0]?.[1]).toMatchObject({ sound: null, enableVibrate: false });

      mockSetChannel.mockClear();
      mockGetChannel.mockResolvedValueOnce({
        importance: AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: true,
      });
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 1 });
      expect(mockSetChannel.mock.calls[0]?.[1]).not.toHaveProperty('sound');
      expect(mockSetChannel.mock.calls[0]?.[1].enableVibrate).toBe(true);
    });
  });

  describe('Reminders already in the shade', () => {
    const dismissed = () => mockDismiss.mock.calls.map((c) => c[0]);

    test("those from earlier days go, and today's goes once today is written", async () => {
      const presented = [
        shown('2026-04-27', promptFor('2026-04-27')),
        shown('2026-04-28', promptFor('2026-04-28')),
        { request: { identifier: 'other', content: { title: 'x', body: 'y' } } },
      ];
      mockPresented.mockResolvedValue(presented);
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 1 });
      expect(dismissed()).toEqual([`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-27`]);

      mockDismiss.mockClear();
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(['2026-04-28']), daysAhead: 1 });
      expect(dismissed().sort()).toEqual([
        `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-27`,
        `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-28`,
      ]);
    });

    test("today's goes when its number is no longer the one Home shows", async () => {
      const numbered = shown('2026-04-28', `12日連続。${promptFor('2026-04-28')}`);
      const plain = shown('2026-04-28', promptFor('2026-04-28'));

      mockPresented.mockResolvedValue([numbered]);
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: streakEnding('2026-04-27', 3), daysAhead: 1 });
      expect(dismissed()).toEqual([`${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-28`]);

      for (const [presented, recorded] of [
        [numbered, streakEnding('2026-04-27', 12)],
        [plain, streakEnding('2026-04-27', 3)],
      ] as const) {
        mockDismiss.mockClear();
        mockPresented.mockResolvedValue([presented]);
        await rescheduleReminders({ hour: 21, minute: 0, recordedDates: recorded, daysAhead: 1 });
        expect(dismissed()).toEqual([]);
      }
    });
  });

  describe('turning Reminders off', () => {
    test('also takes the Reminders already in the shade away', async () => {
      mockPresented.mockResolvedValue([
        shown('2026-04-27', `12日連続。${promptFor('2026-04-27')}`),
        shown('2026-04-28', promptFor('2026-04-28')),
        { request: { identifier: 'other', content: { title: 'x', body: 'y' } } },
      ]);
      await cancelAllReminders();
      expect(mockDismiss.mock.calls.map((c) => c[0]).sort()).toEqual([
        `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-27`,
        `${REMINDER_NOTIFICATION_ID_PREFIX}2026-04-28`,
      ]);
    });
  });

  describe('one pass at a time', () => {
    test('a pass that fails does not stop the ones after it', async () => {
      mockSetChannel.mockRejectedValueOnce(new Error('channel'));
      await expect(
        rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 1 })
      ).rejects.toThrow('channel');
      await rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 1 });
      expect(mockSchedule).toHaveBeenCalledTimes(1);
      await expect(cancelAllReminders()).resolves.toBeUndefined();
    });

    test('a pass that starts later always writes last', async () => {
      const first = deferred();
      mockGetAll.mockReturnValueOnce(first.promise);
      const pass1 = rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 1 });
      const pass2 = rescheduleReminders({
        hour: 21,
        minute: 0,
        recordedDates: streakEnding('2026-04-27', 3),
        daysAhead: 1,
      });
      // Give pass 2 every chance to finish while pass 1 is held.
      for (let i = 0; i < 50; i++) await Promise.resolve();
      first.release();
      await Promise.all([pass1, pass2]);
      expect(scheduled().at(-1)?.content.body).toBe(`3日連続。${promptFor('2026-04-28')}`);
    });

    test('turning Reminders off waits for a pass in flight', async () => {
      const first = deferred();
      mockGetAll.mockReturnValueOnce(first.promise);
      const pass = rescheduleReminders({ hour: 21, minute: 0, recordedDates: new Set(), daysAhead: 3 });
      const off = cancelAllReminders();
      for (let i = 0; i < 50; i++) await Promise.resolve();
      first.release();
      await Promise.all([pass, off]);
      const lastSchedule = Math.max(...mockSchedule.mock.invocationCallOrder);
      expect(mockGetAll.mock.invocationCallOrder.at(-1)).toBeGreaterThan(lastSchedule);
    });
  });

  describe('notificationPermission', () => {
    const mockGetPerm = Notifications.getPermissionsAsync as jest.Mock;
    test.each([
      [{ status: 'granted', canAskAgain: true }, 'granted'],
      [{ status: 'undetermined', canAskAgain: true }, 'askable'],
      [{ status: 'denied', canAskAgain: true }, 'askable'],
      [{ status: 'denied', canAskAgain: false }, 'blocked'],
    ])('%p is %p', async (perm, expected) => {
      mockGetPerm.mockResolvedValueOnce(perm);
      expect(await notificationPermission()).toBe(expected);
    });
  });

  test('requestNotificationPermission returns true if granted', async () => {
    mockRequestPerm.mockResolvedValueOnce({ status: 'granted' });
    expect(await requestNotificationPermission()).toBe(true);
  });

  test('requestNotificationPermission returns false if denied', async () => {
    mockRequestPerm.mockResolvedValueOnce({ status: 'denied' });
    expect(await requestNotificationPermission()).toBe(false);
  });
});

describe('notifications under E2E flag', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('requestNotificationPermission() returns true without prompt', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const requestMock = jest.fn();
    jest.doMock('expo-notifications', () => ({
      requestPermissionsAsync: requestMock,
      getAllScheduledNotificationsAsync: jest.fn(),
      cancelScheduledNotificationAsync: jest.fn(),
      scheduleNotificationAsync: jest.fn(),
      SchedulableTriggerInputTypes: { DATE: 'date' },
    }));
    const { requestNotificationPermission } = require('./notifications');
    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(requestMock).not.toHaveBeenCalled();
  });

  test('notificationPermission() is askable without asking Android', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const getPerm = jest.fn();
    jest.doMock('expo-notifications', () => ({ getPermissionsAsync: getPerm }));
    const { notificationPermission } = require('./notifications');
    await expect(notificationPermission()).resolves.toBe('askable');
    expect(getPerm).not.toHaveBeenCalled();
  });

  test('rescheduleReminders() is a no-op', async () => {
    process.env.EXPO_PUBLIC_E2E = '1';
    const mocks = {
      getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
      cancelScheduledNotificationAsync: jest.fn(),
      scheduleNotificationAsync: jest.fn(),
      getPresentedNotificationsAsync: jest.fn().mockResolvedValue([]),
      dismissNotificationAsync: jest.fn(),
      getNotificationChannelAsync: jest.fn().mockResolvedValue(null),
      setNotificationChannelAsync: jest.fn(),
      deleteNotificationChannelAsync: jest.fn(),
    };
    jest.doMock('expo-notifications', () => ({
      ...mocks,
      requestPermissionsAsync: jest.fn(),
      SchedulableTriggerInputTypes: { DATE: 'date' },
      AndroidImportance: { NONE: 2, DEFAULT: 5 },
    }));
    const { rescheduleReminders } = require('./notifications');
    await rescheduleReminders({
      hour: 21,
      minute: 0,
      recordedDates: new Set(),
    });
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
});
