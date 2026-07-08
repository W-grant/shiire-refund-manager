# Supabase Phase1 検証手順

作成日: 2026-07-01

この文書は Supabase Phase1 構築後の検証手順です。アプリ本体へ接続する前に、接続情報、RLS、Storage 権限、初期マスタ、Phase2 着手前チェックを確認します。

## Phase1 完了状態

Phase1 では次の状態まで完了している前提です。

- `supabase/schema.sql` が Supabase SQL Editor で適用済み
- Storage bucket が作成済み
  - `evidence`
  - `tax-packages`
  - `imports`
- 初期マスタが投入済み
  - `branches`
  - `channels`
  - `categories`
- Authentication に管理者ユーザー作成済み
- `profiles` に管理者ユーザーが `admin` として登録済み

## Supabase接続情報として必要な環境変数

Phase2 でアプリ本体へ接続する前に、次の値を Supabase Dashboard で控え、Cloudflare Pages Production環境へ設定します。

取得場所:

- Supabase Dashboard
- 対象Project
- Project Settings
- API

### フロントエンドで使う値

| 環境変数 | 必須 | 公開可否 | 用途 |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | 必須 | 公開可 | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | 必須 | 公開可 | ログイン済みユーザーとして Database / Storage にアクセスするための Supabase Publishable Key |
| `SUPABASE_STORAGE_EVIDENCE_BUCKET` | 任意 | 公開可 | 証憑画像bucket名。既定値は `evidence` |
| `SUPABASE_STORAGE_TAX_PACKAGES_BUCKET` | 任意 | 公開可 | 税理士提出ZIP bucket名。既定値は `tax-packages` |
| `SUPABASE_STORAGE_IMPORTS_BUCKET` | 任意 | 公開可 | V1移行用bucket名。既定値は `imports` |

### サーバー側だけで使う値

| 環境変数 | 必須 | 公開可否 | 用途 |
| --- | --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | 必要時のみ | 絶対に公開不可 | 移行処理、管理処理、サーバー側バッチでRLSを bypass する場合のみ使用 |

### Cloudflare Pages Functionsで使う値

| 環境変数 | 用途 |
| --- | --- |
| `ANTHROPIC_API_KEY` | AI抽出用 |
| `SHARED_SECRET` | 任意。Cloudflare Pages Function `/extract` の共通認証 |
| `ALLOWED_ORIGIN` | 任意。Cloudflare Pages Functions の CORS 許可Origin |

注意:

- `SUPABASE_SERVICE_ROLE_KEY` はブラウザに絶対に渡しません。
- Cloudflare Pages / Vite の公開prefixを使う場合でも、service role key には公開prefixを付けません。
- Phase2 では、まず `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` だけでログイン・RLS確認を行います。

## RLS確認の準備

RLS確認には、3種類のテストユーザーを用意します。

| ロール | 用途 |
| --- | --- |
| `admin` | 全操作できることを確認 |
| `staff` | 仕入・証憑を作成、閲覧、更新できることを確認 |
| `tax_accountant` | 閲覧のみで、作成・更新・削除できないことを確認 |

### テストユーザー作成

Supabase Dashboard の Authentication で、次のテストユーザーを作成します。

- 管理者ユーザー
- スタッフユーザー
- 税理士閲覧用ユーザー

作成後、それぞれの Auth User ID を控えます。

### profiles登録

SQL Editor で次の形式で `profiles` に登録します。

```sql
insert into public.profiles (id, display_name, role)
values
  ('ADMIN_USER_UUID', '管理者', 'admin'),
  ('STAFF_USER_UUID', 'スタッフ', 'staff'),
  ('TAX_ACCOUNTANT_USER_UUID', '税理士閲覧用', 'tax_accountant')
on conflict (id) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  is_active = true;
```

## admin / staff / tax_accountant のRLS確認手順

RLSは、SQL Editor上で疑似的にログインユーザーを切り替えて確認できます。

