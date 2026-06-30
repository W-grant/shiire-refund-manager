# 仕入れ還付管理

中古品リユース事業者向けの仕入管理・控除見える化アプリです。仕入明細、証憑画像、控除区分、控除対象仕入税額をブラウザ上で管理し、CSV / Excel / PDF 印刷向けに出力できます。

> 最終的な税務判断・申告処理は税理士に確認してください。

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
- 証憑画像の一括保存
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
- 証憑画像を ZIP など単一ファイルにまとめる一括エクスポート
- E2E テストまたはブラウザ操作テスト
- Excel 出力ライブラリのローカル同梱化
- PDF 帳票レイアウトの固定化

### バグ・改善点

- 同期は基本的な更新日時・削除マーカーに対応したが、同時編集時の差分表示や手動選択は未実装
- 証憑一括保存はブラウザの複数ダウンロード制限の影響を受ける場合がある
- 外部 CDN の Excel ライブラリが読み込めない環境では Excel 出力が使えない
- PDF はブラウザ印刷に依存しており、帳票レイアウトの固定度は高くない
- Netlify Functions の秘密キー未設定時は認証なしで動くため、本番運用では環境変数設定が必須

## 次に実装すべき内容

1. 同時編集時の競合解決 UI を追加する
2. 証憑画像を ZIP など単一ファイルで出力できるようにする
3. Excel 出力ライブラリをローカル同梱化する
4. PDF 帳票レイアウトを固定化する
5. ブラウザでの主要操作テストを追加する

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

## Netlify 設定

`netlify.toml` で Functions ディレクトリを `netlify/functions` に設定しています。

本番運用では、Netlify の環境変数に次を設定してください。

- `ANTHROPIC_API_KEY`: AI 抽出で使う Anthropic API キー
- `SHARED_SECRET` または `SYNC_SECRET`: アプリから Functions を呼ぶための共有シークレット
- `ALLOWED_ORIGIN`: 許可する画面の Origin

アプリ側の設定画面では、必要に応じて次を設定します。

- AI 中継 URL: `/.netlify/functions/extract`
- 同期 URL: `/.netlify/functions/sync`
- 合言葉: Netlify 側の `SHARED_SECRET` または `SYNC_SECRET` と同じ値

## 主なファイル

- `index.html`: 画面、IndexedDB 保存、集計、入出力、AI 抽出 UI
- `src/classify.js`: 控除区分と控除税額の判定ロジック
- `src/csv.js`: CSV の読み書き
- `netlify/functions/extract.js`: Anthropic API 中継
- `netlify/functions/sync.js`: Netlify Blobs 同期 API
- `test/*.test.js`: 自動テスト
