/**
 * Kaiseki Analytics - 用語辞書（中央管理）
 *
 * 全表示文言はこのファイルを参照する。ハードコード禁止。
 * i18n対応可能な構造として設計。
 *
 * 詳細: docs/terminology.md
 */

export type TermKey =
  | "sessions"
  | "users"
  | "conversions"
  | "cvr"
  | "bounceRate"
  | "engagementRate"
  | "channel"
  | "campaign"
  | "landingPage"
  | "scrollDepth"
  | "ctaClick"
  | "funnel"
  | "pageViews"
  | "avgDuration"
  | "newVisitors"
  | "returningVisitors"
  | "topPages"
  | "device"
  | "browser"
  | "country"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "utmContent"
  | "utmTerm"
  | "referrer"
  | "directTraffic"
  | "organicSearch"
  | "paidSearch"
  | "organicSocial"
  | "paidSocial"
  | "email"
  | "affiliate"
  | "other";

export interface TermEntry {
  label: string;
  description: string;
}

export interface TermDictionary {
  normal: Record<TermKey, TermEntry>;
  easy: Record<TermKey, TermEntry>;
}

export const TERMINOLOGY: TermDictionary = {
  normal: {
    sessions: {
      label: "Sessions",
      description: "訪問者がサイトに滞在した一連のセッション数",
    },
    users: {
      label: "Users",
      description: "計測期間中にサイトを訪問したユニークユーザー数",
    },
    conversions: {
      label: "Conversions",
      description: "設定したコンバージョン条件を達成した数",
    },
    cvr: {
      label: "CVR",
      description: "セッションに対するコンバージョン率",
    },
    bounceRate: {
      label: "Bounce Rate",
      description:
        "1ページのみ閲覧しエンゲージメントなしで離脱したセッションの割合",
    },
    engagementRate: {
      label: "Engagement Rate",
      description:
        "10秒以上の滞在・25%以上のスクロール・クリックのいずれかを満たしたセッションの割合",
    },
    channel: {
      label: "Channel",
      description: "トラフィックの流入チャネル（検索・SNS・広告等）",
    },
    campaign: {
      label: "Campaign",
      description: "UTMパラメータで識別する広告キャンペーン",
    },
    landingPage: {
      label: "Landing Page",
      description: "セッション開始時に最初に閲覧されたページ",
    },
    scrollDepth: {
      label: "Scroll Depth",
      description: "ページをどこまでスクロールしたかの最大割合",
    },
    ctaClick: {
      label: "CTA Click",
      description: "data-track属性を持つ要素のクリック数",
    },
    funnel: {
      label: "Funnel",
      description: "コンバージョンまでの各ステップの通過率",
    },
    pageViews: {
      label: "Page Views",
      description: "総ページ閲覧数",
    },
    avgDuration: {
      label: "Avg. Session Duration",
      description: "平均セッション継続時間（秒）",
    },
    newVisitors: {
      label: "New Visitors",
      description: "初回訪問のユーザー数",
    },
    returningVisitors: {
      label: "Returning Visitors",
      description: "2回以上訪問したユーザー数",
    },
    topPages: {
      label: "Top Pages",
      description: "閲覧数上位のページ一覧",
    },
    device: {
      label: "Device",
      description: "訪問者のデバイス種別（Desktop / Mobile / Tablet）",
    },
    browser: {
      label: "Browser",
      description: "訪問者のブラウザ",
    },
    country: {
      label: "Country",
      description: "訪問者の国",
    },
    utmSource: {
      label: "utm_source",
      description: "流入元を識別するUTMパラメータ",
    },
    utmMedium: {
      label: "utm_medium",
      description: "流入メディアを識別するUTMパラメータ",
    },
    utmCampaign: {
      label: "utm_campaign",
      description: "キャンペーン名を識別するUTMパラメータ",
    },
    utmContent: {
      label: "utm_content",
      description: "広告クリエイティブを識別するUTMパラメータ",
    },
    utmTerm: {
      label: "utm_term",
      description: "検索キーワードを識別するUTMパラメータ",
    },
    referrer: {
      label: "Referrer",
      description: "訪問前に閲覧していたページのURL",
    },
    directTraffic: {
      label: "Direct",
      description: "URLを直接入力またはブックマークからの流入",
    },
    organicSearch: {
      label: "Organic Search",
      description: "Google等の検索エンジンからの自然流入",
    },
    paidSearch: {
      label: "Paid Search",
      description: "Google広告等の検索連動型広告からの流入",
    },
    organicSocial: {
      label: "Organic Social",
      description: "SNSの投稿・プロフィール等からの自然流入",
    },
    paidSocial: {
      label: "Paid Social",
      description: "SNS広告からの流入",
    },
    email: {
      label: "Email",
      description: "メールマガジン等からの流入",
    },
    affiliate: {
      label: "Affiliate",
      description: "アフィリエイトサイトからの流入",
    },
    other: {
      label: "Other",
      description: "上記に分類されない流入",
    },
  },

  easy: {
    sessions: {
      label: "訪問数",
      description: "サイトに訪れた回数",
    },
    users: {
      label: "訪問した人",
      description: "この期間にサイトに来てくれた人の数（同じ人は1人として数えます）",
    },
    conversions: {
      label: "成果数",
      description: "「お問い合わせ」や「購入」など、設定した目標が達成された数",
    },
    cvr: {
      label: "成果率",
      description: "サイトを見た人のうち、どれくらいが成果につながったか",
    },
    bounceRate: {
      label: "すぐ離脱した割合",
      description: "1ページだけ見てすぐに帰ってしまった人の割合",
    },
    engagementRate: {
      label: "よく読まれた割合",
      description: "10秒以上見てくれた・半分以上スクロールした・何かクリックした人の割合",
    },
    channel: {
      label: "流入元",
      description: "お客さんがどこからやってきたか（Google検索・SNS・広告など）",
    },
    campaign: {
      label: "広告キャンペーン",
      description: "どの広告からお客さんが来たか",
    },
    landingPage: {
      label: "最初に見られたページ",
      description: "お客さんがサイトに来て最初に開いたページ",
    },
    scrollDepth: {
      label: "読了率",
      description: "ページをどこまで読み進めてくれたか（%で表示）",
    },
    ctaClick: {
      label: "ボタン押下数",
      description: "「詳しくはこちら」などのボタンが押された回数",
    },
    funnel: {
      label: "成果までの流れ",
      description: "「閲覧→資料請求→申し込み」といった各ステップで何人が進んだか",
    },
    pageViews: {
      label: "ページ閲覧数",
      description: "ページが開かれた合計回数",
    },
    avgDuration: {
      label: "平均滞在時間",
      description: "1回の訪問でどのくらいサイトにいたか",
    },
    newVisitors: {
      label: "初めての人",
      description: "初めてサイトに来てくれた人の数",
    },
    returningVisitors: {
      label: "リピーター",
      description: "2回以上来てくれている人の数",
    },
    topPages: {
      label: "よく見られたページ",
      description: "たくさん読まれているページのランキング",
    },
    device: {
      label: "端末",
      description: "パソコン・スマホ・タブレットのどれで見ているか",
    },
    browser: {
      label: "ブラウザ",
      description: "ChromeやSafariなど、どのブラウザで見ているか",
    },
    country: {
      label: "国",
      description: "どの国から訪問しているか",
    },
    utmSource: {
      label: "広告の出どころ",
      description: "どのサービスからの広告か（例：google、newsletter）",
    },
    utmMedium: {
      label: "広告の種類",
      description: "どんな方法の広告か（例：cpc、email）",
    },
    utmCampaign: {
      label: "キャンペーン名",
      description: "どの広告キャンペーンからか",
    },
    utmContent: {
      label: "広告の内容",
      description: "どのバナーやテキスト広告からか",
    },
    utmTerm: {
      label: "検索キーワード",
      description: "どんなキーワードで検索してきたか",
    },
    referrer: {
      label: "来る前に見ていたページ",
      description: "サイトに来る直前にどのページを見ていたか",
    },
    directTraffic: {
      label: "直接アクセス",
      description: "URLを直接入力したかブックマークから来た人",
    },
    organicSearch: {
      label: "Google検索（無料）",
      description: "Googleなどで検索して自然にたどり着いた人",
    },
    paidSearch: {
      label: "Google広告",
      description: "Google広告をクリックして来た人",
    },
    organicSocial: {
      label: "SNS（投稿）",
      description: "TwitterやInstagramの投稿からたどり着いた人",
    },
    paidSocial: {
      label: "SNS広告",
      description: "SNSの広告をクリックして来た人",
    },
    email: {
      label: "メール",
      description: "メールマガジンのリンクからきた人",
    },
    affiliate: {
      label: "アフィリエイト",
      description: "紹介サイトからやってきた人",
    },
    other: {
      label: "その他",
      description: "上の分類に当てはまらない流入元",
    },
  },
};

