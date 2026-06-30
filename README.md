# 仕入れ還付管理

中古品リユース事業者向けの仕入管理・控除見える化アプリです。仕入明細、証憑画像、控除区分、控除対象仕入税額をブラウザ上で管理し、CSV / Excel / PDF 印刷向けに出力できます。

> 最終的な税務判断・申告処理は税理士に確認してください。

## 説明書

利用者向けの操作手順は [USER_GUIDE.md](USER_GUIDE.md) を確認してください。

## 現在の実装状況

### 完了済み機能

- 仕入登録・編集・削除
- IndexedDB によるブラウザ内保存
- 証憑画像の保存、サムネイル表示、拡大表示、ダウンロード
- 古物商特例、準古物、インボイス、経過措置の控除区分判定
- 控除対象仕入税額の自動計算
- 月別タブ、担当・チャネル・支店・控除区分・キーワードでの絞り込み
- 日付、金額、控除税額での一覧ソート
- 件数、仕入総額、控除対象税額、古物商特例分の集計
- 仕入一覧 CSV、古物商特例帳簿 CSV、電帳法索引簿 CSV の出力
- Excel 出力
- PDF 印刷用レポート出力
- 証憑画像の ZIP 一括保存
- CSV テンプレート出力、CSV インポート
- CSV インポート時の証憑画像紐づけ
- JSON バックアップ出力・復元
- AI 抽出レビュー画面
- 支店・担当・チャネル・品目のマスタ編集
- Netlify Functions 経由の Anthropic API 中継
- Netlify Blobs を使ったクラウド同期 API
- 更新日時と削除マーカーを使った基本的な同期整合性管理
- 保存前の入力チェックと注意表示
- 分類ロジック、CSV 処理、Netlify Functions の自動テスト

### 未実装機能

- 複数端末で同じ明細を同時編集した場合の詳細な競合解決 UI
- E2E テストまたはブラウザ操作テスト
- Excel 出力ライブラリのローカル同梱化
- PDF 帳票レイアウトの固定化

### バグ・改善点

- 同期は基本的な更新日時・削除マーカーに対応したが、同時編集時の差分表示や手動選択は未実装
- 証憑 ZIP は無圧縮形式のため、画像点数が多い場合はファイルサイズが大きくなる
- 外部 CDN の Excel ライブラリが読み込めない環境では Excel 出力が使えない
- PDF はブラウザ印刷に依存しており、帳票レイアウトの固定度は高くない
- Netlify Functions の秘密キー未設定時は認証なしで動くため、本番運用では環境変数設定が必須

## 次に実装すべき内容

1. 同時編集時の競合解決 UI を追加する
2. Excel 出力ライブラリをローカル同梱化する
3. PDF 帳票レイアウトを固定化する
4. ブラウザでの主要操作テストを追加する

## セットアップ

Node.js が必要です。

```bash
npm install
```

## 開発用チェック

```bash
npm run check
npm test
```

## ローカルで開く

静的ファイルとして `index.html` をブラウザで開くと、基本機能を確認できます。

AI 抽出やクラウド同期も確認する場合は、Netlify Functions が動く環境で開いてください。

## Netlify デプロイ

このリポジトリは Netlify にそのままデプロイできます。静的な `index.html` を公開し、AI 抽出とクラウド同期は Netlify Functions で動かします。

### デプロイ構成

- 公開ディレクトリ: `.`
- ビルドコマンド: `npm run build`
- Functions ディレクトリ: `netlify/functions`
- Node.js: `20`
- Functions bundler: `esbuild`
- Blobs ストア名: `shiire`

`npm run build` は構文チェックとテストを実行します。失敗した場合は Netlify のデプロイも止まります。

### Functions

- `/.netlify/functions/extract`
  - Anthropic API への中継 Function です。
  - ブラウザに API キーを持たせず、サーバー側の `ANTHROPIC_API_KEY` を使います。
  - `SHARED_SECRET` または `SYNC_SECRET` が設定されている場合、`X-App-Secret` ヘッダーで認証します。
- `/.netlify/functions/sync`
  - Netlify Blobs を使った同期 Function です。
  - `list` / `get` / `set` / `del` 操作に対応しています。
  - `SYNC_SECRET` または `SHARED_SECRET` が設定されている場合、`X-App-Secret` ヘッダーで認証します。

### Blobs

同期データは Netlify Blobs の `shiire` ストアに保存されます。

保存キーの種類:

- `rec/{id}`: 仕入明細
- `img/{id}`: 証憑画像データ
- `del/{id}`: 削除マーカー
- `meta`: 支店・担当・チャネル・品目マスタ

追加のデータベース作成は不要です。Netlify 上で Function が動くと、`@netlify/blobs` 経由でストアを利用します。

### 環境変数

Netlify の Site configuration から、必要に応じて次を設定してください。

- `ANTHROPIC_API_KEY`: AI 抽出で使う Anthropic API キー
- `SHARED_SECRET`: AI 抽出と同期で共通利用できる共有シークレット
- `SYNC_SECRET`: 同期専用の共有シークレット。未設定なら `SHARED_SECRET` を使います
- `ALLOWED_ORIGIN`: 許可する画面の Origin。例: `https://your-site-name.netlify.app`

本番運用では `SHARED_SECRET` または `SYNC_SECRET` を必ず設定してください。未設定の場合、Functions は認証なしで呼び出せます。

### デプロイ手順

1. GitHub にこのリポジトリを push します。
2. Netlify で `Add new site` → `Import an existing project` を選びます。
3. GitHub リポジトリ `W-grant/shiire-refund-manager` を選びます。
4. Build settings は `netlify.toml` の内容を使います。
5. Environment variables に必要な値を設定します。
6. Deploy を実行します。
7. デプロイ完了後、発行された URL を開いて画面が表示されることを確認します。
8. アプリの設定画面で AI 中継 URL、同期 URL、合言葉を設定します。

アプリ側の設定画面では、必要に応じて次を設定します。

- AI 中継 URL: `/.netlify/functions/extract`
- 同期 URL: `/.netlify/functions/sync`
- 合言葉: Netlify 側の `SHARED_SECRET` または `SYNC_SECRET` と同じ値

### デプロイ後の確認

- 仕入明細を1件保存できること
- 証憑画像を添付して保存できること
- 同期を使う場合、設定画面で同期を `クラウド` にして更新ボタンを押し、エラーが出ないこと
- AI 抽出を使う場合、AI 接続を `中継` にして画像またはテキストを読み取れること
- Netlify の Function logs に `missing_anthropic_api_key` や `unauthorized` が出る場合は環境変数と合言葉を見直すこと

## 主なファイル

- `index.html`: 画面、IndexedDB 保存、集計、入出力、AI 抽出 UI
- `src/classify.js`: 控除区分と控除税額の判定ロジック
- `src/csv.js`: CSV の読み書き
- `netlify/functions/extract.js`: Anthropic API 中継
- `netlify/functions/sync.js`: Netlify Blobs 同期 API
- `test/*.test.js`: 自動テスト
