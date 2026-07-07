# Version1 リリース準備状況

2026-07-07時点の実装状態を整理する。

## 完成度

Version1完成までの到達度は **95%前後**。

主要機能は本番環境で通し確認済み。残りはadmin中心の社内運用テスト、実務データでの出力確認、細かなUI文言整理が中心。

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

## 残タスク

| 優先度 | 項目 | 内容 |
| --- | --- | --- |
| P0 | 社内運用テスト | admin / staff / tax_accountant で実操作確認 |
| P0 | 社内運用テスト | まずadmin運用で実務データ確認。staff / tax_accountant は必要になった時点で追加 |
| P1 | UI文言整理 | 文字化けが残る画面文言の修正 |
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

## 次の推奨作業

1. [internal-test-plan.md](internal-test-plan.md) に沿ってadmin中心の社内テストを実施する
2. 実務データでCSV / Excel / PDF / 税理士提出ZIPを確認する
3. 必要になった時点でstaff / tax_accountantの実アカウントを追加する
4. テストで出たUI文言、操作性、権限漏れを修正する
5. Version1 Release判定を行う
