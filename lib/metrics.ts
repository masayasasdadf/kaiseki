/**
 * Kaiseki Analytics - 指標定義・計算
 *
 * 詳細: docs/metrics.md
 */

/**
 * Bounce（直帰）の定義:
 * - page_view = 1 かつ engaged = false
 *
 * Engaged（エンゲージド）の定義:
 * - 滞在10秒以上 OR
 * - スクロール25%以上 OR
 * - 重要クリック（data-track）1回以上
 *
 * CVR = conversions / sessions × 100
 */

export interface SessionMetrics {
  pageviewCount: number;
  duration: number; // seconds
  maxScroll: number; // percent
  hasImportantClick: boolean;
}

/**
 * セッションがエンゲージドかどうかを判定する
 */
export function isEngaged(metrics: SessionMetrics): boolean {
  return (
    metrics.duration >= 10 ||
    metrics.maxScroll >= 25 ||
    metrics.hasImportantClick
  );
}

/**
 * セッションが直帰かどうかを判定する
 */
export function isBounce(metrics: SessionMetrics): boolean {
  return metrics.pageviewCount <= 1 && !isEngaged(metrics);
}

/**
 * CVRを計算する（%）
 */
export function calcCVR(conversions: number, sessions: number): number {
  if (sessions === 0) return 0;
  return (conversions / sessions) * 100;
}

/**
 * Bounce Rateを計算する（%）
 */
export function calcBounceRate(bouncedSessions: number, totalSessions: number): number {
  if (totalSessions === 0) return 0;
  return (bouncedSessions / totalSessions) * 100;
}

/**
 * Engagement Rateを計算する（%）
 */
export function calcEngagementRate(
  engagedSessions: number,
  totalSessions: number
): number {
  if (totalSessions === 0) return 0;
  return (engagedSessions / totalSessions) * 100;
}

/**
 * 数値フォーマット用ヘルパー
 */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s > 0 ? `${s}秒` : ""}`;
}

/**
 * 前期比の変化率（%）
 */
export function calcChangeRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export interface KPISummary {
  sessions: number;
  users: number;
  conversions: number;
  cvr: number;
  bounceRate: number;
  engagementRate: number;
  pageviews: number;
  avgDuration: number;
}

export interface KPIWithChange extends KPISummary {
  change: Partial<Record<keyof KPISummary, number>>;
}
