# Version1 リリース検証レポート

作成日: 2026-07-08

## 検証結果

Version1は、コード・自動テスト・本番配信の観点ではリリース直前状態。

残る確認は、実務データと税理士提出ファイルを人が開いて確認する工程。

## 実施済み

- 構文チェック
- 自動テスト
- 本番ビルド
- GitHub `main` へのpush
- Cloudflare Production最新commit反映確認
- Production URL表示確認
- Cloudflare Pages Function `/extract` ヘルスチェック

## 自動テスト

現在のテスト対象:

- 古物商特例・インボイス経過措置の判定
- CSVのBOM、引用符、カンマ、改行、空欄
- FunctionsのOPTIONS、認証、Anthropic中継
- ZIPの日本語ファイル名、証憑フォルダ、画像データ
- 本番UI文言の退行防止

## Production確認

Production URL:

```text
https://shiire-refund-manager.pages.dev/
```

確認内容:

- HTTP 200
- アプリ本文を取得可能
- 日本語ステータス文言が配信されている

## `/extract` 確認

```json
{
  "ok": true,
  "anthropicConfigured": true,
  "authRequired": false
}
```

## Release前に人が確認すること

1. adminで実務仕入を数件登録する
2. 複数証憑画像を添付する
3. AI抽出から登録まで確認する
4. 税理士提出ZIPを作成する
5. ZIP内のCSV / Excel / PDF / 証憑画像をWindowsで開く
6. 不要なテスト仕入、証憑、提出ZIP履歴を削除する

## 判定

自動で確認できる範囲は合格。

Version1 Releaseの最終可否は、実務データと出力ファイルの目視確認後に判定する。
