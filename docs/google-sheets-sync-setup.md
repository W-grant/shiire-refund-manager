# Google Sheets 連携セットアップ手順

## 目的

アプリから出力したCSVをGoogleスプレッドシートへ反映し、仕入管理・販売管理・簡易ダッシュボードをスプレッドシート側でも確認できるようにします。

## 現時点の方式

Version1では安全性と運用の分かりやすさを優先し、直接API連携ではなくCSV + Google Apps Script方式にします。

- アプリからCSVを書き出す
- CSVをGoogle Driveへアップロードする
- スプレッドシートのカスタムメニューから取り込む
- ダッシュボードを更新する

## アプリ側で使うボタン

CSV入出力の書き出し欄に以下を追加しています。

- `スプシ仕入CSV`
- `スプシ販売CSV`

## 仕入CSVの列

既存スプレッドシートの希望列に合わせ、以下を含めます。

- F列: 商品名
- G列: メーカー名
- J列: 仕入れ日
- K列: 仕入れ価格
- L列: 送料、手数料合計

追加で、アプリ連携用に以下も含めます。

- 利用先
- 支店
- 担当
- 証憑枚数
- アプリID

## 販売CSVの列

- アプリ販売ID
- アプリ仕入ID
- 商品名
- メーカー名
- 販売先
- 状態
- 仕入日
- 出品日
- 販売日
- 仕入原価
- 販売価格
- 費用合計
- 粗利
- 利益率
- 担当
- 管理番号
- SKU
- メモ

## Apps Script設定

1. 対象のGoogleスプレッドシートを開きます。
2. `拡張機能` → `Apps Script` を開きます。
3. `scripts/google-sheets-sync.gs` の内容を貼り付けます。
4. 保存します。
5. スプレッドシートを再読み込みします。
6. メニューに `仕入れ還付管理` が表示されます。

## 取り込み手順

1. アプリで `スプシ仕入CSV` または `スプシ販売CSV` を書き出します。
2. 書き出したCSVをGoogle Driveへアップロードします。
3. スプレッドシートで `仕入れ還付管理` → `仕入CSVを取り込み` または `販売CSVを取り込み` を実行します。
4. Drive上のCSVファイル名を入力します。
5. 必要に応じて `ダッシュボード更新` を実行します。

## 作成されるシート

- `仕入管理`
- `販売管理`
- `CATAWIKI`
- `EBAY`
- `ダッシュボード`
- `同期ログ`

存在しない場合は自動作成します。

`CATAWIKI` と `EBAY` は、アプリの `利用先` が対象サービス、または `共通` の仕入だけを抽出した管理ビューです。販売情報がまだない仕入は `未出品` として表示し、販売情報がある場合は管理番号、SKU、出品日、販売日、販売価格、粗利も併せて表示します。

`同期ログ` には、同期日時、結果、仕入件数、販売件数、エラー内容を追記します。

## 次の自動連携候補

CSV運用で列と運用が固まった後、以下へ進めます。

- Google Apps Script Web App化
- Cloudflare Pages Function `sheets-sync` 経由でGoogle SheetsへPOST
- Supabase Edge FunctionまたはCloudflare Workers経由でGoogle Sheets APIへ反映

Version1ではCSV + Apps Scriptで運用確認し、Version2以降で完全自動同期へ進めるのが安全です。

## ワンクリック送信の準備

アプリには `スプシへ送信` ボタンを追加しています。

このボタンを使う場合は、Cloudflare Pagesの環境変数に以下を設定します。

| 変数名 | 内容 |
| --- | --- |
| `GOOGLE_SHEETS_WEBAPP_URL` | Apps ScriptをWebアプリとしてデプロイしたURL |
| `SHEETS_SYNC_SECRET` | CloudflareからApps Scriptへ送る共有シークレット。Apps Script側のスクリプトプロパティ `SHEETS_SYNC_SECRET` と同じ値 |
| `SHEETS_SYNC_CLIENT_SECRET` | 任意。ブラウザからCloudflareへ直接API利用を制限したい場合のみ使うクライアント側シークレット |

Apps Script側はコードにシークレットを直接書かず、プロジェクト設定のスクリプトプロパティに `SHEETS_SYNC_SECRET` として同じ文字列を入れます。

通常の画面操作ではブラウザにシークレットを出さないため、`SHEETS_SYNC_CLIENT_SECRET` は設定しません。`SHEETS_SYNC_SECRET` はCloudflare Pages Function内部からApps Scriptへ送る用途に限定します。

### Apps Script シークレット設定手順

1. Apps Script画面で `プロジェクトの設定` を開きます。
2. `スクリプト プロパティ` に `SHEETS_SYNC_SECRET` を追加します。
3. 値にはCloudflare Pagesの `SHEETS_SYNC_SECRET` と同じ文字列を設定します。
4. シークレットを設定したら、Apps Scriptを新しいバージョンとして再デプロイします。

### Apps Script Web App公開手順

1. Apps Script画面で `デプロイ` → `新しいデプロイ` を選びます。
2. 種類は `ウェブアプリ` を選びます。
3. 実行ユーザーは `自分` を選びます。
4. アクセスできるユーザーは社内運用に合わせます。まずは動作確認用に `全員` または `リンクを知っている全員` を使い、`SHEETS_SYNC_SECRET` で保護します。
5. 発行されたWeb App URLをCloudflareの `GOOGLE_SHEETS_WEBAPP_URL` に設定します。
6. Cloudflare Pagesを再デプロイします。

### アプリ側の設定

通常は `スプシ送信URL` を `/sheets-sync` のまま使います。

直接Apps Script URLへ送るのではなく、Cloudflare Pages Functionを中継します。これにより、ブラウザ側にApps Script URLやシークレットを出しにくくできます。
