# ローカル開発環境セットアップ

## 前提条件

- Node.js 18.17 以上
- npm 9 以上
- PostgreSQL 14 以上（または Neon / Supabase などのマネージドサービス）

## 手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/your-org/kaiseki.git
cd kaiseki
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

```bash
cp .env.example .env.local
```

`.env.local` を編集：

```env
# PostgreSQL 接続文字列
DATABASE_URL="postgresql://user:password@localhost:5432/kaiseki"

# 32文字以上のランダム文字列
# 生成: openssl rand -base64 32
NEXTAUTH_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# 開発環境URL
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. データベースのセットアップ

```bash
# テーブル作成
npm run db:push

# Prisma Studio でデータ確認（任意）
npm run db:studio
```

### 5. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 にアクセス。

### 6. 初回登録

1. `/register` でアカウント作成
2. プロジェクト作成
3. 設定画面でスニペットをコピー
4. テストページに設置して計測を確認

## 開発用コマンド

```bash
npm run dev          # 開発サーバー起動
npm run build        # ビルド（本番用）
npm run lint         # ESLint
npm run db:push      # DBスキーマ反映
npm run db:studio    # Prisma Studio
npm run db:generate  # Prismaクライアント再生成
```

## ローカルでSDKをテストする

1. `http://localhost:3000/sdk.js` にアクセスして JS が返ることを確認
2. 任意の HTML ファイルで `data-project` をプロジェクトキーに設定して設置
3. ブラウザコンソールで `window.kaiseki.debug()` を実行

## Google OAuth（任意）

```env
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"
```

Google Cloud Console で作成し、リダイレクト URI に
`http://localhost:3000/api/auth/callback/google` を追加。
