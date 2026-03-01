/**
 * Kaiseki Analytics - Heatmap API
 * GET /api/projects/:projectId/heatmap?path=/&range=30d
 *
 * パス別クリック座標データを返す
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
  const path = req.nextUrl.searchParams.get("path") || null;
  const { from, to } = getDateRange(range);

  // サイトのベースURL（allowedDomains の先頭から取得）
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { allowedDomains: true },
  });
  const siteUrl = project?.allowedDomains[0]
    ? `https://${project.allowedDomains[0]}`
    : null;

  // クリックデータのあるパス一覧
  const pathGroups = await db.event.groupBy({
    by: ["path"],
    where: {
      projectId,
      eventType: "click",
      timestamp: { gte: from, lte: to },
      path: { not: null },
    },
    _count: { path: true },
    orderBy: { _count: { path: "desc" } },
    take: 30,
  });

  const paths = pathGroups
    .filter((p) => p.path != null)
    .map((p) => ({ path: p.path!, count: p._count.path }));

  const targetPath = path ?? paths[0]?.path ?? null;

  if (!targetPath) {
    return Response.json({ clicks: [], total: 0, paths, siteUrl });
  }

  const events = await db.event.findMany({
    where: {
      projectId,
      eventType: "click",
      path: targetPath,
      timestamp: { gte: from, lte: to },
    },
    select: { props: true },
    take: 5000,
  });

  const clicks = events
    .map((e) => {
      const props = e.props as { x?: number; y?: number } | null;
      if (!props || typeof props.x !== "number" || typeof props.y !== "number") return null;
      return { x: props.x, y: props.y };
    })
    .filter((c): c is { x: number; y: number } => c !== null);

  return Response.json({ clicks, total: clicks.length, paths, siteUrl });
}
