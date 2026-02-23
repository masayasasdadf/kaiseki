# Kaiseki Analytics

> 「広告流入 → LP行動 → CV」を最短で意思決定できる**計測 OS**

[![Next.js](https://img.shields.io/badge/Next.js-14+-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748)](https://prisma.io)

---

## ✨ 特徴

| | |
|---|---|
| 🔥 **やさしいモード** | 右上トグル1つで専門用語 → 平易な日本語に即時切替 |
| ⚡ **1スニペット設置** | `<script>` 1行でPV・スクロール・クリックを自動計測 |
| 🎯 **ノーコード CV** | URL・クリック・フォームの3種をウィザードで設定 |
| 📡 **Live Events** | SSE でリアルタイム計測確認 |
| 🗂 **マルチプロジェクト** | 複数サイトを1アカウントで管理 |
| 🔒 **セキュア設計** | Rate limit・PII除外・監査ログ |

---

## 🚀 クイックスタート

### 1. インストール

```bash
git clone https://github.com/your-org/kaiseki.git
cd kaiseki
npm install
```

### 2. 環境変数

```bash
cp .env.example .env.local
# DATABASE_URL と NEXTAUTH_SECRET を設定
```

### 3. DB セットアップ

```bash
npx prisma db push
```

### 4. 起動

```bash
npm run dev
```

→ http://localhost:3000 を開きアカウント登録

### 5. SDK 設置

管理画面でプロジェクト作成後、スニペットをサイトに貼り付け：

```html
<script src="https://your-domain.com/sdk.js" data-project="YOUR_PROJECT_KEY"></script>
```

数分後にダッシュボードへ反映されます。

---

## 📁 構成

```
kaiseki/
├── app/
│   ├── (auth)/               # ログイン・新規登録
│   ├── (dashboard)/[projectId]/
│   │   ├── overview/         # KPI ダッシュボード
│   │   ├── acquisition/      # 流入分析
│   │   ├── behavior/         # コンテンツ分析
│   │   ├── conversions/      # CV設定・実績
│   │   ├── live/             # リアルタイムイベント
│   │   └── settings/         # プロジェクト設定
│   └── api/
│       ├── ingest/           # 計測受信 API
│       ├── live/             # SSE
│       └── projects/         # プロジェクト CRUD
├── components/
│   ├── dashboard/            # 各画面コンポーネント
│   └── easy-mode/            # やさしいモード関連
├── lib/
│   ├── terminology.ts        # 🔑 用語辞書（中央管理）
│   ├── attribution.ts        # チャネル分類
│   ├── metrics.ts            # 指標定義・計算
│   └── utils.ts              # 共通ユーティリティ
├── prisma/schema.prisma      # データモデル
├── public/sdk.js             # ブラウザ計測 SDK
└── docs/                     # ドキュメント一式
```

---

## 🔥 やさしいモード

右上トグルで**全画面**が即時切替（リロード不要）：

| 通常モード | やさしいモード |
|-----------|--------------|
| Sessions | 訪問数 |
| CVR | 成果率 |
| Bounce Rate | すぐ離脱した割合 |
| Engagement Rate | よく読まれた割合 |
| Channel | 流入元 |
| Landing Page | 最初に見られたページ |

- ユーザー単位で DB 保存
- ツールチップも連動切替
- 空状態メッセージも連動
- CV設定ウィザードの表示もやさしい説明に

詳細: [docs/terminology.md](docs/terminology.md)

---

## 📡 SDK リファレンス

### 自動計測

| イベント | タイミング |
|---------|----------|
| `session_start` | 新規セッション開始時 |
| `page_view` | ページ表示（SPA対応） |
| `engagement_ping` | 10秒ごと |
| `scroll_depth` | 離脱時（最大スクロール%） |
| `cta_click` | `data-track` 要素クリック時 |

### CTA クリック計測

```html
<button data-track="contact_cta">お問い合わせ</button>
```

### 手動送信

```javascript
window.kaiseki.track('video_play', { videoId: 'intro' });
window.kaiseki.conversion('purchase', { plan: 'pro' });
window.kaiseki.debug(); // デバッグ情報
```

詳細: [docs/install-sdk.md](docs/install-sdk.md)

---

## 📐 指標定義

| 指標 | 定義 |
|-----|------|
| **Engaged** | 滞在10秒以上 OR スクロール25%以上 OR data-trackクリック |
| **Bounce** | PV=1 かつ Engaged=false |
| **CVR** | CV数 ÷ セッション数 × 100 |

詳細: [docs/metrics.md](docs/metrics.md)

---

## 🗺 チャネル分類（Last Non-Direct Click）

| チャネル | 判定条件 |
|---------|---------|
| Paid Search | gclid / utm_medium=cpc |
| Paid Social | fbclid / utm_medium=paid_social |
| Organic Search | referrerが検索エンジン |
| Organic Social | referrerがSNS |
| Email | utm_medium=email |
| Referral | その他referrerあり |
| Direct | referrerなし |

詳細: [docs/attribution.md](docs/attribution.md)

---

## 📚 ドキュメント

| ファイル | 内容 |
|---------|------|
| [docs/setup.md](docs/setup.md) | ローカル環境セットアップ |
| [docs/deploy-vercel.md](docs/deploy-vercel.md) | Vercelデプロイ |
| [docs/install-sdk.md](docs/install-sdk.md) | SDK設置ガイド |
| [docs/conversions.md](docs/conversions.md) | CV設定ガイド |
| [docs/metrics.md](docs/metrics.md) | 指標定義 |
| [docs/attribution.md](docs/attribution.md) | チャネル帰属モデル |
| [docs/terminology.md](docs/terminology.md) | 用語辞書 |
| [docs/troubleshooting.md](docs/troubleshooting.md) | トラブルシューティング |

---

## 🔒 セキュリティ

- Rate limiting: IP単位、100req/分
- CORS: プロジェクト単位の許可ドメイン
- PII除外: email/password等のキーを自動除去
- 監査ログ: CV設定の変更を全記録
- 社内IP除外: サイレント除外対応

---

## 📄 ライセンス

MIT
