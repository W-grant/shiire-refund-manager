# 社内運用テスト計画

Version1リリース前に、まずadmin中心で実務操作を確認する。staff / tax_accountant は必要になった時点で追加して確認する。

## 目的

- Supabase保存が実運用で成立することを確認する
- adminで日常運用が成立することを確認する
- staff / tax_accountant を使う場合は権限制御を確認する
- 証憑画像、月次税理士提出ZIP、保存履歴が業務で使えることを確認する
- AI抽出の読み取り精度と登録前レビューの流れを確認する

## テストユーザー

Supabase DashboardのAuthenticationでユーザーを作成し、SQL Editorで `profiles` に紐づける。

| 用途 | role | 人数 |
| --- | --- | --- |
| 管理者 | `admin` | 1 |
| 社内担当者 | `staff` | 必要時 |
| 税理士閲覧用 | `tax_accountant` | 必要時 |

当面adminのみで運用開始する場合、staff / tax_accountant は作成しなくてよい。複数人で使い始めるタイミングで以下を追加する。

| 用途 | 例 |
| --- | --- |
| 管理者確認 | `admin-test@...` |
| 担当者確認 | `staff-test@...` |
| 税理士確認 | `tax-test@...` |

### profiles登録SQL

Authで作成したユーザーIDを確認してから実行する。

```sql
insert into public.profiles (id, display_name, role, is_active)
values
  ('AUTH_USER_ID_ADMIN', '管理者', 'admin', true),
  ('AUTH_USER_ID_STAFF_1', 'スタッフ1', 'staff', true),
  ('AUTH_USER_ID_STAFF_2', 'スタッフ2', 'staff', true),
  ('AUTH_USER_ID_TAX', '税理士閲覧', 'tax_accountant', true)
on conflict (id) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  is_active = excluded.is_active;
```

## テストシナリオ

### 1. admin

1. ログインする
2. 仕入を1件登録する
3. 証憑画像を複数枚添付する
4. 登録後、一覧に表示されることを確認する
5. 詳細/証憑表示で複数画像を切り替える
6. 仕入内容を編集する
7. 証憑画像を追加する
8. 保存済み証憑を1枚外す
9. 月次税理士提出ZIPを作成する
10. 保存履歴に表示されることを確認する
11. 保存履歴からZIPを再ダウンロードする
12. 保存履歴からZIPを削除する
13. 仕入を削除し、一覧から消えることを確認する

### 2. staff

1. ログインする
2. 仕入を1件登録する
3. 証憑画像を追加する
4. 既存仕入を編集する
5. 削除ボタンが表示されないことを確認する
6. 保存済み証憑を外せないことを確認する
7. 月次税理士提出ZIPを作成する
8. 保存履歴からZIPを再ダウンロードする
9. 保存履歴の削除ボタンが表示されないことを確認する

### 3. tax_accountant

1. ログインする
2. 仕入一覧を閲覧する
3. 登録フォームが表示されないことを確認する
4. 編集ボタン、削除ボタンが表示されないことを確認する
5. CSV / Excel / PDFを出力する
6. 月次税理士提出ZIPの新規作成ボタンが無効であることを確認する
7. 保存履歴からZIPを再ダウンロードする
8. 保存履歴の削除ボタンが表示されないことを確認する

### 4. AI抽出

1. Cloudflare Pagesの環境変数に `ANTHROPIC_API_KEY` を設定する
2. 必要なら `SHARED_SECRET` を設定し、アプリ設定の合言葉と合わせる
3. AI接続URLが `/extract` になっていることを確認する
4. `https://shiire-refund-manager.pages.dev/extract` を開き、`anthropicConfigured: true` になることを確認する
5. 証憑画像または明細テキストを読み取る
6. 抽出候補を確認し、登録する
7. 金額、日付、商品名、税率の読み取り結果を目視確認する

## Supabase確認SQL

```sql
select count(*) as purchases_count
from public.purchases
where deleted_at is null;

select purchase_id, count(*) as evidence_count
from public.purchase_evidence
group by purchase_id
order by evidence_count desc;

select target_month, file_name, purchase_count, generated_at
from public.monthly_packages
order by generated_at desc;

select bucket_id, name, created_at
from storage.objects
where bucket_id in ('evidence', 'tax-packages')
order by created_at desc
limit 30;
```

## 合格条件

- adminで仕入登録、編集、削除、証憑追加、月次ZIP作成が完了する
- staff / tax_accountant を使う場合は、権限差が画面とRLSの両方で成立する
- 仕入登録、編集、証憑追加、月次ZIP作成が実務データで完了する
- tax_accountant を使う場合は、税理士閲覧用ユーザーが保存済みZIPを取得できる
- 管理者だけが保存済みZIPを削除できる
- AI抽出がCloudflare `/extract` 経由で動作する
- 重大なレイアウト崩れやクリック不能箇所がない
