# Version1 リリース準備状況

2026-07-08時点の実装状態を整理する。

## 完成度

Version1完成までの到達度は **97%前後**。

主要機能は本番環境で通し確認済み。画面文言整理とZIP出力の自動テストも追加済み。残りはadmin中心の実務データ確認と、税理士提出ファイルを実際に開いて確認する工程が中心。

## 完了済み

| 項目 | 状態 |
| --- | --- |
| 仕入登録 | 完了 |
| Supabaseログイン必須化 | 完了 |
| admin / staff / tax_accountant 権限制御 | 完了 |
| Supabase Database 読み取り | 完了 |
| Supabase Database 新規保存 | 完了 |
| Supabase Database 更新 | 完了 |
| Supabase Database 論理削除 | 完了 |
| 複数証憑画像 | 完了 |
| Supabase Storage `evidence` 保存 | 完了 |
| 編集時の証憑追加 | 完了 |
| IndexedDBからSupabaseへの移行 | 完了 |
| CSV出力 | 完了 |
| Excel出力 | 完了 |
| PDF出力 | 完了 |
| 月次税理士提出ZIP | 完了 |
| 月次ZIPのStorage保存 | 完了 |
| 月次ZIP保存履歴と再DL | 完了 |
| 月次ZIP保存履歴の管理者削除 | 完了 |
| Cloudflare Pages公開 | 完了 |
| Cloudflare Pages Function `/extract` | 完了 |
| AI抽出本番確認 | 完了 |
| README更新 | 完了 |
| UI文言整理 | 完了 |
| ZIP出力テスト | 完了 |

## 残タスク

| 優先度 | 項目 | 内容 |
| --- | --- | --- |
| P0 | admin実務データ確認 | 実際の仕入データで登録、編集、削除、証憑保存、月次ZIP作成を確認 |
| P0 | 出力ファイル確認 | CSV / Excel / PDF / 税理士提出ZIPをWindowsで開き、文字化けや破損がないことを確認 |
| P0 | 本番データ整理 | テスト用の仕入、証憑、提出ZIP履歴を削除 |
| P1 | 権限別テスト | staff / tax_accountant を使う場合に実アカウントを追加して確認 |
| P1 | E2Eテスト | 主要導線のブラウザ自動テスト |
| P2 | 監査ログ表示 | DBに残すだけでなく画面表示する |
| P2 | 月次締め | 運用ルール確定後に追加 |

## リリース判定

Version1 Releaseとして出すには、最低限以下を確認する。

- Cloudflare Productionが最新commitである
- Supabase Productionでログインできる
- adminが仕入登録、編集、削除、月次ZIP作成を実行できる
- staff / tax_accountant を使う場合は、権限別に画面制御とRLSを確認できる
- AI抽出が `/extract` 経由で動作する
- 月次ZIPが `tax-packages` bucketに保存される
- 証憑画像が `evidence` bucketに保存される
- CSV / Excel / PDF / ZIPを実務PCで開ける
- 本番に不要なテストデータが残っていない

## 次の推奨作業

1. adminで実務データを数件登録する
2. CSV / Excel / PDF / 税理士提出ZIPをWindowsで開く
3. 保存済み提出ZIP履歴とStorageを確認する
4. テストデータを削除する
5. Version1 Release判定を行う
