import {
  buildReminderMessage,
  decideExportReminder,
  maybeRemindExport,
  type ExportPromptResult,
  type ExportReminderState,
} from './exportReminder';

describe('decideExportReminder', () => {
  const TODAY = '2026-07-12';

  const state = (
    lastExportedAt: string | null,
    lastRemindedAt: string | null
  ): ExportReminderState => ({ lastExportedAt, lastRemindedAt });

  test('returns start-tracking when no baseline exists', () => {
    expect(decideExportReminder(state(null, null), TODAY, 7)).toBe(
      'start-tracking'
    );
  });

  test('reminds when interval days have elapsed since baseline', () => {
    expect(decideExportReminder(state('2026-07-05', null), TODAY, 7)).toBe(
      'remind'
    );
  });

  test('stays silent while within the interval', () => {
    expect(decideExportReminder(state('2026-07-06', null), TODAY, 7)).toBe(
      'none'
    );
  });

  test('interval 1 reminds at most once per calendar day', () => {
    expect(decideExportReminder(state(null, TODAY), TODAY, 1)).toBe('none');
    expect(decideExportReminder(state(null, '2026-07-11'), TODAY, 1)).toBe(
      'remind'
    );
  });

  test('uses the newer of lastExportedAt and lastRemindedAt as baseline', () => {
    expect(
      decideExportReminder(state('2026-07-02', '2026-07-09'), TODAY, 7)
    ).toBe('none');
    expect(
      decideExportReminder(state('2026-07-09', '2026-07-02'), TODAY, 7)
    ).toBe('none');
    expect(
      decideExportReminder(state('2026-07-01', '2026-07-05'), TODAY, 7)
    ).toBe('remind');
  });

  test('handles month boundaries by day count (30 days = 1 month)', () => {
    expect(decideExportReminder(state('2026-06-12', null), TODAY, 30)).toBe(
      'remind'
    );
    expect(decideExportReminder(state('2026-06-13', null), TODAY, 30)).toBe(
      'none'
    );
  });
});

describe('buildReminderMessage', () => {
  test('mentions elapsed days since the last export', () => {
    expect(buildReminderMessage('2026-07-05', '2026-07-12')).toBe(
      '前回のエクスポートから7日が経過しています。日記をバックアップしませんか？'
    );
  });

  test('uses a dedicated message when never exported', () => {
    expect(buildReminderMessage(null, '2026-07-12')).toBe(
      'まだ一度もエクスポートされていません。日記をバックアップしませんか？'
    );
  });
});

describe('maybeRemindExport', () => {
  const TODAY = '2026-07-12';

  function makeDeps(overrides?: {
    state?: ExportReminderState;
    promptResult?: ExportPromptResult;
  }) {
    const calls = {
      loadState: 0,
      markReminded: [] as string[],
      markExported: [] as string[],
      promptMessages: [] as string[],
    };
    const deps = {
      loadState: async () => {
        calls.loadState += 1;
        return (
          overrides?.state ?? { lastExportedAt: null, lastRemindedAt: null }
        );
      },
      markReminded: async (date: string) => {
        calls.markReminded.push(date);
      },
      markExported: async (date: string) => {
        calls.markExported.push(date);
      },
      promptExport: async (message: string): Promise<ExportPromptResult> => {
        calls.promptMessages.push(message);
        return overrides?.promptResult ?? 'later';
      },
    };
    return { deps, calls };
  }

  test('does nothing when the feature is disabled', async () => {
    const { deps, calls } = makeDeps();
    await maybeRemindExport(deps, {
      savedDate: TODAY,
      todayStr: TODAY,
      enabled: false,
      intervalDays: 7,
    });
    expect(calls.loadState).toBe(0);
    expect(calls.promptMessages).toEqual([]);
  });

  test('does nothing when the saved entry is not for today', async () => {
    const { deps, calls } = makeDeps();
    await maybeRemindExport(deps, {
      savedDate: '2026-07-10',
      todayStr: TODAY,
      enabled: true,
      intervalDays: 7,
    });
    expect(calls.loadState).toBe(0);
    expect(calls.promptMessages).toEqual([]);
  });

  test('silently starts tracking on the first check', async () => {
    const { deps, calls } = makeDeps();
    await maybeRemindExport(deps, {
      savedDate: TODAY,
      todayStr: TODAY,
      enabled: true,
      intervalDays: 7,
    });
    expect(calls.markReminded).toEqual([TODAY]);
    expect(calls.promptMessages).toEqual([]);
    expect(calls.markExported).toEqual([]);
  });

  test('stays silent within the interval', async () => {
    const { deps, calls } = makeDeps({
      state: { lastExportedAt: '2026-07-10', lastRemindedAt: null },
    });
    await maybeRemindExport(deps, {
      savedDate: TODAY,
      todayStr: TODAY,
      enabled: true,
      intervalDays: 7,
    });
    expect(calls.markReminded).toEqual([]);
    expect(calls.promptMessages).toEqual([]);
  });

  test('prompts and records the reminder when the interval has elapsed', async () => {
    const { deps, calls } = makeDeps({
      state: { lastExportedAt: '2026-07-01', lastRemindedAt: null },
      promptResult: 'later',
    });
    await maybeRemindExport(deps, {
      savedDate: TODAY,
      todayStr: TODAY,
      enabled: true,
      intervalDays: 7,
    });
    expect(calls.markReminded).toEqual([TODAY]);
    expect(calls.promptMessages).toEqual([
      '前回のエクスポートから11日が経過しています。日記をバックアップしませんか？',
    ]);
    expect(calls.markExported).toEqual([]);
  });

  test('records the export date when the user exports from the prompt', async () => {
    const { deps, calls } = makeDeps({
      state: { lastExportedAt: null, lastRemindedAt: '2026-07-01' },
      promptResult: 'exported',
    });
    await maybeRemindExport(deps, {
      savedDate: TODAY,
      todayStr: TODAY,
      enabled: true,
      intervalDays: 7,
    });
    expect(calls.markReminded).toEqual([TODAY]);
    expect(calls.promptMessages).toEqual([
      'まだ一度もエクスポートされていません。日記をバックアップしませんか？',
    ]);
    expect(calls.markExported).toEqual([TODAY]);
  });
});
