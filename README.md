# 仕入れ還付管理

中古品リユース事業者向けの仕入管理・控除見える化アプリです。仕入登録、証憑画像管理、古物商特例判定、CSV / Excel / PDF 出力、月次税理士提出ZIP、Supabase保存に対応します。

> 税務判断・申告処理は、必ず税理士へ確認してください。

## 現在の構成

- Frontend: Vite + single page app
- Hosting: Cloudflare Pages
- Functions: Cloudflare Pages Functions
- Database: Supabase Database
- Storage: Supabase Storage
- Auth: Supabase Auth
- AI extraction: Claude API via Cloudflare Pages Function `/extract`

## 主な機能

- Supabase Authによるログイン必須化
- `admin` / `staff` / `tax_accountant` の権限制御
- 仕入登録、一覧、編集、論理削除
- 複数証憑画像の添付、代表サムネイル表示、詳細表示
- Supabase Storage `evidence` への証憑画像保存
- IndexedDBローカルデータのSupabase移行
- 古物商特例、準古物、インボイス、経過措置の判定
- 仕入一覧CSV、古物商特例帳簿CSV、電帳法索引簿CSV
- Excel出力、PDF出力
- 月次税理士提出ZIP作成
- 月次税理士提出ZIPのStorage保存と履歴再ダウンロード
- Claude APIによるAI抽出レビュー

## 権限

| 権限 | できること |
| --- | --- |
| `admin` | 登録、編集、削除、証憑削除、設定、提出ZIP作成 |
| `staff` | 登録、編集、証憑追加、提出ZIP作成 |
| `tax_accountant` | 閲覧、CSV/Excel/PDF出力、保存済み提出ZIPの再ダウンロード |

詳細は [docs/role-permission-checklist.md](docs/role-permission-checklist.md) を参照してください。

## Cloudflare Pages設定

Cloudflare Pagesの設定は以下です。

- Build command: `pnpm run build`
- Output directory: `dist`
- Production URL: `https://shiire-refund-manager.pages.dev/`

### 環境変数

Cloudflare PagesのProduction環境に設定します。

| 変数名 | 用途 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Publishable Key |
| `ANTHROPIC_API_KEY` | AI抽出用Claude APIキー |
| `SHARED_SECRET` | 任意。AI抽出Functionの共有シークレット |
| `ALLOWED_ORIGIN` | 任意。CORS許可Origin |

`ANTHROPIC_API_KEY` と `SHARED_SECRET` は `VITE_` を付けないでください。ブラウザに公開しないサーバー側変数です。

## Cloudflare Pages Functions

### `/extract`

`functions/extract.js` がClaude APIへの中継を行います。

- ブラウザにAnthropic APIキーを持たせません
- `ANTHROPIC_API_KEY` をCloudflare側で参照します
- `SHARED_SECRET` または `SYNC_SECRET` が設定されている場合、`X-App-Secret` ヘッダーで認証します
- `GET /extract` で `anthropicConfigured` と `authRequired` を確認できます。APIキーの値そのものは返しません

アプリのAI中継URLの既定値は `/extract` です。

## Supabase

初期SQLは [supabase/schema.sql](supabase/schema.sql) です。

主なテーブル:

- `profiles`
- `branches`
- `channels`
- `categories`
- `purchases`
- `purchase_evidence`
- `monthly_packages`
- `audit_logs`

Storage buckets:

- `evidence`
- `tax-packages`
- `imports`

セットアップ手順は [docs/supabase-setup.md](docs/supabase-setup.md) を参照してください。

## 月次税理士提出ZIP

対象月を選び、`提出ZIP` を押すと以下を1つのZIPにまとめます。

- `01_仕入一覧.csv`
- `02_古物商特例帳簿.csv`
- `03_電帳法索引簿.csv`
- `04_月次サマリー.xlsx`
- `05_月次レポート.pdf`
- `証憑/` 配下の全証憑画像

作成したZIPはダウンロードされ、同時にSupabase Storage `tax-packages` へ保存されます。保存履歴から再ダウンロードできます。

## 開発

依存関係をインストールします。

```bash
pnpm install
```

ローカル開発サーバー:

```bash
pnpm run dev
```

構文チェック:

```bash
pnpm run check
```

テスト:

```bash
pnpm run test
```

本番ビルド:

```bash
pnpm run build
```

## デプロイ確認

作業完了時は以下を確認します。

- Build成功
- Test成功
- GitHub Push成功
- Cloudflare Productionが最新commitになったこと
- Production URLで最新コードが配信されていること

## 主要ファイル

- `index.html`: 画面、仕入管理、出力、AI抽出UI
- `src/lib/supabase.ts`: Supabase client
- `src/lib/repositories/`: Supabase Database / Storage access
- `src/lib/services/`: Auth、仕入保存、月次ZIP保存
- `functions/extract.js`: Cloudflare Pages Function Claude API中継
- `netlify/functions/`: 旧Netlify用Function。移管前互換として残置
- `supabase/schema.sql`: Supabase初期SQL
- `docs/`: 設計書、検証手順、権限チェックリスト

## 残タスク

- Cloudflare本番でのAI抽出実データ確認
- staff / tax_accountant の実アカウントで権限別テスト
- 社内3〜5人での運用テスト
- 文字化けが残る画面文言の整理
- E2Eテストの追加
