# 仕入れ還付管理アプリ 引き継ぎガイド

このリポジトリは、中古品リユース事業者向けの仕入・販売・還付管理アプリです。
別方向にブラッシュアップする場合は、このファイル、`README.md`、`USER_GUIDE.md`、`docs/` を最初に確認してください。

## 現在の主な機能

- Supabaseログイン
- 仕入登録、編集、削除
- AI抽出
- CSV / PDFデータ読み込み
- 複数証憑画像 / PDF添付
- 証憑種類管理
- Supabase Database / Storage保存
- 販売管理
- 管理番号自動生成
- 経営ダッシュボード
- Googleスプレッドシート連携
- CSV / Excel / PDF出力
- 月次税理士提出ZIP
- Cloudflare Pages / Functions対応

## 起動方法

```bash
pnpm install
pnpm run dev
```

本番ビルド:

```bash
pnpm run build
```

構文チェック:

```bash
pnpm run check
```

テスト:

```bash
pnpm test
```

## 必要な環境変数

実値はこのリポジトリには含めていません。

| 名前 | 用途 | 注意 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Supabase Project URL | フロントに埋め込まれる |
| `VITE_SUPABASE_ANON_KEY` | Supabase Publishable Key | フロントに埋め込まれる |
| `ANTHROPIC_API_KEY` | Claude AI抽出 | Cloudflare Functions側だけに設定 |
| `SHARED_SECRET` | 任意の中継保護 | 必要な場合のみ |
| `SHEETS_SYNC_CLIENT_SECRET` | 任意のスプシ連携保護 | 必要な場合のみ |

`ANTHROPIC_API_KEY` や service role key はブラウザ側へ出さないでください。

## 主要ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 画面本体と主要UIロジック |
| `src/main.ts` | Supabase/Auth連携の入口 |
| `src/lib/` | Supabase Repository / Service / Mapper |
| `functions/extract.js` | Claude API中継 |
| `functions/sheets-sync.js` | Google Apps Script連携中継 |
| `supabase/schema.sql` | Supabase初期構築SQL |
| `supabase/sales-dashboard.sql` | 販売管理用SQL |
| `scripts/google-sheets-sync.gs` | Google Apps Script側コード |
| `docs/` | 設計書、設定手順、検証手順 |

## 現在の公開構成

- フロント: Cloudflare Pages
- Functions: Cloudflare Pages Functions
- Database: Supabase Database
- Storage: Supabase Storage
- AI: Claude API
- スプシ連携: Google Apps Script

## 渡すときに含めないもの

以下は共有しないでください。

- `.env`
- 実際のAPIキー
- Supabase service role key
- Cloudflare / Supabase / Anthropic / Googleのログイン情報
- `node_modules/`
- `.git/`
- 個人や顧客の実データを含むエクスポートファイル

## ブラッシュアップ時のおすすめ順

1. `README.md` と `USER_GUIDE.md` を読む
2. `docs/v1-completion-checklist.md` で現在の完成度を把握する
3. `docs/database-design.md` と `supabase/schema.sql` でDB構成を確認する
4. 画面を変更する場合は `index.html` を中心に見る
5. 保存処理を変更する場合は `src/lib/services/` と `src/lib/repositories/` を見る
6. 変更後は `pnpm run check`、`pnpm test`、`pnpm run build` を実行する

## 注意点

- 旧Netlify関連ファイルは互換用に残っていますが、通常運用ではCloudflareを使います。
- AI抽出はClaude APIキーがないと動きません。
- SupabaseのRLSが前提なので、認証・権限まわりを変更する場合は `docs/role-permission-checklist.md` を確認してください。
- 税務判断はアプリで断定せず、最終確認は税理士へ回す前提です。
