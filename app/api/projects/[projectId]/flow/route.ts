/**
 * Kaiseki Analytics - Page Flow API
 * GET /api/projects/:projectId/flow?range=30d
 *
 * ページ遷移・よく辿られるパス・離脱ページを集計して返す
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
  const sessionPages = new Map<string, string[]>();
  for (const pv of pageViews) {
    if (!sessionPages.has(pv.sessionId)) sessionPages.set(pv.sessionId, []);
    sessionPages.get(pv.sessionId)!.push(pv.path);
  }

  const transitionMap = new Map<string, number>();
  const pathMap = new Map<string, { count: number; cvCount: number }>();
  const exitMap = new Map<string, number>();
  const pageVisitMap = new Map<string, number>();

  for (const [sessionId, pages] of sessionPages) {
    const isCV = convertedSessions.has(sessionId);

    // ページ訪問数（離脱率の分母）
    for (const page of pages) {
      pageVisitMap.set(page, (pageVisitMap.get(page) || 0) + 1);
    }

    // ページ遷移 (A → B)
    for (let i = 0; i < pages.length - 1; i++) {
      // 同一ページの連続は集計しない（リロード除外）
      if (pages[i] === pages[i + 1]) continue;
      const key = `${pages[i]}\t${pages[i + 1]}`;
      transitionMap.set(key, (transitionMap.get(key) || 0) + 1);
    }

    // 離脱ページ（そのセッションの最後のページ）
    exitMap.set(pages[pages.length - 1], (exitMap.get(pages[pages.length - 1]) || 0) + 1);

    // よく辿られるパス（最初の4ページまで・連続重複を除去）
    const dedupedPages: string[] = [];
    for (const p of pages) {
      if (dedupedPages.length === 0 || dedupedPages[dedupedPages.length - 1] !== p) {
        dedupedPages.push(p);
        if (dedupedPages.length >= 4) break;
      }
    }
    const pathKey = dedupedPages.join("\t");
    const prev = pathMap.get(pathKey) ?? { count: 0, cvCount: 0 };
    pathMap.set(pathKey, { count: prev.count + 1, cvCount: prev.cvCount + (isCV ? 1 : 0) });
  }

  // ページ遷移 TOP20
  const transitions = Array.from(transitionMap.entries())
    .map(([key, count]) => {
      const [from, to] = key.split("\t");
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // よく辿られるパス TOP10
  const topPaths = Array.from(pathMap.entries())
    .map(([key, data]) => ({
      steps: key.split("\t"),
      count: data.count,
      conversionCount: data.cvCount,
      cvRate: data.count > 0 ? Math.round((data.cvCount / data.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 離脱ページ TOP10
  const exitPages = Array.from(exitMap.entries())
    .map(([path, exits]) => {
      const totalVisits = pageVisitMap.get(path) || exits;
      return { path, exits, exitRate: Math.round((exits / totalVisits) * 100) };
    })
    .sort((a, b) => b.exits - a.exits)
    .slice(0, 10);

  const totalSessions = sessionPages.size;

  return Response.json({ transitions, topPaths, exitPages, totalSessions });
}
