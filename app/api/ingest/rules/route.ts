/**
 * Kaiseki Analytics - CV Rules Public API
 * GET /api/ingest/rules?k=PROJECT_KEY
 *
 * click/form_submit タイプのアクティブなCVルールをSDKに返す。
 * レスポンスは60秒キャッシュ可能（公開情報のみ）。
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=60",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k");
  if (!k) {
    return new Response(JSON.stringify({ rules: [] }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const project = await db.project.findUnique({
    where: { publicKey: k },
    select: { id: true },
  });

  if (!project) {
    return new Response(JSON.stringify({ rules: [] }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const rules = await db.trackingRule.findMany({
    where: {
      projectId: project.id,
      type: { in: ["click", "form_submit"] },
      active: true,
    },
    select: { name: true, type: true, config: true },
  });

  return new Response(JSON.stringify({ rules }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
