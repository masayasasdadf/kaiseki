/**
 * Kaiseki Analytics - チャネル帰属・分類
 *
 * 帰属モデル: Last non-direct click (MVP)
 * 詳細: docs/attribution.md
 */

export type ChannelGroup =
  | "Paid Search"
  | "Paid Display"
  | "Paid Video"
  | "Paid Social"
  | "Organic Search"
  | "Organic Social"
  | "Referral"
  | "Email"
  | "Affiliate"
  | "Direct"
  | "Other";

interface AttributionInput {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  wbraid?: string | null;
  gbraid?: string | null;
  msclkid?: string | null;
  fbclid?: string | null;
  referrer?: string | null;
}

// 検索エンジンのドメイン一覧
const SEARCH_ENGINE_DOMAINS = [
  "google",
  "bing",
  "yahoo",
  "baidu",
  "yandex",
  "duckduckgo",
  "ecosia",
  "ask",
  "aol",
  "naver",
  "daum",
];

// SNSドメイン一覧
const SOCIAL_DOMAINS = [
  "facebook",
  "instagram",
  "twitter",
  "x.com",
  "t.co",
  "linkedin",
  "tiktok",
  "pinterest",
  "reddit",
  "youtube",
  "snapchat",
  "line",
  "wechat",
  "weibo",
];

// メール関連の識別子
const EMAIL_MEDIUMS = ["email", "e-mail", "mail", "newsletter", "e_mail"];

// アフィリエイト識別子
const AFFILIATE_MEDIUMS = ["affiliate", "aff", "partner"];

// 有料ソーシャルの識別子
const PAID_SOCIAL_SOURCES = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "tiktok",
  "pinterest",
  "snapchat",
  "line",
];
const PAID_SOCIAL_MEDIUMS = [
  "cpc",
  "paid",
  "paid_social",
  "paidsocial",
  "social_paid",
];

// ディスプレイ広告のmedium識別子
const DISPLAY_MEDIUMS = ["display", "banner", "cpm", "interstitial", "native"];

// 動画広告のmedium識別子
const VIDEO_MEDIUMS = ["video", "ytd", "preroll", "instream", "outstream"];

/**
 * UTMパラメータとreferrerからチャネルグループを判定する
 *
 * 優先順位:
 * 1. gclid/wbraid/gbraid + utm_medium=display → Paid Display
 * 2. gclid/wbraid/gbraid + utm_medium=video → Paid Video
 * 3. gclid/wbraid/gbraid → Paid Search
 * 4. msclkid → Paid Search（Bing Ads）
 * 5. fbclid → Paid Social
 * 6. utm_medium が display/banner/cpm → Paid Display
 * 7. utm_medium が video → Paid Video
 * 8. utm_medium が cpc/ppc → Paid Search
 * 9. utm_medium が email → Email
 * 10. utm_medium が affiliate → Affiliate
 * 11. utm_medium が social/paid_social → Paid Social
 * 12. utm_source が検索エンジン → Organic Search
 * 13. utm_source がSNS → Organic Social
 * 14. referrer が検索エンジン → Organic Search
 * 15. referrer がSNS → Organic Social
 * 16. referrer がある → Referral
 * 17. なし → Direct
 */
