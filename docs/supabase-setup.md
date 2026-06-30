# Supabase 初期設定手順

この手順は Version 2 の Supabase 化に向けた初期セットアップ用です。現時点ではアプリ本体にはまだ接続しません。

## 作成されるもの

- Database schema
- RLS policy
- Storage buckets
- Storage RLS policy
- 初期マスタ
- 初期ロール運用ルール

SQL本体:

- `supabase/schema.sql`

## 1. Supabase プロジェクトを作成する

1. Supabase で新規プロジェクトを作成します。
2. Database password を安全に保管します。
3. Project URL と anon key を控えます。
4. 社内利用のため、必要に応じて MFA やメールドメイン運用を検討します。

## 2. SQLを実行する

Supabase Dashboard の SQL Editor で `supabase/schema.sql` を実行します。

作成対象:

- `profiles`
- `branches`
- `channels`
- `categories`
- `purchases`
- `purchase_evidence`
- `monthly_packages`
- `audit_logs`
- updated_at trigger
- RLS helper functions
- RLS policies
- Storage buckets
- Storage policies
- 初期マスタ

実行後、Table Editor で各テーブルが作成されていることを確認します。

## 3. Storage bucket 作成手順

`supabase/schema.sql` は次の bucket を `storage.buckets` に作成します。

| Bucket | Public | 用途 |
| --- | --- | --- |
| `evidence` | false | 仕入証憑画像 |
| `tax-packages` | false | 月次税理士提出ZIP |
| `imports` | false | V1移行用一時ファイル |

Dashboard で確認する場合:

1. Supabase Dashboard を開きます。
2. Storage を開きます。
3. `evidence`, `tax-packages`, `imports` が存在することを確認します。
4. すべて private bucket であることを確認します。

## 4. Storage path 方針

### evidence

```text
purchases/YYYY/MM/{purchase_id}/001_明細_receipt.jpg
purchases/YYYY/MM/{purchase_id}/002_商品ページ_item-page.jpg
purchases/YYYY/MM/{purchase_id}/003_現物写真_photo.jpg
```

### tax-packages

```text
YYYY/MM/税理士提出_YYYY-MM_YYYYMMDDTHHMMSS.zip
```

### imports

```text
v1-backups/{user_id}/{uploaded_at}_backup.json
```

## 5. RLS policy 概要

全アプリテーブルで RLS を有効化します。

### ロール

| role | 説明 |
| --- | --- |
| `admin` | 管理者。全データ操作、マスタ管理、ユーザー管理 |
| `staff` | 社内スタッフ。仕入・証憑の作成、閲覧、更新 |
| `tax_accountant` | 税理士閲覧用。閲覧とダウンロードのみ |

### テーブル別方針

| テーブル | admin | staff | tax_accountant |
| --- | --- | --- | --- |
| `profiles` | select/insert/update | 自分のみselect/update | 自分のみselect/update |
| `branches` | 全操作 | select | select |
| `channels` | 全操作 | select | select |
| `categories` | 全操作 | select | select |
| `purchases` | 全操作 | select/insert/update | select |
| `purchase_evidence` | 全操作 | select/insert/update | select |
| `monthly_packages` | 全操作 | select/insert | select |
| `audit_logs` | select | insert | insert |

補足:

- `purchases` は `deleted_at` による論理削除を基本にします。
- `staff` と `tax_accountant` は `deleted_at is null` の明細のみ閲覧できます。
- `profiles` は自己更新時のロール昇格を防ぐトリガーを設定しています。

### Storage policy

| Bucket | admin | staff | tax_accountant |
| --- | --- | --- | --- |
| `evidence` | select/insert/update/delete | select/insert/update | select |
| `tax-packages` | select/insert/update/delete | select/insert | select |
| `imports` | select/insert/delete | 不可 | 不可 |

## 6. 初期ロール設計

Supabase Auth のユーザー作成後、`profiles` にロールを登録します。

### 初回管理者の作成

