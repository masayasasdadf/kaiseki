# チャネル帰属モデル

## 帰属モデル

MVP: **Last Non-Direct Click**

最後にDirect以外のチャネル経由でアクセスしたセッションに帰属。
- 直近のセッションがDirectの場合、さらに前のセッションのチャネルを参照
- 初回がDirectの場合はDirectとする

## 取得する流入情報

| フィールド | 説明 |
|-----------|------|
| utm_source | 流入元（google, newsletter等） |
| utm_medium | メディア種別（cpc, email等） |
| utm_campaign | キャンペーン名 |
| utm_content | クリエイティブ識別 |
| utm_term | 検索キーワード |
| gclid | Google広告クリックID |
| wbraid | Google広告（iOSアプリ向け） |
| gbraid | Google広告（Webアプリ向け） |
| fbclid | Meta広告クリックID |
| referrer | 参照元URL |
| landing_url | ランディングURL（完全） |
| landing_path | ランディングパス |

**重要**: 流入情報はセッション開始時に一度だけ記録。ページ遷移で上書きされない。

## チャネルグループ分類ロジック

優先順位（上から評価）:

1. `gclid` / `wbraid` / `gbraid` が存在 → **Paid Search**
2. `fbclid` が存在 → **Paid Social**
3. `utm_medium` が `cpc`, `ppc`, `paidsearch` → **Paid Search**
4. `utm_medium` が `email`, `newsletter` → **Email**
5. `utm_medium` が `affiliate` → **Affiliate**
6. `utm_medium` が `social`, `paid_social` → **Paid Social**
7. `utm_source` が検索エンジン（google, bing等） → **Organic Search**
8. `utm_source` がSNS（facebook, twitter等） → **Organic Social**
9. UTMがある場合 → **Other**
10. referrer が検索エンジン → **Organic Search**
11. referrer がSNS → **Organic Social**
12. referrer がある → **Referral**
13. それ以外 → **Direct**

## チャネル一覧

| チャネル | 説明 |
|---------|------|
| Paid Search | Google広告・Yahoo検索広告等 |
| Paid Social | Meta広告・Twitter広告等 |
| Organic Search | 自然検索 |
| Organic Social | SNS投稿からの流入 |
| Referral | 外部サイトからのリンク |
| Email | メルマガ等 |
| Affiliate | アフィリエイト |
| Direct | 直接アクセス |
| Other | その他 |
