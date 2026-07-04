# Supabase Storage 証憑画像設計書

## 目的

Phase4では、現在IndexedDBに保持している証憑画像をSupabase Storage `evidence` bucketへ保存し、画像メタデータを `purchase_evidence` テーブルへ保存する。

対象は仕入1件に紐づく複数証憑画像であり、明細画像、商品ページ画像、現物写真などをまとめて保持できる状態にする。Version1では、未ログイン時はSupabase Storageへ保存せず、IndexedDB保存を継続する。

## 1. 現在の画像保持構造

現在はブラウザ内IndexedDBの `images` storeに、仕入ID単位で画像bundleを保存している。

```js
{
  id: record.id,
  images: [
    {
      full: "data:image/jpeg;base64,...",
      thumb: "data:image/jpeg;base64,...",
      fileName: "receipt.jpg",
      label: "明細"
    }
  ]
}
```

主な利用箇所:

| 用途 | 現在のデータ |
| --- | --- |
| フォーム添付 | `state.proofDraft` |
| IndexedDB保存 | `STORE_IMAGES` |
| 一覧代表サムネイル | `getRecordImages(id)[0]` |
| 詳細表示 | `getRecordImages(id)` |
| 証憑ZIP | `getRecordImages(record.id)` |
| バックアップJSON | `images: [...state.images.values()]` |

現在の `fileToImageData()` はアップロード前に画像をJPEGへ変換している。

- `full`: 最大辺1600px、JPEG quality 0.72
- `thumb`: 最大辺160px、JPEG quality 0.72
- `fileName`: 元ファイル名

## 2. Storage保存先設計

Storage bucketは既存設計どおり `evidence` を使用する。

| 項目 | 内容 |
| --- | --- |
| bucket | `evidence` |
| public | `false` |
| 表示方法 | signed URL |
| 許可MIME | `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif` |
| 現在のbucket上限 | 50MB |
| DBメタデータ | `public.purchase_evidence` |

Version1ではStorageへ保存する画像本体は、現行の `full` 相当の圧縮済みJPEGを基本とする。`thumb` はDBやStorageへ別保存せず、signed URLをサムネイルにも利用する。必要になった段階で `thumb_path` 追加を検討する。

## 3. storage_path設計

Storage pathは月別・仕入ID別に整理する。

```text
purchases/{YYYY}/{MM}/{purchase_id}/{sort_order}_{label}_{safe_file_name}
```

例:

```text
purchases/2026/06/8f3d.../001_receipt_receipt.jpg
purchases/2026/06/8f3d.../002_item-page_item-page.jpg
purchases/2026/06/8f3d.../003_photo_photo.jpg
```

生成ルール:

| 部分 | ルール |
| --- | --- |
| `YYYY/MM` | `purchase.purchase_date` から作成 |
| `purchase_id` | `purchases.id` |
| `sort_order` | 1始まりの3桁。DB保存時は0始まりでも可だが、pathは001始まり |
| `label` | 画面上の種別。未設定なら `evidence` |
| `safe_file_name` | 元ファイル名から `/ \ : * ? " < > |` などを `_` に置換 |
| 拡張子 | 実際に保存するMIMEに合わせる。現行圧縮後は `.jpg` |

同名回避:

- 同一purchase内で同じpathが発生した場合は `_2`, `_3` を付与する。
- `purchase_evidence.storage_path` はuniqueなので、DB insert前にも衝突回避する。
- Storage upload時も既存path確認または `upsert: false` を使い、衝突したら別名で再試行する。

## 4. 複数画像対応

1取引に複数画像を保存する場合、Storage objectと `purchase_evidence` は画像1枚につき1件作成する。

```text
purchases 1件
  └─ purchase_evidence N件
       └─ storage.objects N件
```

`purchase_evidence.sort_order` で表示順を保持する。

代表サムネイル:

- `sort_order` が最小の画像を代表画像とする。
- 読み取り時は `purchase_evidence.order("sort_order")` で取得し、既存の `images[0]` と同じ扱いにする。

## 5. upload順序

新規仕入保存時の推奨順序:

1. 認証状態を確認する。
2. `admin` / `staff` でなければStorage保存せず、IndexedDB保存のみ継続する。
3. `purchases` をinsertする。
4. 画像bundleがある場合、各画像をBlobへ変換する。
5. Storage `evidence` へ1枚ずつuploadする。
6. upload成功した画像だけ `purchase_evidence` insert対象にする。
7. `purchase_evidence` をinsertする。
8. IndexedDBへも保存する。
9. `loadAll()` でSupabaseから再取得する。

