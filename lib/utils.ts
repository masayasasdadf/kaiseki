import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import crypto from "crypto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export metric formatting helpers for convenience
export { formatNumber, formatPercent, formatDuration, calcChangeRate } from "@/lib/metrics";

/**
 * HMAC-SHA256 署名を生成する
 */
export function createHmacSignature(
  payload: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * HMAC署名を検証する
 */
export function verifyHmacSignature(
  payload: string,
  secret: string,
  signature: string
): boolean {
  const expected = createHmacSignature(payload, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * ランダムな秘密鍵を生成する
 */
export function generateSecretKey(): string {
  return `ks_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * PII（個人情報）を含む可能性のあるフィールドを除去する
 */
export function sanitizePII<T extends Record<string, unknown>>(data: T): T {
  const PII_PATTERNS = [
    /email/i,
    /password/i,
    /phone/i,
    /credit.?card/i,
    /ssn/i,
    /social.?security/i,
  ];

  const sanitized = { ...data };
  for (const key of Object.keys(sanitized)) {
    if (PII_PATTERNS.some((p) => p.test(key))) {
      delete sanitized[key];
    }
  }
  return sanitized;
}

/**
 * User-Agent からデバイス種別を判定する
 */
export function detectDevice(ua: string): "Desktop" | "Mobile" | "Tablet" {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "Tablet";
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua))
    return "Mobile";
  return "Desktop";
}

/**
 * User-Agent からブラウザを判定する
 */
export function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/msie|trident/i.test(ua)) return "IE";
  if (/opera|opr/i.test(ua)) return "Opera";
  return "Other";
}

/**
 * User-Agent からOSを判定する
 */
export function detectOS(ua: string): string {
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

/**
 * 日付範囲のラベル
 */
export const DATE_RANGES = [
  { label: "今日", value: "today" },
  { label: "昨日", value: "yesterday" },
  { label: "過去7日", value: "7d" },
  { label: "過去30日", value: "30d" },
  { label: "過去90日", value: "90d" },
  { label: "今月", value: "this_month" },
  { label: "先月", value: "last_month" },
] as const;

export type DateRange = (typeof DATE_RANGES)[number]["value"];

/**
 * 日付範囲から開始・終了日時を取得する
 */
export function getDateRange(range: DateRange): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case "today":
      return { from: today, to: now };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: today };
    }
    case "7d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 7);
      return { from, to: now };
    }
    case "30d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 30);
      return { from, to: now };
    }
    case "90d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 90);
      return { from, to: now };
    }
    case "this_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: now };
    }
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to };
    }
    default:
      return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
  }
}

/**
 * エラーレスポンス形式
 */
export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export function createErrorResponse(
  message: string,
  status: number,
  code?: string
): Response {
  return Response.json(
    { error: message, code } satisfies ApiError,
    { status }
  );
}
