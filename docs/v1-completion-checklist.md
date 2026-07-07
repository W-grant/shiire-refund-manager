# Version1 完成チェックリスト

作成日: 2026-07-01  
更新日: 2026-07-07

Version1完成に向けた現在の到達点を整理する。現在はCloudflare Pages、Supabase Auth / Database / Storage、Cloudflare Pages Function `/extract` を使う本番構成へ移行済み。

## 現在の全体状況

主要な業務フローは本番環境で通し確認済み。

- adminログイン
- AI抽出
- 仕入登録、編集、削除
- 複数証憑画像のStorage保存と表示
- CSV / Excel / PDF出力
- 税理士提出ZIP作成
- 税理士提出ZIPのStorage保存、履歴再DL、管理者削除

Version1完成前に残る中心作業は、実務データでの社内運用テストと、細かな画面文言・帳票品質の確認。

## Version1 完成条件との差分

| 完成条件 | 現状 | 判定 | 残り作業 |
| --- | --- | --- | --- |
| 仕入登録 | Supabase Databaseで登録、編集、論理削除を確認済み | 完了 | 実務データで継続確認 |
| AI抽出（Claude） | Cloudflare `/extract` 経由で本番動作確認済み | 完了 | 読み取りミス前提の目視確認を運用化 |
| 複数証憑画像 | Storage `evidence` 保存、一覧、詳細表示を確認済み | 完了 | 実データで容量・枚数確認 |
| 古物商特例判定 | 自動判定とテストあり | 完了 | 税理士レビュー |
| CSV出力 | 仕入一覧、古物商帳簿、索引簿に対応 | 完了 | 税理士提出フォーマット確認 |
| Excel出力 | 通常出力、月次ZIP内XLSXに対応 | 完了 | 実ファイル開封確認 |
| PDF出力 | ブラウザ印刷、月次ZIP内PDFに対応 | 完了 | 帳票品質確認 |
| 税理士提出ZIP | 作成、Storage保存、履歴再DL、削除を確認済み | 完了 | 実務月次データで確認 |
| Supabase保存 | Auth、DB、Storage、RLSを実装済み | 完了 | 本番運用監視 |
| 社内運用テスト | admin中心の本番テストへ進む段階 | 未完了 | 3〜5人テスト、または当面admin運用テスト |

## 実装済み機能一覧

- Supabase Authログイン必須化
- `admin` / `staff` / `tax_accountant` の権限制御
- 仕入レコードの登録、編集、論理削除
- 支店、チャネル、担当者、カテゴリの設定
- 月別タブ、検索、担当者・チャネル・支店・控除区分フィルタ
- 仕入金額、控除対象税額、控除区分などの集計表示
- 古物商特例、準古物、登録事業者、経過措置、控除不可の判定
- 1仕入レコードへの複数証憑画像添付
- 一覧での代表サムネイル表示
- 証憑画像の詳細表示、前後切替、サムネイル切替、画像保存
- Supabase Storage `evidence` への証憑保存
- 証憑画像の一括ZIP出力
- 仕入一覧CSV、古物商特例帳簿CSV、電帳法索引簿CSVの出力
- CSVテンプレート出力、CSV取り込み
- Excel出力
- PDFレポート出力
- バックアップJSONの保存、復元
- IndexedDBローカルデータのSupabase移行
- AI抽出レビュー画面
- Cloudflare Pages Function `/extract` によるClaude API中継
- 月次の税理士提出パッケージZIP出力
- 月次ZIPのSupabase Storage保存、履歴再DL、管理者削除
- Cloudflare Pagesデプロイ
- README、利用説明書、社内テスト計画
- 分類ロジック、CSV、Functionsの自動テスト

## 未完成・不安定な機能

### 社内運用テスト

Version1 Release前の最大の残作業。まずはadmin中心で実務データを登録し、AI抽出、証憑保存、月次提出ZIP、出力ファイルを確認する。staff / tax_accountant は必要になった時点で追加する。

### AI抽出

本番動作は確認済み。ただしAIの読み取り結果は必ず人が確認する。

- 日付、金額、商品名、相手方は目視確認する
- 登録前レビューの警告を確認する
- 読み取れない証憑は手入力する

### Excel / PDF

機能としては動作するが、実務帳票としての見やすさには改善余地がある。

- PDFの日本語フォント品質
- Excelの開封確認
- 税理士側の希望フォーマット確認

### E2Eテスト

現在の自動テストは分類ロジック、CSV、Functionsが中心。ブラウザ操作の自動テストは今後追加したい。

## Version1 Release判定

Version1 Releaseとして出すには、最低限以下を確認する。

- Cloudflare Productionが最新commitである
- Supabase Productionでadminログインできる
- adminが仕入登録、編集、削除、月次ZIP作成、履歴削除を実行できる
- AI抽出が `/extract` 経由で動作する
- 月次ZIPが `tax-packages` bucketに保存される
- 証憑画像が `evidence` bucketに保存される
- CSV / Excel / PDF / ZIPを実務PCで開ける
- 本番に不要なテストデータとテストZIPが残っていない

## 次の推奨作業

1. admin運用で実務データを数件登録する
2. 証憑画像を複数枚添付する
3. 月次税理士提出ZIPを作成し、税理士確認に回す
4. [internal-test-plan.md](internal-test-plan.md) に沿って社内テストを実施する
5. 必要になった時点でstaff / tax_accountantの実アカウントを追加する
6. Version1 Release判定を行う
