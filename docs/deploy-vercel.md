# Vercel へのデプロイ

## 前提条件

- [Vercel アカウント](https://vercel.com)
- PostgreSQL データベース（Vercel Postgres / Neon / Supabase 等）

## 手順

### 1. データベースの用意

#### Neon（推奨・無料枠あり）

1. https://neon.tech でプロジェクト作成
2. 接続文字列をコピー（`postgresql://...`）

#### Vercel Postgres

1. Vercel ダッシュボード → Storage → Create Database
2. Prisma 用の接続文字列をコピー

### 2. Vercel へのデプロイ

#### GitHub 連携（推奨）

1. GitHub にリポジトリをプッシュ
2. https://vercel.com/new でリポジトリをインポート
3. 環境変数を設定（下記参照）
4. Deploy

#### Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

### 3. 環境変数の設定

Vercel ダッシュボード → Project → Settings → Environment Variables で設定：

| 変数名 | 値 | 説明 |
|-------|---|------|
| `DATABASE_URL` | `postgresql://...` | DB接続文字列 |
| `NEXTAUTH_SECRET` | ランダム32文字以上 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://your-domain.vercel.app` | デプロイURL |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.vercel.app` | 公開URL |

### 4. データベースのマイグレーション

デプロイ後、ターミナルで：

```bash
# Vercel 環境の DATABASE_URL を使用
vercel env pull .env.production.local
DATABASE_URL="$(grep DATABASE_URL .env.production.local | cut -d= -f2-)" npx prisma db push
```

または `package.json` の `build` スクリプトに `prisma db push` を追加：

```json
"build": "prisma generate && prisma db push && next build"
```

### 5. カスタムドメイン（任意）

Vercel ダッシュボード → Project → Settings → Domains で設定。

設定後、`NEXTAUTH_URL` と `NEXT_PUBLIC_APP_URL` を更新して再デプロイ。

---

## SDK の CORS 設定

本番環境では、管理画面の「設定」→「許可ドメイン」に計測対象サイトのドメインを追加：

```
example.com
www.example.com
```

## 注意事項

### SSE（ライブイベント）

- Vercel **Hobby プラン**: Function のタイムアウトが 10 秒のため SSE が切断される
- **Pro プラン以上**: 300秒まで対応（Streaming Functions）
- 代替案: Hobby プランでは Live Events ページを5秒ごとにポーリングに切り替えることを推奨

### Edge Runtime

Ingest API は通常の Node.js Runtime を使用。Edge Runtime への移行は将来の対応予定。

## デプロイ後の確認

1. `https://your-domain.vercel.app` にアクセスしてログイン
2. SDK スニペットを取得し、テストサイトに設置
3. Live Events ページでリアルタイム確認
4. Overview でデータが反映されることを確認