/**
 * 用語を取得する
 * @param key - 用語キー
 * @param easyMode - やさしいモードかどうか
 * @returns TermEntry
 */
export function getTerm(key: TermKey, easyMode: boolean): TermEntry {
  return easyMode ? TERMINOLOGY.easy[key] : TERMINOLOGY.normal[key];
}

/**
 * 用語ラベルを取得する
 */
export function getTermLabel(key: TermKey, easyMode: boolean): string {
  return getTerm(key, easyMode).label;
}

/**
 * 用語説明を取得する（ツールチップ用）
 */
export function getTermDescription(key: TermKey, easyMode: boolean): string {
  return getTerm(key, easyMode).description;
}

// 空状態メッセージ
export const EMPTY_STATE_MESSAGES = {
  normal: {
    noData: "データがありません",
    noDataDescription: "計測期間内にデータが記録されていません。SDKが正しく設置されているか確認してください。",
    noEvents: "イベントがありません",
    noConversions: "コンバージョンがありません",
    noConversionsDescription: "この期間にコンバージョンは発生していません。",
    selectProject: "プロジェクトを選択してください",
    loading: "読み込み中...",
  },
  easy: {
    noData: "まだデータがありません",
    noDataDescription: "サイトへの訪問がまだ記録されていません。計測タグが正しく設置されているか確認してみましょう。",
    noEvents: "まだ動きがありません",
    noConversions: "まだ成果がありません",
    noConversionsDescription: "この期間にお問い合わせや購入など、成果として設定したアクションはまだありません。",
    selectProject: "計測するサイトを選んでください",
    loading: "データを取得中...",
  },
} as const;

export function getEmptyState(
  key: keyof typeof EMPTY_STATE_MESSAGES.normal,
  easyMode: boolean
): string {
  return easyMode
    ? EMPTY_STATE_MESSAGES.easy[key]
    : EMPTY_STATE_MESSAGES.normal[key];
}

// CV設定タイプの表示名
export const CV_TYPE_LABELS = {
  normal: {
    url_match: "URL一致",
    click: "クリックベース",
    form_submit: "フォーム送信",
    url_match_desc: "指定URLへのアクセスでコンバージョンを記録",
    click_desc: "特定要素のクリックでコンバージョンを記録",
    form_submit_desc: "フォーム送信でコンバージョンを記録",
  },
  easy: {
    url_match: "このページが表示されたら成果",
    click: "このボタンが押されたら成果",
    form_submit: "フォームが送信されたら成果",
    url_match_desc: "例：「/thanks」ページが表示されたらお問い合わせ完了として数える",
    click_desc: "例：「資料請求する」ボタンが押されたら数える",
    form_submit_desc: "例：お問い合わせフォームが送信されたら数える",
  },
} as const;
