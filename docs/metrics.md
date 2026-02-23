# 指標定義

Kaisekiで使用する指標の定義。

## セッション (Session)

訪問者のサイトへの1回の訪問。
- 同一 visitor_id で30分以内のアクティビティを1セッションとする
- 30分を超えた場合は新しいセッションを開始

## ユーザー (User)

計測期間内のユニーク visitor_id 数。

## エンゲージド (Engaged)

以下のいずれかを満たすセッション:
- 滞在時間 **10秒以上**
- スクロール深度 **25%以上**
- `data-track` 属性を持つ要素のクリックが **1回以上**

## 直帰 (Bounce)

以下を**両方**満たすセッション:
- ページビュー数が **1**
- エンゲージド = **false**

## CVR (Conversion Rate)

```
CVR = コンバージョン数 / セッション数 × 100
```

## Bounce Rate

```
Bounce Rate = 直帰セッション数 / 総セッション数 × 100
```

## Engagement Rate

```
Engagement Rate = エンゲージドセッション数 / 総セッション数 × 100
```

## スクロール深度 (Scroll Depth)

ページの縦方向に何%まで到達したかの最大値（0〜100%）。
- `scroll_depth` イベントとして記録
- セッション離脱時または visibilitychange 時に送信
- セッション単位での最大値を保存

## 平均滞在時間 (Avg. Session Duration)

engagement_ping（10秒ごと）の合計から算出。
