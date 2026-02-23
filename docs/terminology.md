# 用語辞書

Kaisekiの表示文言は `lib/terminology.ts` で中央管理。
ハードコード禁止。

## 用語マッピング

| 通常モード | やさしいモード | 説明 |
|-----------|--------------|------|
| Sessions | 訪問数 | サイトへの訪問回数 |
| Users | 訪問した人 | ユニーク訪問者数 |
| Conversions | 成果数 | CV達成数 |
| CVR | 成果率 | コンバージョン率 |
| Bounce Rate | すぐ離脱した割合 | 直帰率 |
| Engagement Rate | よく読まれた割合 | エンゲージメント率 |
| Channel | 流入元 | トラフィックソース |
| Campaign | 広告キャンペーン | UTMキャンペーン |
| Landing Page | 最初に見られたページ | ランディングページ |
| Scroll Depth | 読了率 | スクロール深度 |
| CTA Click | ボタン押下数 | CTAクリック数 |
| Funnel | 成果までの流れ | コンバージョンファネル |
| Page Views | ページ閲覧数 | ページビュー数 |
| Avg. Session Duration | 平均滞在時間 | 平均セッション時間 |
| New Visitors | 初めての人 | 新規訪問者 |
| Returning Visitors | リピーター | 再訪問者 |
| Direct | 直接アクセス | ダイレクト流入 |
| Organic Search | Google検索（無料） | 自然検索 |
| Paid Search | Google広告 | 有料検索広告 |
| Organic Social | SNS（投稿） | SNS自然流入 |
| Paid Social | SNS広告 | SNS広告流入 |
| Email | メール | メール流入 |
| Affiliate | アフィリエイト | アフィリエイト流入 |

## 使用方法

```tsx
import { Term } from "@/components/easy-mode/term";
import { useTerm } from "@/components/easy-mode/term";

// コンポーネントとして使用（ツールチップ付き）
<Term termKey="sessions" />

// ラベルのみ
const term = useTerm("cvr");
console.log(term.label); // "CVR" or "成果率"
console.log(term.description); // ツールチップ用説明
```

## CV設定タイプ表示名

| type | 通常 | やさしい |
|------|------|---------|
| url_match | URL一致 | このページが表示されたら成果 |
| click | クリックベース | このボタンが押されたら成果 |
| form_submit | フォーム送信 | フォームが送信されたら成果 |