SQL Editor は通常 `postgres` 権限で動くため、そのまま実行するとRLSの実利用状態とは異なります。確認時は `set local role authenticated` と `request.jwt.claim.sub` を使って、ログイン済みユーザーを疑似的に再現します。

### 1. auth.uid() の確認

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'ADMIN_USER_UUID';

select auth.uid();

rollback;
```

期待結果:

- `auth.uid()` が `ADMIN_USER_UUID` を返す

同じ確認を `STAFF_USER_UUID`, `TAX_ACCOUNTANT_USER_UUID` でも行います。

### 2. ロール判定関数の確認

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'ADMIN_USER_UUID';

select
  public.current_role() as current_role,
  public.is_admin() as is_admin,
  public.is_staff_or_admin() as is_staff_or_admin,
  public.can_read_app_data() as can_read_app_data;

rollback;
```

期待結果:

| ユーザー | `current_role()` | `is_admin()` | `is_staff_or_admin()` | `can_read_app_data()` |
| --- | --- | --- | --- | --- |
| admin | `admin` | true | true | true |
| staff | `staff` | false | true | true |
| tax_accountant | `tax_accountant` | false | false | true |

### 3. 初期マスタの閲覧確認

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'STAFF_USER_UUID';

select count(*) as branches_count from public.branches;
select count(*) as channels_count from public.channels;
select count(*) as categories_count from public.categories;

rollback;
```

期待結果:

- `branches_count = 4`
- `channels_count = 7`
- `categories_count = 9`

同じ確認を `admin`, `tax_accountant` でも行い、全ロールで参照できることを確認します。

### 4. staff のマスタ更新不可確認

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'STAFF_USER_UUID';

insert into public.branches (name, sort_order)
values ('RLSテスト支店_staff', 999);

rollback;
```

期待結果:

- RLS により insert が拒否される

### 5. tax_accountant の仕入作成不可確認

事前に `branches`, `channels`, `categories` のIDを1件ずつ取得します。

```sql
select id, name from public.branches order by sort_order limit 1;
select id, name from public.channels order by sort_order limit 1;
select id, name from public.categories order by sort_order limit 1;
```

その後、税理士閲覧用ユーザーで insert を試します。

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'TAX_ACCOUNTANT_USER_UUID';

insert into public.purchases (
  purchase_date,
  branch_id,
  channel_id,
  category_id,
  staff_id,
  name,
  quantity,
  amount,
  tax_rate,
  kind,
  stock,
  qualified,
  transaction_type
)
values (
  current_date,
  'BRANCH_UUID',
  'CHANNEL_UUID',
  'CATEGORY_UUID',
  'STAFF_USER_UUID',
  'RLSテスト商品',
  1,
  1000,
  10,
  'kobutsu',
  'yes',
  'no',
  'named'
);

rollback;
```

期待結果:

- RLS により insert が拒否される

### 6. staff の仕入作成可能確認

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'STAFF_USER_UUID';

insert into public.purchases (
  purchase_date,
  branch_id,
  channel_id,
  category_id,
  staff_id,
  name,
  quantity,
  amount,
  tax_rate,
  kind,
  stock,
  qualified,
  transaction_type,
  created_by,
  updated_by
)
values (
  current_date,
  'BRANCH_UUID',
  'CHANNEL_UUID',
  'CATEGORY_UUID',
  'STAFF_USER_UUID',
  'RLSテスト商品',
  1,
  1000,
  10,
  'kobutsu',
  'yes',
  'no',
  'named',
  'STAFF_USER_UUID',
  'STAFF_USER_UUID'
)
returning id;

rollback;
```

期待結果:

- insert が成功して `id` が返る
- `rollback` するため、テストデータは残らない

### 7. admin の削除可能確認

削除確認は実データを消さないよう、必ずトランザクション内で行います。

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'ADMIN_USER_UUID';

delete from public.purchases
where id = 'TEST_PURCHASE_UUID';

