# 権限別動作チェックリスト

Version1実務テスト前に、Supabase Authの3権限で画面操作とRLSを確認する。

## 対象権限

| 権限 | 目的 |
| --- | --- |
| admin | 全操作、削除、設定、提出ZIP作成、提出ZIP履歴削除 |
| staff | 仕入登録、編集、証憑追加、提出ZIP作成 |
| tax_accountant | 閲覧、出力、保存済み提出ZIPの再ダウンロード |

## admin

- ログインできる
- 仕入一覧を表示できる
- 新規仕入を登録できる
- 既存仕入を編集できる
- 証憑画像を追加できる
- 保存済み証憑を一覧から外せる
- 仕入を削除できる
- 月次税理士提出ZIPを作成できる
- 作成したZIPがStorage `tax-packages` に保存される
- 保存履歴からZIPを再ダウンロードできる
- 保存履歴からZIPを削除できる
- 削除後、Storage `tax-packages` と `monthly_packages` 履歴から消える
- 設定ボタンが表示される

## staff

- ログインできる
- 仕入一覧を表示できる
- 新規仕入を登録できる
- 既存仕入を編集できる
- 証憑画像を追加できる
- 仕入削除ボタンが表示されない
- 保存済み証憑の削除はできない
- 保存済み証憑の削除ボタンが表示されない
- 月次税理士提出ZIPを作成できる
- 保存履歴からZIPを再ダウンロードできる
- 保存履歴の削除ボタンが表示されない
- 設定ボタンが表示されない

## tax_accountant

- ログインできる
- 仕入一覧を表示できる
- 登録フォームが表示されない
- 編集ボタンが表示されない
- 削除ボタンが表示されない
- 新規保存、更新、削除ができない
- 月次税理士提出ZIPの新規作成ボタンが無効
- 保存履歴からZIPを再ダウンロードできる
- 保存履歴の削除ボタンが表示されない
- CSV、Excel、PDFなど閲覧・出力系が利用できる
- 設定ボタンが表示されない

## 未ログイン

- ログイン画面のみ表示される
- 仕入一覧は表示されない
- 保存、更新、削除、証憑upload、提出ZIP作成はできない

## Supabase確認SQL

```sql
select id, display_name, role, is_active
from public.profiles
order by role, display_name;

select id, target_month, file_name, purchase_count, generated_at
from public.monthly_packages
order by generated_at desc
limit 20;

select bucket_id, name, created_at
from storage.objects
where bucket_id in ('evidence', 'tax-packages')
order by created_at desc
limit 20;

select id, purchase_date, name, deleted_at
from public.purchases
order by updated_at desc
limit 20;
```

## 合格条件

- 画面UIとRLSの両方で権限外操作が拒否される
- staffは通常登録・編集業務を完了できる
- tax_accountantは保存済み提出ZIPを取得できるが、新規データ作成はできない
- adminだけが保存済み提出ZIPと保存済み証憑を削除できる
- 未ログインでは業務画面へ進めない
