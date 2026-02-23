/**
 * Kaiseki Analytics - チャネル帰属・分類
 *
 * 帰属モデル: Last non-direct click (MVP)
 * 詳細: docs/attribution.md
 */

export type ChannelGroup =
  | "Paid Search"
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

/**
 * UTMパラメータとreferrerからチャネルグループを判定する
 *
 * 優先順位:
 * 1. gclid/wbraid/gbraid → Paid Search
 * 2. fbclid → Paid Social
 * 3. utm_medium が cpc/ppc → Paid Search
 * 4. utm_medium が email → Email
 * 5. utm_medium が affiliate → Affiliate
 * 6. utm_medium が social/paid_social → Paid Social
 * 7. utm_source が検索エンジン → Organic Search
 * 8. utm_source がSNS → Organic Social
 * 9. referrer が検索エンジン → Organic Search
 * 10. referrer がSNS → Organic Social
 * 11. referrer がある → Referral
 * 12. なし → Direct
 */
export function classifyChannel(input: AttributionInput): ChannelGroup {
  const medium = input.utmMedium?.toLowerCase() ?? "";
  const source = input.utmSource?.toLowerCase() ?? "";
  const referrerDomain = extractDomain(input.referrer ?? "");

  // Google広告クリック識別子
  if (input.gclid || input.wbraid || input.gbraid) {
    return "Paid Search";
  }

  // Meta広告クリック識別子
  if (input.fbclid) {
    return "Paid Social";
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
 * 全チャネルグループ一覧（表示順）
 */
export const ALL_CHANNELS: ChannelGroup[] = [
  "Paid Search",
  "Paid Social",
  "Organic Search",
  "Organic Social",
  "Referral",
  "Email",
  "Affiliate",
  "Direct",
  "Other",
];