rollback;
```

期待結果:

- admin では delete が許可される
- `rollback` するため、実データは消えない

## Storage権限確認手順

Storage bucket は次の3つです。

| Bucket | admin | staff | tax_accountant |
| --- | --- | --- | --- |
| `evidence` | select/insert/update/delete | select/insert/update | select |
| `tax-packages` | select/insert/update/delete | select/insert | select |
| `imports` | select/insert/delete | 不可 | 不可 |

### 1. bucket存在確認

SQL Editor で確認します。

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('evidence', 'tax-packages', 'imports')
order by id;
```

期待結果:

- 3件返る
- `public = false`
- `evidence` は画像MIME typeを許可
- `tax-packages` はZIPを許可
- `imports` はJSON / CSV / ZIPを許可

### 2. Storage policy 存在確認

```sql
select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
```

期待されるpolicy:

- `storage_evidence_select`
- `storage_evidence_insert`
- `storage_evidence_update`
- `storage_evidence_delete`
- `storage_tax_packages_select`
- `storage_tax_packages_insert`
- `storage_tax_packages_update`
- `storage_tax_packages_delete`
- `storage_imports_select`
- `storage_imports_insert`
- `storage_imports_delete`

### 3. SQL EditorでのRLS疑似確認

Storage APIの完全な検証は、Phase2でログイン済みSupabase clientから行うのが確実です。Phase1ではSQL Editorで policy の許可範囲を疑似確認します。

staff が `evidence` に insert できること:

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'STAFF_USER_UUID';

insert into storage.objects (bucket_id, name, owner, metadata)
values (
  'evidence',
  'rls-test/staff-evidence.txt',
  'STAFF_USER_UUID',
  '{}'::jsonb
);

rollback;
```

期待結果:

- insert が許可される
- `rollback` によりテスト行は残らない

tax_accountant が `evidence` に insert できないこと:

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'TAX_ACCOUNTANT_USER_UUID';

insert into storage.objects (bucket_id, name, owner, metadata)
values (
  'evidence',
  'rls-test/tax-accountant-evidence.txt',
  'TAX_ACCOUNTANT_USER_UUID',
  '{}'::jsonb
);

rollback;
```

期待結果:

- RLS により insert が拒否される

staff が `imports` に insert できないこと:

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'STAFF_USER_UUID';

insert into storage.objects (bucket_id, name, owner, metadata)
values (
  'imports',
  'rls-test/staff-import.json',
  'STAFF_USER_UUID',
  '{}'::jsonb
);

rollback;
```

期待結果:

- RLS により insert が拒否される

admin が `imports` に insert できること:

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'ADMIN_USER_UUID';

insert into storage.objects (bucket_id, name, owner, metadata)
values (
  'imports',
  'rls-test/admin-import.json',
  'ADMIN_USER_UUID',
  '{}'::jsonb
);

rollback;
```

期待結果:

- insert が許可される
- `rollback` によりテスト行は残らない

### 4. Phase2で行う実API確認

Phase2でSupabase clientを接続したら、実ログイン状態で次を確認します。

| ロール | evidence | tax-packages | imports |
| --- | --- | --- | --- |
| admin | upload/list/download/remove 可能 | upload/list/download/remove 可能 | upload/list/download/remove 可能 |
| staff | upload/list/download 可能、remove不可 | upload/list/download 可能、remove不可 | upload不可 |
| tax_accountant | list/download 可能、upload/remove不可 | list/download 可能、upload/remove不可 | list/download/upload/remove不可 |

## 初期マスタ取得確認手順

SQL Editor で初期マスタを確認します。

### branches

```sql
select name, sort_order, is_active
from public.branches
order by sort_order, name;
```

期待結果:

| name | sort_order |
| --- | --- |
| 札幌 | 10 |
| 千葉 | 20 |
| 東京 | 30 |
| 福岡 | 40 |

### channels

```sql
select name, sort_order, is_active
from public.channels
order by sort_order, name;
```

期待結果:

| name | sort_order |
| --- | --- |
| ヤフオク | 10 |
| メルカリ | 20 |
| ラクマ | 30 |
| 市場（古物市場） | 40 |
| 業者オークション | 50 |
| 店頭買取 | 60 |
| その他 | 70 |

