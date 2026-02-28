/**
 * Kaiseki Analytics - Live Data API (polling)
 * GET /api/projects/:projectId/live-data?since=ISO_TIMESTAMP
 *
 * Vercel serverlessではSSEのメモリ共有が使えないため、
 * このエンドポイントをポーリングしてリアルタイム表示を実現する。
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const sinceParam = req.nextUrl.searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 30_000);

  // 今日の開始時刻（JST → UTCで計算）
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    sessionsToday,
    pageviewsToday,
    conversionsToday,
    recentSessions,
    recentPageviews,
    recentConversions,
    recentEvents,
  ] = await Promise.all([
    db.session.count({ where: { projectId, startedAt: { gte: todayStart } } }),
    db.pageView.count({ where: { projectId, timestamp: { gte: todayStart } } }),
    db.conversion.count({ where: { projectId, timestamp: { gte: todayStart } } }),

    // since以降の新しいセッション
    db.session.findMany({
      where: { projectId, startedAt: { gt: since } },
      select: {
        sessionId: true,
        channelGroup: true,
        device: true,
        startedAt: true,
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),

    // since以降の新しいページビュー
    db.pageView.findMany({
      where: { projectId, timestamp: { gt: since } },
      select: {
        sessionId: true,
        path: true,
        title: true,
        timestamp: true,
      },
      orderBy: { timestamp: "desc" },
      take: 50,
    }),

    // since以降の新しいコンバージョン
    db.conversion.findMany({
      where: { projectId, timestamp: { gt: since } },
      select: {
        sessionId: true,
        conversionName: true,
        path: true,
        timestamp: true,
      },
      orderBy: { timestamp: "desc" },
      take: 50,
    }),

    // since以降のカスタムイベント・CTAクリック
    db.event.findMany({
      where: {
        projectId,
        timestamp: { gt: since },
        eventType: { in: ["cta_click", "custom"] },
      },
      select: {
        sessionId: true,
        eventType: true,
        eventName: true,
        path: true,
        timestamp: true,
      },
      orderBy: { timestamp: "desc" },
      take: 50,
    }),
  ]);

  // イベントを統合してタイムスタンプ順に並べる
  type LiveEvent = {
    uid: string;
    type: string;
    sessionId: string;
    path?: string | null;
    channelGroup?: string | null;
    conversionName?: string | null;
    eventName?: string | null;
    timestamp: string;
  };

  const events: LiveEvent[] = [
    ...recentSessions.map((s) => ({
      uid: `session_${s.sessionId}`,
      type: "session_start",
      sessionId: s.sessionId,
      channelGroup: s.channelGroup,
      timestamp: s.startedAt.toISOString(),
    })),
    ...recentPageviews.map((pv) => ({
      uid: `pv_${pv.sessionId}_${pv.timestamp.getTime()}`,
      type: "page_view",
      sessionId: pv.sessionId,
      path: pv.path,
      timestamp: pv.timestamp.toISOString(),
    })),
    ...recentConversions.map((c) => ({
      uid: `conv_${c.sessionId}_${c.timestamp.getTime()}`,
      type: "conversion",
      sessionId: c.sessionId,
      conversionName: c.conversionName,
      path: c.path,
      timestamp: c.timestamp.toISOString(),
    })),
    ...recentEvents.map((e) => ({
      uid: `evt_${e.sessionId}_${e.eventType}_${e.timestamp.getTime()}`,
      type: e.eventType,
      sessionId: e.sessionId,
      eventName: e.eventName,
      path: e.path,
      timestamp: e.timestamp.toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return Response.json({
    stats: {
      sessions: sessionsToday,
      pageviews: pageviewsToday,
      conversions: conversionsToday,
    },
    events,
    serverTime: new Date().toISOString(),
  });
}
