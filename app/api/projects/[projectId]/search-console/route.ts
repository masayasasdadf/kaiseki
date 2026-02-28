/**
 * Kaiseki Analytics - Search Console API
 * GET  /api/projects/:projectId/search-console          → 接続状態 + 検索データ
 * POST /api/projects/:projectId/search-console          → プロパティ選択を保存
 * DELETE /api/projects/:projectId/search-console        → 連携を解除
 * GET  /api/projects/:projectId/search-console?sites=1 → 利用可能なプロパティ一覧
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

// リフレッシュトークンからアクセストークンを取得
async function getAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh access token");
  const data = await res.json();
  return data.access_token as string;
}

// プロパティ一覧を取得
async function fetchSites(accessToken: string): Promise<string[]> {
  const res = await fetch(
    "https://searchconsole.googleapis.com/webmasters/v3/sites",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (
    (data.siteEntry as Array<{ siteUrl: string }> | undefined)?.map(
      (s) => s.siteUrl
    ) ?? []
  );
}

// 検索アナリティクスデータを取得
async function fetchSearchAnalytics(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string
) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 20,
        orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
      }),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (
    (
      data.rows as Array<{
        keys: string[];
        clicks: number;
        impressions: number;
        ctr: number;
        position: number;
      }>
    ) ?? []
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      searchConsoleProperty: true,
      searchConsoleRefreshToken: true,
    },
  });

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const connected = !!project.searchConsoleRefreshToken;
  const property = project.searchConsoleProperty;

  // プロパティ一覧モード
  if (req.nextUrl.searchParams.get("sites") === "1" && connected) {
    try {
      const token = await getAccessToken(project.searchConsoleRefreshToken!);
      const sites = await fetchSites(token);
      return Response.json({ sites });
    } catch {
      return Response.json({ error: "サイト一覧の取得に失敗しました" }, { status: 502 });
    }
  }

  // 接続状態のみ返す
  if (!connected || !property) {
    return Response.json({ connected, property: null, rows: [] });
  }

  // 検索データを取得
  const range = req.nextUrl.searchParams.get("range") || "30d";
  const to = new Date();
  const from = new Date();
  if (range === "7d") from.setDate(from.getDate() - 7);
  else if (range === "90d") from.setDate(from.getDate() - 90);
  else from.setDate(from.getDate() - 30);

  const fmt = (d: Date) => d.toISOString().split("T")[0];

  try {
    const token = await getAccessToken(project.searchConsoleRefreshToken!);
    const rows = await fetchSearchAnalytics(token, property, fmt(from), fmt(to));
    return Response.json({ connected: true, property, rows });
  } catch {
    return Response.json({ error: "データ取得に失敗しました" }, { status: 502 });
  }
}

// プロパティを保存
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { property } = await req.json();
  if (!property) return Response.json({ error: "property が必要です" }, { status: 400 });

  await db.project.update({
    where: { id: projectId },
    data: { searchConsoleProperty: property },
  });

  return Response.json({ ok: true });
}

// 連携を解除
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  await db.project.update({
    where: { id: projectId },
    data: { searchConsoleProperty: null, searchConsoleRefreshToken: null },
  });

  return Response.json({ ok: true });
}
