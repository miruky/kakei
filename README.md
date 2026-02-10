# kakei

[![CI](https://github.com/miruky/kakei/actions/workflows/ci.yml/badge.svg)](https://github.com/miruky/kakei/actions/workflows/ci.yml)
[![Deploy](https://github.com/miruky/kakei/actions/workflows/deploy.yml/badge.svg)](https://github.com/miruky/kakei/actions/workflows/deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Test](https://img.shields.io/badge/Test-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**データを端末から出さないローカルファーストの家計簿PWA。月次推移と支出の内訳をSVGグラフで眺める。**

## 概要

支出か収入か・日付・金額・カテゴリ・メモを1行で記録すると、月ごとの支出・収入・収支のカード、直近12か月の推移(支出と収入の並列棒グラフ)、その月の支出カテゴリ内訳(ドーナツ)が更新されます。月送りで過去の家計をさかのぼれ、記録はその場で編集・削除できます。

データはすべてlocalStorageに保存され、サーバーにもどこにも送られません。バックアップと引っ越しはJSONのエクスポート・インポートで行います。Service Workerがアプリ一式をキャッシュするため、一度開けば圏外でも記録できます。金額は整数の円で持ち、浮動小数の誤差が混ざらないようにしています。

試す: https://miruky.github.io/kakei/

### なぜ作ったのか

家計簿サービスは口座連携や広告つきの多機能が主流で、「手で付ける数件の記録を、誰にも送らずに集計してほしい」だけの用途には重すぎました。手入力の家計簿は続けるのが大変というのが通説ですが、続かない原因の多くは起動の遅さと入力項目の多さです。PWAとして即起動し、入力は1段のフォームだけ、という割り切りで作っています。

## 使い方

- 種別(支出・収入)を選び、日付・金額・カテゴリ・メモを入れて「記録する」。カテゴリは定番の候補と過去の入力から補完されます
- 「前月」「翌月」で表示する月を切り替えます。記録を追加するとその記録の月へ自動で移動します
- 一覧の「編集」でフォームに呼び出して直せます。「削除」は2回押しで確定です
- 「エクスポート」で全記録をJSONとして保存、「インポート」で取り込み(同じIDは読み飛ばし)
- ホーム画面に追加すればスタンドアロンのアプリとして開きます

口座連携・レシート読み取り・複数端末の自動同期はありません。同期はエクスポートしたJSONを移すことで行います。

## アーキテクチャ

![kakeiのアーキテクチャ](docs/architecture.svg)

`ledger.ts` が台帳(検証・保存・入出力)、`stats.ts` が月次集計とカテゴリ内訳、`chart.ts` がSVG文字列の生成を担い、互いに独立した純粋なモジュールです。UIの `app.ts` は「表示中の月」と「フォームが新規か編集か」だけを状態に持ちます。チャートの配色はCSSカスタムプロパティ参照なので、ライト・ダークの切り替えに追従します。`sw.js` はネットワーク優先・キャッシュフォールバックの素朴なService Workerです。

## 技術スタック

| カテゴリ   | 技術                              |
| :--------- | :-------------------------------- |
| 言語       | TypeScript 5(strict)              |
| チャート   | 自前のSVG生成                     |
| オフライン | Service Worker + Web App Manifest |
| ビルド     | Vite 6                            |
| テスト     | Vitest(32テスト)                  |
| リンタ     | ESLint + Prettier                 |
| CI / CD    | GitHub Actions                    |
| 配信       | GitHub Pages                      |

## プロジェクト構成

- `src/lib/ledger.ts` — 台帳。整数円での検証・CRUD・エクスポート/インポート
- `src/lib/stats.ts` — 月次集計・カテゴリ内訳・月キーの計算
- `src/lib/chart.ts` — 並列棒グラフとドーナツのSVG生成
- `src/app.ts` — フォーム・月送り・カード・一覧のUI
- `public/sw.js` — オフライン用Service Worker
- `public/manifest.webmanifest` — PWAマニフェスト
- `docs/architecture.svg` — アーキテクチャ図

## はじめ方

### 前提条件

- Node.js 20 以上

### セットアップ

```bash
git clone https://github.com/miruky/kakei.git
cd kakei
npm ci
npm run dev
```

### テストとlint

```bash
npm test
npm run lint
```

### ビルド

```bash
npm run build
```

GitHub Pagesへは `main` へのpushで自動デプロイされます。サブパス配信のため、ワークフローでは環境変数 `KAKEI_BASE=/kakei/` を渡してViteの `base` を切り替えています。

## 設計方針

- **ローカルファースト**: 家計は最も私的なデータなので、外部送信の経路を作りません。保存はlocalStorage、持ち出しは明示的なエクスポートだけです。
- **金額は整数の円**: 0.1+0.2問題を台帳に持ち込まないため、金額は常に整数で検証・保存します。表示の桁区切りは表示時に付けます。
- **入力の摩擦を最小に**: フォームは1段、カテゴリは補完、日付は今日が既定。記録すると当該月へ画面が追従し、付けた結果がすぐ見えます。
- **チャートも依存ゼロ**: グラフ描画ライブラリを使わず、値からSVG文字列を返す純粋関数で描きます。テーマ追従はCSS変数に任せ、生成ロジックは単体テストで固めています。

## ライセンス

[MIT](LICENSE)
