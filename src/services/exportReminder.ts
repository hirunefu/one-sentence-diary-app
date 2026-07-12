import { fromDateString } from '../utils/date';

export type ExportReminderState = {
  lastExportedAt: string | null;
  lastRemindedAt: string | null;
};

export type ExportReminderDecision = 'remind' | 'start-tracking' | 'none';

// 日付境界を跨いだ回数だけが知りたいので、DST による ±1h のずれは
// Math.round で吸収する
function daysBetween(from: string, to: string): number {
  const ms = fromDateString(to).getTime() - fromDateString(from).getTime();
  return Math.round(ms / 86_400_000);
}

function baselineOf(state: ExportReminderState): string | null {
  const { lastExportedAt, lastRemindedAt } = state;
  if (lastExportedAt === null) return lastRemindedAt;
  if (lastRemindedAt === null) return lastExportedAt;
  // YYYY-MM-DD は辞書順 = 時系列順
  return lastExportedAt > lastRemindedAt ? lastExportedAt : lastRemindedAt;
}

export function decideExportReminder(
  state: ExportReminderState,
  todayStr: string,
  intervalDays: number
): ExportReminderDecision {
  const baseline = baselineOf(state);
  if (baseline === null) return 'start-tracking';
  return daysBetween(baseline, todayStr) >= intervalDays ? 'remind' : 'none';
}

export function buildReminderMessage(
  lastExportedAt: string | null,
  todayStr: string
): string {
  if (lastExportedAt === null) {
    return 'まだ一度もエクスポートされていません。日記をバックアップしませんか？';
  }
  const days = daysBetween(lastExportedAt, todayStr);
  return `前回のエクスポートから${days}日が経過しています。日記をバックアップしませんか？`;
}

export type ExportPromptResult = 'exported' | 'later';

export type ExportReminderDeps = {
  loadState: () => Promise<ExportReminderState>;
  markReminded: (date: string) => Promise<void>;
  markExported: (date: string) => Promise<void>;
  promptExport: (message: string) => Promise<ExportPromptResult>;
};

export async function maybeRemindExport(
  deps: ExportReminderDeps,
  params: {
    savedDate: string;
    todayStr: string;
    enabled: boolean;
    intervalDays: number;
  }
): Promise<void> {
  const { savedDate, todayStr, enabled, intervalDays } = params;
  if (!enabled || savedDate !== todayStr) return;

  const state = await deps.loadState();
  const decision = decideExportReminder(state, todayStr, intervalDays);
  if (decision === 'none') return;

  // 初回 (start-tracking) は基準点を置くだけで黙る（使い始めた直後に
  // バックアップを迫らない）。'remind' でも prompt の前に記録する:
  // Alert 表示自体が「リマインドした」事実であり、以後はユーザーの選択に
  // 関わらず次の間隔まで沈黙するため
  await deps.markReminded(todayStr);
  if (decision === 'start-tracking') return;

  const result = await deps.promptExport(
    buildReminderMessage(state.lastExportedAt, todayStr)
  );
  if (result === 'exported') {
    await deps.markExported(todayStr);
  }
}
