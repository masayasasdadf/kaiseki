/**
 * Kaiseki Analytics - Metrics API
 * GET /api/projects/:projectId/metrics?range=30d
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getDateRange, type DateRange } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const range = (req.nextUrl.searchParams.get("range") || "30d") as DateRange;
  const { from, to } = getDateRange(range);

  const periodLength = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - periodLength);
  const prevTo = from;

  const [sessions, conversions, pageviews, prevSessions, prevConversions] =
    await Promise.all([
      db.session.findMany({
        where: { projectId, startedAt: { gte: from, lte: to } },
        select: {
          id: true,
          sessionId: true,
          visitorId: true,
          engaged: true,
          bounced: true,
          duration: true,
          pageviewCount: true,
          channelGroup: true,
          landingPath: true,
          referrer: true,
          utmCampaign: true,
          utmSource: true,
          utmMedium: true,
          startedAt: true,
          maxScroll: true,
        },
      }),
      db.conversion.findMany({
        where: { projectId, timestamp: { gte: from, lte: to } },
        select: { sessionId: true, conversionName: true, timestamp: true },
      }),
      db.pageView.findMany({
        where: { projectId, timestamp: { gte: from, lte: to } },
        select: { path: true, timestamp: true },
      }),
      db.session.count({ where: { projectId, startedAt: { gte: prevFrom, lte: prevTo } } }),
      db.conversion.count({ where: { projectId, timestamp: { gte: prevFrom, lte: prevTo } } }),
    ]);

  const totalSessions = sessions.length;
  const uniqueVisitors = new Set(sessions.map((s) => s.visitorId)).size;
  const totalConversions = conversions.length;
  const bouncedSessions = sessions.filter((s) => s.bounced).length;
  const engagedSessions = sessions.filter((s) => s.engaged).length;
  const totalPageviews = pageviews.length;
  const avgDuration =
    totalSessions > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / totalSessions)
      : 0;

  const cvr = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
  const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;
  const engagementRate = totalSessions > 0 ? (engagedSessions / totalSessions) * 100 : 0;

  // チャネル別集計
  // conversion.sessionId は Session.sessionId（外部SDK ID）を参照するため、s.id ではなく s.sessionId でキーを設定
  const sessionChannelMap = new Map<string, string>();
  for (const s of sessions) {
    sessionChannelMap.set(s.sessionId, s.channelGroup);
  }

  const channelMap = new Map<string, { sessions: number; visitors: Set<string>; conversions: number }>();
  for (const s of sessions) {
    if (!channelMap.has(s.channelGroup)) {
      channelMap.set(s.channelGroup, { sessions: 0, visitors: new Set(), conversions: 0 });
    }
    const ch = channelMap.get(s.channelGroup)!;
    ch.sessions++;
    ch.visitors.add(s.visitorId);
  }
  for (const c of conversions) {
    const channel = sessionChannelMap.get(c.sessionId);
    if (channel && channelMap.has(channel)) {
      channelMap.get(channel)!.conversions++;
    }
  }

  const channels = Array.from(channelMap.entries())
    .map(([name, data]) => ({
      name,
      sessions: data.sessions,
      visitors: data.visitors.size,
      conversions: data.conversions,
      cvr: data.sessions > 0 ? (data.conversions / data.sessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // チャネル×CV名のクロス集計
  const channelCvMap = new Map<string, Map<string, number>>();
  for (const c of conversions) {
    const channel = sessionChannelMap.get(c.sessionId);
    if (!channel) continue;
    if (!channelCvMap.has(channel)) channelCvMap.set(channel, new Map());
    const cvNameMap = channelCvMap.get(channel)!;
    cvNameMap.set(c.conversionName, (cvNameMap.get(c.conversionName) || 0) + 1);
  }
  const channelConversions = Array.from(channelCvMap.entries())
    .map(([channel, cvs]) => ({
      channel,
      breakdown: Array.from(cvs.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => {
      const aTotal = a.breakdown.reduce((s, x) => s + x.count, 0);
      const bTotal = b.breakdown.reduce((s, x) => s + x.count, 0);
      return bTotal - aTotal;
    });

  // 参照元ドメイン別集計
  const sessionReferrerDomainMap = new Map<string, string>(); // sessionId -> domain
  const referrerDomainMap = new Map<string, {
    sessions: number;
    visitors: Set<string>;
    conversions: number;
    pageMap: Map<string, number>; // referrer path -> session count
  }>();

  for (const s of sessions) {
    if (!s.referrer) continue;
    let domain: string;
    let path: string;
    try {
      const u = new URL(s.referrer);
      domain = u.hostname.replace(/^www\./, "");
      path = u.pathname || "/";
    } catch {
      continue;
    }
    sessionReferrerDomainMap.set(s.sessionId, domain);
    if (!referrerDomainMap.has(domain)) {
      referrerDomainMap.set(domain, { sessions: 0, visitors: new Set(), conversions: 0, pageMap: new Map() });
    }
    const entry = referrerDomainMap.get(domain)!;
    entry.sessions++;
    entry.visitors.add(s.visitorId);
    entry.pageMap.set(path, (entry.pageMap.get(path) || 0) + 1);
  }
  for (const c of conversions) {
    const domain = sessionReferrerDomainMap.get(c.sessionId);
    if (domain && referrerDomainMap.has(domain)) {
      referrerDomainMap.get(domain)!.conversions++;
    }
  }

  const referrers = Array.from(referrerDomainMap.entries())
    .map(([domain, data]) => ({
      domain,
      sessions: data.sessions,
      visitors: data.visitors.size,
      conversions: data.conversions,
      cvr: data.sessions > 0 ? (data.conversions / data.sessions) * 100 : 0,
      topPages: Array.from(data.pageMap.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20);

  // LP別集計
  const lpMap = new Map<string, { sessions: number; bounced: number; visitors: Set<string> }>();
  for (const s of sessions) {
    const lp = s.landingPath || "/";
    if (!lpMap.has(lp)) lpMap.set(lp, { sessions: 0, bounced: 0, visitors: new Set() });
    const entry = lpMap.get(lp)!;
    entry.sessions++;
    entry.visitors.add(s.visitorId);
    if (s.bounced) entry.bounced++;
  }

  const landingPages = Array.from(lpMap.entries())
    .map(([path, data]) => ({
      path,
      sessions: data.sessions,
      visitors: data.visitors.size,
      bounceRate: data.sessions > 0 ? (data.bounced / data.sessions) * 100 : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20);

  // ページ別閲覧数
  const pageMap = new Map<string, number>();
  for (const pv of pageviews) {
    pageMap.set(pv.path, (pageMap.get(pv.path) || 0) + 1);
  }
  const topPages = Array.from(pageMap.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);

  // 日別トレンド
  const trendMap = new Map<string, { sessions: number; conversions: number }>();
  for (const s of sessions) {
    const day = s.startedAt.toISOString().split("T")[0];
    if (!trendMap.has(day)) trendMap.set(day, { sessions: 0, conversions: 0 });
    trendMap.get(day)!.sessions++;
  }
  for (const c of conversions) {
    const day = c.timestamp.toISOString().split("T")[0];
    if (!trendMap.has(day)) trendMap.set(day, { sessions: 0, conversions: 0 });
    trendMap.get(day)!.conversions++;
  }
  const trend = Array.from(trendMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // CV別集計
  const cvMap = new Map<string, number>();
  for (const c of conversions) {
    cvMap.set(c.conversionName, (cvMap.get(c.conversionName) || 0) + 1);
  }
  const conversionsByName = Array.from(cvMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return Response.json({
    kpi: {
      sessions: totalSessions,
      users: uniqueVisitors,
      conversions: totalConversions,
      cvr,
      bounceRate,
      engagementRate,
      pageviews: totalPageviews,
      avgDuration,
      prevSessions,
      prevConversions,
    },
    channels,
    channelConversions,
    referrers,
    landingPages,
    topPages,
    trend,
    conversionsByName,
  });
}
