import type { DiaryDatabase } from '../db/database';
import {
  bulkUpsertEntries,
  type BulkImportResult,
  type ImportStrategy,
} from '../repositories/entriesRepository';
import type { Entry } from '../types';
import { MAX_TEXT_LENGTH } from '../types';
import { countChars } from '../utils/text';

export type ImportFileV1 = {
  version: 1;
  exportedAt?: string;
  appVersion?: string;
  entries: unknown[];
};

export type ImportParseErrorCode =
  | 'invalid-json'
  | 'invalid-structure'
  | 'unsupported-version';

export class ImportParseError extends Error {
  readonly code: ImportParseErrorCode;
  constructor(message: string, code: ImportParseErrorCode) {
    super(message);
    this.name = 'ImportParseError';
    this.code = code;
  }
}

export function parseImportJson(raw: string): ImportFileV1 {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ImportParseError('JSON のパースに失敗しました', 'invalid-json');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ImportParseError(
      'ファイル形式が一口日記のエクスポートと一致しません',
      'invalid-structure'
    );
  }
  const obj = data as Record<string, unknown>;
  if (obj.version !== 1) {
    throw new ImportParseError(
      '対応していないバージョンです',
      'unsupported-version'
    );
  }
  if (!Array.isArray(obj.entries)) {
    throw new ImportParseError(
      'ファイル形式が一口日記のエクスポートと一致しません',
      'invalid-structure'
    );
  }
  return { version: 1, entries: obj.entries };
}

export type ClassifiedEntries = {
  newEntries: Entry[];
  conflicts: Entry[];
  invalid: number;
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// 正規表現だけだと "2024-02-30" のような存在しない日付を通してしまうため、
// Date オブジェクトに通したあと元の y/m/d と一致するかを確認する。
// (Date は範囲外の値を自動的に正規化する: new Date(2024,1,30) => 3月1日)
function isValidDate(s: string): boolean {
  if (!DATE_REGEX.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

// インポート JSON の各エントリに対する受け入れ条件。
// EntryInput が保証する不変条件 (1〜MAX_TEXT_LENGTH 字、改行なし) と
// 一致させているため、ここを緩めると DB に異常データが混入する。
function isValidEntry(e: unknown): e is Entry {
  if (e === null || typeof e !== 'object') return false;
  const r = e as Record<string, unknown>;
  if (typeof r.date !== 'string' || !isValidDate(r.date)) return false;
  if (typeof r.text !== 'string') return false;
  const len = countChars(r.text);
  if (len < 1 || len > MAX_TEXT_LENGTH) return false;
  if (/[\r\n]/.test(r.text)) return false;
  if (typeof r.createdAt !== 'number') return false;
  if (typeof r.updatedAt !== 'number') return false;
  return true;
}

export function classifyEntries(
  rawEntries: unknown[],
  existingDates: ReadonlySet<string>
): ClassifiedEntries {
  const newEntries: Entry[] = [];
  const conflicts: Entry[] = [];
  let invalid = 0;
  for (const raw of rawEntries) {
    if (!isValidEntry(raw)) {
      invalid++;
      continue;
    }
    if (existingDates.has(raw.date)) {
      conflicts.push(raw);
    } else {
      newEntries.push(raw);
    }
  }
  return { newEntries, conflicts, invalid };
}

export type ApplyImportResult = BulkImportResult & { invalid: number };

export async function applyImport(
  db: DiaryDatabase,
  classified: ClassifiedEntries,
  strategy: ImportStrategy
): Promise<ApplyImportResult> {
  const result = await bulkUpsertEntries(
    db,
    classified.newEntries,
    classified.conflicts,
    strategy
  );
  return { ...result, invalid: classified.invalid };
}