Version1では、画像uploadはpurchase本体insert成功後に行う。DBトランザクションとStorage uploadを完全な1トランザクションにできないため、失敗時の補償処理を明示する。

## 6. purchase_evidence insert順序

画像1枚ごとに以下を保存する。

| purchase_evidence | 保存内容 |
| --- | --- |
| `purchase_id` | `purchases.id` |
| `storage_bucket` | `evidence` |
| `storage_path` | upload成功したpath |
| `file_name` | 元ファイル名または生成名 |
| `label` | `明細`, `商品ページ`, `現物写真` など。未設定可 |
| `mime_type` | uploadしたBlobのMIME |
| `file_size` | Blob size |
| `sort_order` | 表示順 |
| `uploaded_by` | `auth.uid()` |

insert順序:

1. Storage upload成功
2. `purchase_evidence` insert

理由:

- DBに存在するのにStorage本体が無い状態を避ける。
- 逆に、Storageだけ残った場合は後述のcleanup対象として扱える。

## 7. upload失敗時の扱い

画像uploadが一部失敗した場合:

- 成功した画像は `purchase_evidence` へ保存する。
- 失敗した画像はConsoleと画面ステータスに表示する。
- IndexedDBには従来どおり全画像を保存し、再試行できる状態にする。
- Version1では自動再試行キューは作らない。

全画像upload失敗時:

- `purchases` 本体は保存済みとして扱う。
- `purchase_evidence` は0件。
- IndexedDBには画像を残す。
- 画面には「仕入本体は保存済み、証憑画像はローカル保存のみ」と表示する。

Consoleログ案:

```text
[Storage] Upload start
[Storage] Upload success
[Storage] Upload failed
[Storage] Evidence metadata insert success
[Storage] Evidence metadata insert failed
```

## 8. purchase本体保存済み・画像失敗時の扱い

purchase本体insert後に画像保存が失敗した場合、purchase本体はrollbackしない。

理由:

- Supabase DatabaseとStorageをまたぐ完全なatomic transactionは扱いづらい。
- 実務上は「仕入本体を失わない」ことを優先する。
- 画像はIndexedDB退避から再アップロードできる設計にする。

画面表示:

- purchase本体保存成功、画像一部失敗: 警告表示
- purchase本体保存成功、画像全失敗: 警告表示
- IndexedDB保存成功: 成功扱い

将来の再送設計:

- `localOnlyImages` のようなフラグを画面側に持つ。
- Supabase未保存画像を検出して再アップロードする手動ボタンを追加する。

## 9. 更新時の画像差分処理

Phase4初期では更新処理は実装しない。設計としては以下を採用する。

差分判定:

| 操作 | 判定 |
| --- | --- |
| 追加 | 既存 `purchase_evidence.storage_path` に無い画像 |
| 削除 | 画面から削除され、DB側に存在する画像 |
| 並び替え | `sort_order` の変更 |
| ラベル変更 | `label` の変更 |

更新時の推奨処理:

1. `purchase_evidence` 一覧を取得する。
2. 既存画像とフォーム画像を比較する。
3. 追加分をStorage uploadし、`purchase_evidence` insert。
4. 削除分はPhase4初期では論理的に非表示にする列が無いため、adminのみStorage delete + DB deleteを行うか、削除機能は後回しにする。
5. 並び順・ラベルは `purchase_evidence` update。

懸念:

- 現在の `purchase_evidence` には `deleted_at` が無い。
- staffにもStorage updateは許可されているがdeleteはadminのみ。
- 実務上の証憑削除は監査観点があるため、物理削除より論理削除列追加を検討する。

## 10. 削除時の扱い

Phase4初期では削除処理は追加しない。

将来方針:

- purchase削除は `purchases.deleted_at` による論理削除を基本にする。
- `purchase_evidence` は残す。
- Storage objectも残す。
- adminのみ、明示的な完全削除操作でStorage objectと `purchase_evidence` を削除する。

理由:

- 証憑画像は税務・監査上、誤削除を避ける必要がある。
- `purchase_evidence.purchase_id` は `on delete cascade` だが、アプリでは物理削除を通常操作にしない。

