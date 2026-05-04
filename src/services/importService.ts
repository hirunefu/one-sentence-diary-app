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
