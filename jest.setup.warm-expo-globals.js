// jest-expo の lazy global polyfill を eager 化する。
//
// 背景:
// - jest-expo preset が `expo/src/winter/runtime.native.ts` を読み込み、
//   structuredClone / __ExpoImportMetaRegistry など複数の global を
//   `defineLazyObjectProperty` で定義している。
// - これらは初回アクセス時に `require()` を呼ぶ遅延ロードだが、Jest 30 では
//   テスト実行外 (teardown 等) でアクセスされた瞬間に
//   "You are trying to `import` a file outside of the scope of the test code."
//   が発生してテストが失敗する。
// - setupFiles 段階 (= テストモジュールロード前) に一度全てを参照して
//   eager 化することで回避する。

[
  '__ExpoImportMetaRegistry',
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
  'structuredClone',
].forEach((key) => {
  // eslint-disable-next-line no-unused-expressions
  globalThis[key];
});