1. Supabase Dashboard の Authentication で管理者ユーザーを作成します。
2. 作成された Auth User ID を控えます。
3. SQL Editor で次を実行します。

```sql
insert into public.profiles (id, display_name, role)
values ('AUTH_USER_UUID_HERE', '管理者', 'admin');
```

初回管理者だけは、SQL Editor または service role で作成します。以後のユーザーは管理者画面から作成する想定です。

### スタッフの作成

```sql
insert into public.profiles (id, display_name, role)
values ('AUTH_USER_UUID_HERE', 'スタッフ名', 'staff');
```

### 税理士閲覧用ユーザーの作成

```sql
insert into public.profiles (id, display_name, role)
values ('AUTH_USER_UUID_HERE', '税理士閲覧用', 'tax_accountant');
```

## 7. Netlifyに設定すべき環境変数

Version 2 実装時に Netlify の Environment variables に設定します。

| 変数名 | 必須 | 用途 |
| --- | --- | --- |
| `SUPABASE_URL` | 必須 | Supabase Project URL |
| `SUPABASE_ANON_KEY` | 必須 | フロントエンドから利用する anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 原則サーバー側のみ | 移行処理や管理処理で必要な場合のみ |
| `SUPABASE_STORAGE_EVIDENCE_BUCKET` | 任意 | 既定値: `evidence` |
| `SUPABASE_STORAGE_TAX_PACKAGES_BUCKET` | 任意 | 既定値: `tax-packages` |
| `SUPABASE_STORAGE_IMPORTS_BUCKET` | 任意 | 既定値: `imports` |
| `APP_ENV` | 任意 | `production` / `staging` など |

既存の Netlify Functions を併用する場合は、現行の変数も必要です。

| 変数名 | 用途 |
| --- | --- |
| `ANTHROPIC_API_KEY` | AI抽出 |
| `SHARED_SECRET` | 既存Functionsの共通認証 |
| `SYNC_SECRET` | 既存同期Functionの認証 |
| `ALLOWED_ORIGIN` | CORS許可Origin |

注意:

- `SUPABASE_SERVICE_ROLE_KEY` はブラウザに露出させてはいけません。
- Vite 等でフロントエンドに公開する場合も、service role key は絶対に `VITE_` などの公開prefixにしません。

## 8. 初期マスタ

`schema.sql` は次の初期マスタを投入します。

### branches

- 札幌
- 千葉
- 東京
- 福岡

### channels

- ヤフオク
- メルカリ
- ラクマ
- 市場（古物市場）
- 業者オークション
- 店頭買取
- その他

### categories

- 時計
- バッグ
- 貴金属・宝飾
- カメラ
- コイン・切手
- 美術品・骨董
- 道具類
- 衣類
- その他

## 9. セットアップ後の確認

SQL実行後、次を確認します。

1. `profiles` などのテーブルが作成されている。
2. `branches`, `channels`, `categories` に初期値が入っている。
3. Storage に `evidence`, `tax-packages`, `imports` が作成されている。
4. 各テーブルの RLS が enabled になっている。
5. 管理者ユーザーの `profiles.role` が `admin` になっている。
6. anon key で直接書き込みできる範囲が RLS により制限されている。

## 10. 今後の実装順

1. Supabase client 初期化を追加する。
2. ログイン画面を追加する。
3. `profiles` を読み込んでロール別UIを切り替える。
4. マスタ取得を Supabase 化する。
5. 仕入CRUDを Supabase 化する。
6. 証憑画像アップロードを Storage 化する。
7. 月次税理士提出ZIPを Storage 保存する。
8. V1 JSONバックアップ移行機能を実装する。

## 11. 運用上の注意

- 初期管理者作成前は、通常ユーザーから `profiles` を作成できません。
- まず Supabase Dashboard または service role で管理者プロフィールを作成してください。
- Storage bucket は private のまま運用してください。
- 税理士閲覧用ユーザーには編集UIを出さず、RLSでも insert/update/delete を許可しません。
- 本番データ投入前に、テストユーザー3種類でRLSの動作確認をしてください。
