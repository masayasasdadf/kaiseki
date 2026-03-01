/**
 * Kaiseki Analytics - Segments API
 * GET /api/projects/:projectId/segments?range=30d
 *
 * デバイス別・チャネル別にCVR/直帰率/滞在時間/スクロール深度を比較
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getDateRange, type DateRange } from "@/lib/utils";

interface SegmentStats {
  segment: string;
  sessions: number;
  conversions: number;
  cvr: number;
  bounceRate: number;
  engagementRate: number;
  avgDuration: number;
  avgScroll: number;
}

function computeStats(
  label: string,
  sessions: { bounced: boolean; engaged: boolean; duration: number; maxScroll: number; sessionId: string }[],
  convertedIds: Set<string>
): SegmentStats {
  const total = sessions.length;
  if (total === 0) {
    return {
      segment: label, sessions: 0, conversions: 0, cvr: 0,
      bounceRate: 0, engagementRate: 0, avgDuration: 0, avgScroll: 0,
    };
  }
  const conversions = sessions.filter((s) => convertedIds.has(s.sessionId)).length;
  const bounced = sessions.filter((s) => s.bounced).length;
  const engaged = sessions.filter((s) => s.engaged).length;
  const avgDuration = Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / total);
  const avgScroll = Math.round(sessions.reduce((sum, s) => sum + s.maxScroll, 0) / total);

  return {
    segment: label,
    sessions: total,
    conversions,
    cvr: Math.round((conversions / total) * 1000) / 10,
    bounceRate: Math.round((bounced / total) * 1000) / 10,
    engagementRate: Math.round((engaged / total) * 1000) / 10,
    avgDuration,
    avgScroll,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const range = (req.nextUrl.searchParams.get("range") || "30d") as DateRange;
  const { from, to } = getDateRange(range);

  const [sessions, conversions] = await Promise.all([
    db.session.findMany({
      where: { projectId, startedAt: { gte: from, lte: to } },
      select: {
        sessionId: true,
        device: true,
        channelGroup: true,
        bounced: true,
        engaged: true,
        duration: true,
        maxScroll: true,
      },
    }),
    db.conversion.findMany({
      where: { projectId, timestamp: { gte: from, lte: to } },
      select: { sessionId: true },
    }),
  ]);

  const convertedIds = new Set(conversions.map((c) => c.sessionId));

  // デバイス別
  const deviceGroups = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = s.device || "unknown";
    if (!deviceGroups.has(key)) deviceGroups.set(key, []);
    deviceGroups.get(key)!.push(s);
  }
  const byDevice: SegmentStats[] = Array.from(deviceGroups.entries())
    .map(([device, ss]) => computeStats(device, ss, convertedIds))
    .sort((a, b) => b.sessions - a.sessions);

  // チャネル別
  const channelGroups = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = s.channelGroup || "Direct";
    if (!channelGroups.has(key)) channelGroups.set(key, []);
    channelGroups.get(key)!.push(s);
  }
  const byChannel: SegmentStats[] = Array.from(channelGroups.entries())
    .map(([ch, ss]) => computeStats(ch, ss, convertedIds))
    .sort((a, b) => b.sessions - a.sessions);

  const totalSessions = sessions.length;
  const totalConversions = conversions.length;
  const overallCvr = totalSessions > 0
    ? Math.round((totalConversions / totalSessions) * 1000) / 10
    : 0;

  return Response.json({ byDevice, byChannel, totalSessions, totalConversions, overallCvr });
}