### categories

```sql
select name, sort_order, is_active
from public.categories
order by sort_order, name;
```

期待結果:

| name | sort_order |
| --- | --- |
| 時計 | 10 |
| バッグ | 20 |
| 貴金属・宝飾 | 30 |
| カメラ | 40 |
| コイン・切手 | 50 |
| 美術品・骨董 | 60 |
| 道具類 | 70 |
| 衣類 | 80 |
| その他 | 90 |

### ロール別マスタ取得確認

各ロールで次を実行し、全ロールで取得できることを確認します。

```sql
begin;

set local role authenticated;
set local request.jwt.claim.sub = 'USER_UUID';

select 'branches' as table_name, count(*) from public.branches
union all
select 'channels', count(*) from public.channels
union all
select 'categories', count(*) from public.categories;

rollback;
```

期待結果:

- `branches = 4`
- `channels = 7`
- `categories = 9`

## Phase2でアプリ接続する前に必要なチェックリスト

### Supabase Project

- [ ] Project URL を控えた
- [ ] anon key を控えた
- [ ] service role key を安全な場所に保管した
- [ ] service role key をフロントエンドに出さない運用を確認した
- [ ] Database password を安全な場所に保管した

### Auth / profiles

- [ ] 管理者ユーザーが Authentication に存在する
- [ ] 管理者ユーザーが `profiles.role = 'admin'` で登録されている
- [ ] staff テストユーザーを作成した
- [ ] tax_accountant テストユーザーを作成した
- [ ] 3ロールすべてで `public.current_role()` が期待通り返る
- [ ] 退職者・停止ユーザーは `profiles.is_active = false` で止める運用にする

### Database / RLS

- [ ] `profiles`, `branches`, `channels`, `categories`, `purchases`, `purchase_evidence`, `monthly_packages`, `audit_logs` が作成済み
- [ ] 各テーブルで RLS が enabled
- [ ] admin はマスタ insert/update/delete ができる
- [ ] staff はマスタを閲覧できるが変更できない
- [ ] tax_accountant はマスタを閲覧できるが変更できない
- [ ] staff は仕入を insert/update できる
- [ ] tax_accountant は仕入を insert/update/delete できない
- [ ] tax_accountant は `deleted_at is null` の仕入のみ閲覧できる

### Storage

- [ ] `evidence` bucket が存在する
- [ ] `tax-packages` bucket が存在する
- [ ] `imports` bucket が存在する
- [ ] 3bucketすべて `public = false`
- [ ] Storage policies が作成済み
- [ ] staff は `evidence` に upload できる
- [ ] tax_accountant は `evidence` に upload できない
- [ ] staff は `imports` に upload できない
- [ ] admin は `imports` に upload できる

### 初期マスタ

- [ ] `branches` が4件
- [ ] `channels` が7件
- [ ] `categories` が9件
- [ ] すべて `is_active = true`
- [ ] 実運用で必要な支店・担当者・カテゴリに不足がない

### Phase2 実装前の判断

- [ ] ローカル IndexedDB から Supabase へ移行する方式を決めた
- [ ] 旧Netlify Blobs同期を廃止し、Supabase保存へ寄せることを確認した
- [ ] 税理士閲覧用ユーザーに見せる範囲を決めた
- [ ] 証憑画像のStorage pathルールを確定した
- [ ] 月次税理士提出ZIPのStorage保存タイミングを決めた
- [ ] Cloudflare Pages環境変数の登録先を確認した
- [ ] 本番用と検証用のSupabaseプロジェクトを分けるか決めた

## Phase1検証完了の目安

次の状態になれば Phase2 のアプリ接続へ進めます。

- 3ロールのユーザーを作成済み
- `profiles` に3ロールが登録済み
- RLSの読み書き可否が期待通り
- Storage bucket と policy が期待通り
- 初期マスタが取得できる
- Phase2で使う環境変数を控えている
- service role key をブラウザへ出さない方針が確認済み
