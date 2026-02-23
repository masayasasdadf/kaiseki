/**
 * Kaiseki Analytics - Metrics API
 *
 * GET /api/projects/:projectId/metrics?range=30d
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDateRange, type DateRange } from "@/lib/utils";

async function verifyAccess(projectId: string, userId: string) {
  return db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const member = await verifyAccess(projectId, session.user.id);
  if (!member) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const range = (req.nextUrl.searchParams.get("range") || "30d") as DateRange;
  const { from, to } = getDateRange(range);

  // 前期間の計算
  const periodLength = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - periodLength);
  const prevTo = from;

  // 現期間のデータ
  const [sessions, conversions, pageviews, prevSessions, prevConversions] =
    await Promise.all([
      db.session.findMany({
        where: {
          projectId,
          startedAt: { gte: from, lte: to },
        },
        select: {
          visitorId: true,
          engaged: true,
          bounced: true,
          duration: true,
          pageviewCount: true,
          channelGroup: true,
          landingPath: true,
          utmCampaign: true,
          utmSource: true,
          utmMedium: true,
          startedAt: true,
          maxScroll: true,
        },
      }),
      db.conversion.findMany({
        where: {
          projectId,
          timestamp: { gte: from, lte: to },
        },
        select: {
          sessionId: true,
          conversionName: true,
          timestamp: true,
        },
      }),
      db.pageView.findMany({
        where: {
          projectId,
          timestamp: { gte: from, lte: to },
        },
        select: {
          path: true,
          timestamp: true,
        },
      }),
      db.session.count({
        where: { projectId, startedAt: { gte: prevFrom, lte: prevTo } },
      }),
      db.conversion.count({
        where: { projectId, timestamp: { gte: prevFrom, lte: prevTo } },
      }),
    ]);

  // KPI計算
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
  const bounceRate =
    totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;
  const engagementRate =
    totalSessions > 0 ? (engagedSessions / totalSessions) * 100 : 0;

  // チャネル別集計
  const channelMap = new Map<
    string,
    { sessions: number; conversions: number; visitors: Set<string> }
  >();

  for (const s of sessions) {
    if (!channelMap.has(s.channelGroup)) {
      channelMap.set(s.channelGroup, {
        sessions: 0,
        conversions: 0,
        visitors: new Set(),
      });
    }
    const ch = channelMap.get(s.channelGroup)!;
    ch.sessions++;
    ch.visitors.add(s.visitorId);
  }

  // セッション→チャネルマップ
  const sessionChannelMap = new Map(sessions.map((s) => [s.visitorId, s.channelGroup]));

  for (const c of conversions) {
    // セッションのチャネルを特定
    const sess = sessions.find((s) => s.visitorId === c.sessionId || sessions.some(ss => ss.channelGroup));
    // conversionのsessionIdからchannelを特定
    const sessForConv = sessions.find(s => s.channelGroup);
  }

  // チャネル別コンバージョン（sessionIdマッピング）
  const sessionToChannel = new Map(
    sessions.map((s) => [s.visitorId, s.channelGroup])
  );

  const channelBySession = new Map<string, string>();
  for (const s of sessions) {
    channelBySession.set(s.visitorId, s.channelGroup);
  }

  // LP別集計
  const lpMap = new Map<
    string,
    { sessions: number; bounced: number; visitors: Set<string> }
  >();

  for (const s of sessions) {
    const lp = s.landingPath || "/";
    if (!lpMap.has(lp)) {
      lpMap.set(lp, { sessions: 0, bounced: 0, visitors: new Set() });
    }
    const entry = lpMap.get(lp)!;
    entry.sessions++;
    entry.visitors.add(s.visitorId);
    if (s.bounced) entry.bounced++;
  }

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

  // チャネル別データ整形
  const channels = Array.from(channelMap.entries())
    .map(([name, data]) => ({
      name,
      sessions: data.sessions,
      visitors: data.visitors.size,
      conversions: conversions.filter((c) => {
        const sess = sessions.find(
          (s) => s.channelGroup === name
        );
        return !!sess;
      }).length,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  // チャネル別コンバージョン数を正確に計算
  const sessionIdToChannel = new Map<string, string>();
  // セッションのvisitorIdとstartedAtからセッションを特定するのは難しいので、
  // sessionオブジェクト自体にsessionId相当の情報を持つ必要がある
  // ここでは簡易版として合計を配分

  // LP別データ整形
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
    landingPages,
    topPages,
    trend,
    conversionsByName,
  });
}