## 11. Storage RLS / Policy

現在の設計では以下の権限になっている。

### purchase_evidence

| Policy | 対象 | 内容 |
| --- | --- | --- |
| `purchase_evidence_select` | admin / staff / tax_accountant | select可 |
| `purchase_evidence_insert_staff_admin` | admin / staff | insert可 |
| `purchase_evidence_update_staff_admin` | admin / staff | update可 |
| `purchase_evidence_delete_admin` | admin | delete可 |

### storage.objects evidence

| Policy | 対象 | 内容 |
| --- | --- | --- |
| `storage_evidence_select` | admin / staff / tax_accountant | signed URL作成・閲覧可 |
| `storage_evidence_insert` | admin / staff | upload可 |
| `storage_evidence_update` | admin / staff | update可 |
| `storage_evidence_delete` | admin | delete可 |

Version1方針:

- anonにはStorage select/insert/update/deleteを許可しない。
- 未ログイン時はStorage保存しない。
- tax_accountantは閲覧のみ。
- staffはupload/update可、delete不可。
- adminは完全管理可。

## 12. 最大容量・画像圧縮方針

現在のbucket上限は1ファイル50MB。

Version1では、ブラウザ側で以下に圧縮してからStorageへuploadする。

| 画像 | 方針 |
| --- | --- |
| 通常証憑 | 最大辺1600px、JPEG quality 0.72 |
| サムネイル | Storageへは保存せず、表示時はsigned URLを利用 |
| HEIC/HEIF | ブラウザで読めない場合はエラー表示。初期実装では変換保証しない |
| PNG/WebP | Canvas経由でJPEG化して保存 |

推奨制限:

- 1画像あたり圧縮後5MB以下を目標にする。
- 1取引あたり10枚程度までを目安にする。
- UI上は将来、枚数・サイズ警告を追加する。

懸念:

- Canvas変換でEXIFや透過情報は失われる。
- 元画像を完全保管する要件が出る場合は、原本pathと圧縮pathを分ける必要がある。

## 13. 実装ステップ

### Step 1: Storage repository追加

- data URLをBlobへ変換する helper を作る。
- storage path生成 helper を作る。
- `uploadEvidenceImage()` を作る。
- `insertPurchaseEvidence()` を作る。

### Step 2: 新規保存時の画像upload

- `savePurchase()` 成功後に画像uploadを呼ぶ。
- upload成功分のみ `purchase_evidence` insert。
- 失敗分はIndexedDBに残す。
- 未ログイン時はStorage処理を呼ばない。

### Step 3: 読み取り表示確認

- 既存 `fetchPurchaseEvidence()` と `attachEvidenceUrls()` を使い、Storage保存済み画像が一覧・詳細・ZIPで見えることを確認する。
- signed URL切れ時は再読込で再生成されることを確認する。

### Step 4: エラー表示

- 画像upload失敗時の画面ステータスを追加。
- Consoleに `message`, `code`, `details`, `hint` 相当を出す。

### Step 5: 更新時の差分処理

- 追加画像のみupload。
- 並び順・ラベル更新。
- 削除はadmin完全削除または論理削除列追加を検討後に実装。

### Step 6: IndexedDB移行

- IndexedDB `images` からStorageへアップロードする移行導線を追加。
- 既に `purchase_evidence` がある画像は重複uploadしない。
- 失敗した画像は再試行可能にする。

## 実装推奨順

1. Storage repositoryとpath生成を追加する。
2. 新規仕入保存時だけ画像uploadを追加する。
3. upload成功分だけ `purchase_evidence` insertする。
4. 読み取り表示、証憑ZIP、バックアップJSONの既存動作を確認する。
5. 画像upload失敗時の警告表示を整える。
6. 更新・削除・移行は別Phaseで実装する。

## 主な懸念点

- purchase本体保存とStorage uploadは完全なatomic transactionにできない。
- 画像upload失敗時にStorageだけ残る可能性があるため、cleanup方針が必要。
- `purchase_evidence` に `deleted_at` が無いため、証憑削除を論理削除にできない。
- signed URLは期限切れになるため、表示時に都度生成する必要がある。
- 原本保存が必要になる場合、現在のCanvas圧縮JPEG保存だけでは要件不足になる可能性がある。
- 未ログイン時はIndexedDB保存のみなので、後からSupabaseへ画像を移行する導線が必要。
