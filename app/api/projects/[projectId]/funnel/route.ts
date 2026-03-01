/**
 * Kaiseki Analytics - Funnel API
 * POST /api/projects/:projectId/funnel
 *
 * 任意のURLステップを順番に通過したセッション数を集計して返す
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getDateRange, type DateRange } from "@/lib/utils";

const bodySchema = z.object({
  steps: z.array(z.string().min(1)).min(2).max(8),
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed" }, { status: 400 });
  }

  const { steps, range } = parsed.data;
  const { from, to } = getDateRange(range as DateRange);

  const [pageViews, conversions] = await Promise.all([
    db.pageView.findMany({
      where: { projectId, timestamp: { gte: from, lte: to } },
      select: { sessionId: true, path: true, timestamp: true },
      orderBy: [{ sessionId: "asc" }, { timestamp: "asc" }],
    }),
    db.conversion.findMany({
      where: { projectId, timestamp: { gte: from, lte: to } },
      select: { sessionId: true },
    }),
  ]);

  const convertedSessions = new Set(conversions.map((c) => c.sessionId));

  // セッションごとにページ配列を組み立てる
  const sessionPages = new Map<string, { path: string; ts: number }[]>();
  for (const pv of pageViews) {
    if (!sessionPages.has(pv.sessionId)) sessionPages.set(pv.sessionId, []);
    sessionPages.get(pv.sessionId)!.push({ path: pv.path, ts: pv.timestamp.getTime() });
  }

  // 各セッションが何ステップ目まで到達したか計算
  // ルール: ステップN+1はステップNを最初に踏んだ後に通過していればOK（連続不要）
  const stepCounts = new Array<number>(steps.length).fill(0);
  const stepConversions = new Array<number>(steps.length).fill(0);

  const matchesStep = (path: string, step: string) => path.startsWith(step);

  for (const [sessionId, pages] of sessionPages) {
    let reached = 0; // 次に通過すべきステップ index

    for (const { path } of pages) {
      if (reached < steps.length && matchesStep(path, steps[reached])) {
        reached++;
      }
      if (reached === steps.length) break;
    }

    // このセッションが到達したステップ数分だけカウント
    for (let i = 0; i < reached; i++) {
      stepCounts[i]++;
      if (convertedSessions.has(sessionId)) stepConversions[i]++;
    }
  }

  const totalEntered = stepCounts[0] ?? 0;
  const totalCompleted = stepCounts[steps.length - 1] ?? 0;

  const result = steps.map((path, i) => {
    const sessions = stepCounts[i] ?? 0;
    const prevSessions = i === 0 ? sessions : (stepCounts[i - 1] ?? sessions);
    const dropOff = i === 0 ? 0 : prevSessions - sessions;
    const dropOffRate = prevSessions > 0 ? Math.round((dropOff / prevSessions) * 100) : 0;
    const percentage = totalEntered > 0 ? Math.round((sessions / totalEntered) * 100) : 0;

    return {
      path,
      sessions,
      percentage,
      dropOff,
      dropOffRate,
      conversionCount: stepConversions[i] ?? 0,
    };
  });

  return Response.json({
    steps: result,
    totalEntered,
    totalCompleted,
    completionRate: totalEntered > 0 ? Math.round((totalCompleted / totalEntered) * 100) : 0,
  });
}
