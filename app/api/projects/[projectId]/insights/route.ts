/**
 * Kaiseki Analytics - AI Insights API
 * POST /api/projects/:projectId/insights
 *
 * メトリクスデータを受け取り、Claude AIによる日本語解説を返す
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { getDateRange, type DateRange } from "@/lib/utils";

const client = new Anthropic();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY が設定されていません" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const range = (body.range || "30d") as DateRange;
  const { from, to } = getDateRange(range);

  const periodLength = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - periodLength);
  const prevTo = from;

  const [project, sessions, conversions, prevSessions, prevConversions] =
    await Promise.all([
      db.project.findUnique({ where: { id: projectId }, select: { name: true } }),
      db.session.findMany({
        where: { projectId, startedAt: { gte: from, lte: to } },
        select: {
          engaged: true,
          bounced: true,
          duration: true,
          channelGroup: true,
          landingPath: true,
          device: true,
          utmCampaign: true,
          utmSource: true,
        },
      }),
      db.conversion.findMany({
        where: { projectId, timestamp: { gte: from, lte: to } },
        select: { conversionName: true },
      }),
      db.session.count({ where: { projectId, startedAt: { gte: prevFrom, lte: prevTo } } }),
      db.conversion.count({ where: { projectId, timestamp: { gte: prevFrom, lte: prevTo } } }),
    ]);

  const totalSessions = sessions.length;
  const totalConversions = conversions.length;
  const bouncedSessions = sessions.filter((s) => s.bounced).length;
  const engagedSessions = sessions.filter((s) => s.engaged).length;
  const cvr = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
  const bounceRate = totalSessions > 0 ? (bouncedSessions / totalSessions) * 100 : 0;
  const engagementRate = totalSessions > 0 ? (engagedSessions / totalSessions) * 100 : 0;
  const avgDuration =
    totalSessions > 0
      ? Math.round(sessions.reduce((sum, s) => sum + s.duration, 0) / totalSessions)
      : 0;

  const sessionChange =
    prevSessions > 0
      ? Math.round(((totalSessions - prevSessions) / prevSessions) * 100)
      : null;
  const cvChange =
    prevConversions > 0
      ? Math.round(((totalConversions - prevConversions) / prevConversions) * 100)
      : null;

  // チャネル別集計
  const channelMap = new Map<string, number>();
  for (const s of sessions) {
    channelMap.set(s.channelGroup, (channelMap.get(s.channelGroup) || 0) + 1);
  }
  const topChannels =
    totalSessions > 0
      ? Array.from(channelMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({
            name,
            sessionCount: count,
            share: Math.round((count / totalSessions) * 100),
          }))
      : [];

  // LP別直帰率
  const lpMap = new Map<string, { lpSessions: number; bounced: number }>();
  for (const s of sessions) {
    const lp = s.landingPath || "/";
    if (!lpMap.has(lp)) lpMap.set(lp, { lpSessions: 0, bounced: 0 });
    const entry = lpMap.get(lp)!;
    entry.lpSessions++;
    if (s.bounced) entry.bounced++;
  }
  const topLandingPages = Array.from(lpMap.entries())
    .sort((a, b) => b[1].lpSessions - a[1].lpSessions)
    .slice(0, 5)
    .map(([path, data]) => ({
      path,
      sessions: data.lpSessions,
      bounceRate: data.lpSessions > 0 ? Math.round((data.bounced / data.lpSessions) * 100) : 0,
    }));

  // デバイス別
  const deviceMap = new Map<string, number>();
  for (const s of sessions) {
    deviceMap.set(s.device || "unknown", (deviceMap.get(s.device || "unknown") || 0) + 1);
  }
  const deviceBreakdown = Array.from(deviceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => ({ device, share: Math.round((count / totalSessions) * 100) }));

  // CV名別
  const cvNameMap = new Map<string, number>();
  for (const c of conversions) {
    cvNameMap.set(c.conversionName, (cvNameMap.get(c.conversionName) || 0) + 1);
  }
  const topConversions = Array.from(cvNameMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  const rangeLabel = range === "7d" ? "7日間" : range === "30d" ? "30日間" : range === "90d" ? "90日間" : range;

  const dataContext = `
## ${project?.name ?? "サイト"} の分析データ（直近${rangeLabel}）

### KPI
- セッション数: ${totalSessions.toLocaleString()}（前期比: ${sessionChange !== null ? `${sessionChange > 0 ? "+" : ""}${sessionChange}%` : "比較データなし"}）
- CV数: ${totalConversions.toLocaleString()}（前期比: ${cvChange !== null ? `${cvChange > 0 ? "+" : ""}${cvChange}%` : "比較データなし"}）
- CVR: ${cvr.toFixed(2)}%
- 直帰率: ${bounceRate.toFixed(1)}%
- エンゲージメント率: ${engagementRate.toFixed(1)}%
- 平均セッション時間: ${avgDuration}秒

### チャネル別セッション構成
${topChannels.map((c) => `- ${c.name}: ${c.sessionCount}セッション（${c.share}%）`).join("\n")}

### 上位ランディングページ（直帰率付き）
${topLandingPages.map((p) => `- ${p.path}: ${p.sessions}セッション、直帰率${p.bounceRate}%`).join("\n")}

### デバイス構成
${deviceBreakdown.map((d) => `- ${d.device}: ${d.share}%`).join("\n")}

${topConversions.length > 0 ? `### CV内訳\n${topConversions.map((c) => `- ${c.name}: ${c.count}件`).join("\n")}` : ""}
`.trim();

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `あなたはWebマーケティングのアナリストです。以下のアクセス解析データを分析し、マーケターに向けた実用的なインサイトを日本語で提供してください。

${dataContext}

以下の形式でJSON配列を返してください。他のテキストは不要です。

[
  {
    "type": "positive" | "warning" | "neutral",
    "title": "インサイトのタイトル（20文字以内）",
    "body": "具体的な分析と改善提案（100〜150文字）"
  }
]

条件:
- インサイトは3〜5個
- typeは positive（良い点）、warning（改善点）、neutral（観察事項）のいずれか
- データが少ない場合（セッション数が100未満など）はその旨も含めてください
- 具体的な数値を引用して根拠を示してください`,
      },
    ],
  });

  const raw =
    message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

  // JSONブロックを抽出
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return Response.json({ insights: [], raw }, { status: 200 });
  }

  const insights = JSON.parse(jsonMatch[0]);

  return Response.json({ insights, generatedAt: new Date().toISOString() });
}
