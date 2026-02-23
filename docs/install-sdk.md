# SDK 設置ガイド

## 基本設置

管理画面の「設定」に表示されるスニペットを、サイトの `</body>` タグ直前に貼り付けます。

```html
<script src="https://your-domain.com/sdk.js" data-project="YOUR_PROJECT_KEY"></script>
```

これだけで以下が自動計測されます：

- ページビュー（SPA対応）
- セッション（30分タイムアウト）
- スクロール深度（ページ離脱時に最大値を送信）
- エンゲージメント（10秒ごとのping）

---

## 自動計測されるもの

### visitor_id（訪問者識別）

- Cookie + localStorage に保存（365日）
- ブラウザをまたいでの追跡は行わない
- プライバシー配慮設計

### session_id（セッション識別）

- sessionStorage に保存
- 30分操作がない場合、新セッションを開始
- **流入情報はセッション開始時に固定**（ページ遷移で上書きされない）

### 取得する流入情報

| パラメータ | 内容 |
|-----------|------|
| `utm_source` | 流入元 |
| `utm_medium` | メディア種別 |
| `utm_campaign` | キャンペーン名 |
| `utm_content` | クリエイティブ |
| `utm_term` | 検索キーワード |
| `gclid` | Google広告クリックID |
| `fbclid` | Meta広告クリックID |
| `referrer` | 参照元URL |

---

## CTA クリック計測

`data-track` 属性を付けた要素のクリックが自動計測されます：

```html
<!-- 基本 -->
<button data-track="cta_contact">お問い合わせ</button>

<!-- 追加属性も渡せる -->
<a href="/plan" data-track="cta_plan" data-track-section="pricing">
  プランを見る
</a>

<!-- data-track-* はすべてプロパティとして記録される -->
<button
  data-track="cta_download"
  data-track-file="whitepaper"
  data-track-page="top"
>
  資料ダウンロード
</button>
```

---

## 手動イベント送信

```javascript
// カスタムイベント
window.kaiseki.track('video_play', {
  videoId: 'product-intro',
  duration: 120
});

// コンバージョン（手動）
window.kaiseki.conversion('purchase_complete', {
  plan: 'pro',
  // PIIは自動除去されますが、値を含めないことを推奨
});

// デバッグ情報
console.log(window.kaiseki.debug());
// {
//   projectKey: "xxx",
//   visitorId: "uuid",
//   sessionId: "uuid",
//   maxScroll: 45,
//   attribution: { utmSource: "google", ... }
// }
```

---

## SPA（シングルページアプリ）対応

React / Vue / Next.js などの SPA でも自動対応しています。

`history.pushState` / `history.replaceState` / `popstate` をフックして
ページ遷移を検出し、自動で `page_view` イベントを送信します。

追加設定は不要です。

---

## PII（個人情報）の自動除去

以下のキー名を含むプロパティは自動的に除去されます：

- `email`
- `password`
- `phone`
- `credit` (card情報)
- `ssn`

URL のクエリパラメータも同様に除去されます。

---

## セキュリティ

### HMAC 署名（任意・上級者向け）

サーバーサイドで送信する場合は HMAC-SHA256 署名を付与できます：

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', process.env.KAISEKI_SECRET_KEY)
  .update(JSON.stringify(payload))
  .digest('hex');
```

### 送信方式

1. `navigator.sendBeacon`（優先・ページ離脱時も確実）
2. `fetch` with `keepalive`（フォールバック）
3. 失敗時は最大3回リトライ（指数バックオフ）

---

## WordPress / Shopify 等への設置

### WordPress

`functions.php` に追加：

```php
function kaiseki_tracking() {
    echo '<script src="https://your-domain.com/sdk.js" data-project="YOUR_KEY"></script>';
}
add_action('wp_footer', 'kaiseki_tracking');
```

### Shopify

テーマの `theme.liquid` の `</body>` 直前に追加：

```html
<script src="https://your-domain.com/sdk.js" data-project="YOUR_KEY"></script>
```

### Google Tag Manager

カスタム HTML タグとして追加し、All Pages トリガーを設定：

```html
<script src="https://your-domain.com/sdk.js" data-project="YOUR_KEY"></script>
```

---

## 動作確認

```javascript
// ブラウザコンソールで実行
window.kaiseki.debug()

// ネットワークタブで確認
// Filter: /api/ingest
// Method: POST
// Status: 200
```