export function classifyChannel(input: AttributionInput): ChannelGroup {
  const medium = input.utmMedium?.toLowerCase() ?? "";
  const source = input.utmSource?.toLowerCase() ?? "";
  const referrerDomain = extractDomain(input.referrer ?? "");

  // Google広告クリック識別子（mediumでサブチャネルを区別）
  if (input.gclid || input.wbraid || input.gbraid) {
    if (DISPLAY_MEDIUMS.includes(medium)) return "Paid Display";
    if (VIDEO_MEDIUMS.includes(medium)) return "Paid Video";
    return "Paid Search";
  }

  // Bing/Microsoft広告クリック識別子
  if (input.msclkid) {
    return "Paid Search";
  }

  // Meta広告クリック識別子
  if (input.fbclid) {
    return "Paid Social";
  }

  // UTM medium がディスプレイ広告
  if (DISPLAY_MEDIUMS.includes(medium)) {
    return "Paid Display";
  }

  // UTM medium が動画広告
  if (VIDEO_MEDIUMS.includes(medium)) {
    return "Paid Video";
  }

  // UTM medium が有料検索
  if (["cpc", "ppc", "paidsearch", "paid_search", "search_paid"].includes(medium)) {
    return "Paid Search";
  }

  // UTM medium がメール
  if (EMAIL_MEDIUMS.includes(medium)) {
    return "Email";
  }

  // UTM medium がアフィリエイト
  if (AFFILIATE_MEDIUMS.includes(medium)) {
    return "Affiliate";
  }

  // UTM medium が有料ソーシャル
  if (PAID_SOCIAL_MEDIUMS.includes(medium)) {
    return "Paid Social";
  }

  // UTM medium が organic または display なし + source が検索エンジン
  if (source && SEARCH_ENGINE_DOMAINS.some((se) => source.includes(se))) {
    if (medium === "organic" || medium === "") {
      return "Organic Search";
    }
    return "Paid Search";
  }

  // UTM source がSNS
  if (source && PAID_SOCIAL_SOURCES.some((s) => source.includes(s))) {
    if (PAID_SOCIAL_MEDIUMS.includes(medium) || medium === "cpc") {
      return "Paid Social";
    }
    return "Organic Social";
  }

  // UTM があるが上記に当てはまらない
  if (source || medium) {
    return "Other";
  }

  // referrer から判定
  if (referrerDomain) {
    if (SEARCH_ENGINE_DOMAINS.some((se) => referrerDomain.includes(se))) {
      return "Organic Search";
    }
    if (SOCIAL_DOMAINS.some((s) => referrerDomain.includes(s))) {
      return "Organic Social";
    }
    return "Referral";
  }

  return "Direct";
}

function extractDomain(url: string): string {
  try {
    if (!url) return "";
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace("www.", "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * チャネルグループの表示色
 */
export const CHANNEL_COLORS: Record<ChannelGroup, string> = {
  "Paid Search": "#4F46E5",
  "Paid Display": "#7C3AED",
  "Paid Video": "#DC2626",
  "Paid Social": "#EC4899",
  "Organic Search": "#10B981",
  "Organic Social": "#F59E0B",
  Referral: "#6366F1",
  Email: "#14B8A6",
  Affiliate: "#8B5CF6",
  Direct: "#64748B",
  Other: "#94A3B8",
};

/**
 * チャネルグループの日本語表示ラベル
 * easyMode=true のときは一般ユーザー向けの分かりやすい表現を使う
 */
export const CHANNEL_LABELS: Record<ChannelGroup, { normal: string; easy: string }> = {
  "Paid Search":   { normal: "Paid Search",   easy: "広告（検索）" },
  "Paid Display":  { normal: "Paid Display",  easy: "広告（ディスプレイ）" },
  "Paid Video":    { normal: "Paid Video",    easy: "広告（動画）" },
  "Paid Social":   { normal: "Paid Social",   easy: "広告（SNS）" },
  "Organic Search":{ normal: "Organic Search",easy: "自然検索" },
  "Organic Social":{ normal: "Organic Social",easy: "SNS投稿" },
  "Referral":      { normal: "Referral",      easy: "他サイトから" },
  "Email":         { normal: "Email",         easy: "メール" },
  "Affiliate":     { normal: "Affiliate",     easy: "アフィリエイト" },
  "Direct":        { normal: "Direct",        easy: "直接訪問" },
  "Other":         { normal: "Other",         easy: "その他" },
};

/** チャネル名を表示用ラベルに変換する */
export function channelLabel(name: string, easyMode: boolean): string {
  const entry = CHANNEL_LABELS[name as ChannelGroup];
  if (!entry) return name;
  return easyMode ? entry.easy : entry.normal;
}

/**
 * 全チャネルグループ一覧（表示順）
 */
export const ALL_CHANNELS: ChannelGroup[] = [
  "Paid Search",
  "Paid Display",
  "Paid Video",
  "Paid Social",
  "Organic Search",
  "Organic Social",
  "Referral",
  "Email",
  "Affiliate",
  "Direct",
  "Other",
];
