/**
 * Kaiseki Analytics - AI Insights API
 * POST /api/projects/:projectId/insights
 *
 * 4段階分析：問題言語化 → 原因仮説 → データ支持 → 優先度付き改善案+インパクト
 */

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { getDateRange, type DateRange } from "@/lib/utils";

const client = new OpenAI();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY が設定されていません" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const range = (body.range || "30d") as DateRange;
  const searchRows: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }> = Array.isArray(body.searchRows) ? body.searchRows : [];
  const { from, to } = getDateRange(range);

  const periodLength = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - periodLength);
  const prevTo = from;

  const [project, sessions, conversions, hesitationEvents, prevSessions, prevConversions] =
    await Promise.all([
      db.project.findUnique({ where: { id: projectId }, select: { name: true } }),
      db.session.findMany({
        where: { projectId, startedAt: { gte: from, lte: to } },
        select: {
          sessionId: true,
          engaged: true,
          bounced: true,
          duration: true,
          maxScroll: true,
          channelGroup: true,
          landingPath: true,
          device: true,
          utmCampaign: true,
          utmSource: true,
        },
      }),
      db.conversion.findMany({
        where: { projectId, timestamp: { gte: from, lte: to } },
        select: { conversionName: true, sessionId: true },
      }),
      // 意思決定シグナル
      db.event.findMany({
        where: {
          projectId,
          eventType: {
            in: ["cta_impression", "cta_hover_no_click", "content_toggle", "tab_switch"],
          },
          timestamp: { gte: from, lte: to },
        },
        select: { eventType: true },
      }),
      db.session.count({ where: { projectId, startedAt: { gte: prevFrom, lte: prevTo } } }),
      db.conversion.count({ where: { projectId, timestamp: { gte: prevFrom, lte: prevTo } } }),
    ]);

  // ===== KPI 計算 =====
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

  // ===== セッション品質分類（成功 / 惜敗 / 失敗）=====
  const convertedSessionIds = new Set(conversions.map((c) => c.sessionId));
  const sessionQuality = { success: 0, near_miss: 0, failure: 0 };
  for (const s of sessions) {
    if (convertedSessionIds.has(s.sessionId)) {
      sessionQuality.success++;
    } else if (s.duration >= 120 || s.maxScroll >= 80) {
      // 惜敗: 高エンゲージなのにCV未達
      sessionQuality.near_miss++;
    } else {
      sessionQuality.failure++;
    }
  }

  // ===== 意思決定シグナル集計 =====
  const ctaImpressions = hesitationEvents.filter((e) => e.eventType === "cta_impression").length;
  const ctaHesitations = hesitationEvents.filter((e) => e.eventType === "cta_hover_no_click").length;
  const contentToggles = hesitationEvents.filter((e) => e.eventType === "content_toggle").length;
  const tabSwitches = hesitationEvents.filter((e) => e.eventType === "tab_switch").length;
  const hesitationRate =
    ctaImpressions > 0 ? Math.round((ctaHesitations / ctaImpressions) * 100) : null;

  // ===== チャネル別集計 =====
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

  // ===== LP別直帰率 =====
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

  // ===== デバイス別 =====
  const deviceMap = new Map<string, number>();
  for (const s of sessions) {
    deviceMap.set(s.device || "unknown", (deviceMap.get(s.device || "unknown") || 0) + 1);
  }
  const deviceBreakdown = Array.from(deviceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => ({ device, share: Math.round((count / totalSessions) * 100) }));

  // ===== CV名別 =====
  const cvNameMap = new Map<string, number>();
  for (const c of conversions) {
    cvNameMap.set(c.conversionName, (cvNameMap.get(c.conversionName) || 0) + 1);
  }
  const topConversions = Array.from(cvNameMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  // ===== 検索クエリの意図分類 =====
  const classifyQueryIntent = (query: string): string => {
    const q = query.toLowerCase();
    if (/申込|見積|料金|価格|購入|注文|buy|いくら|費用/.test(q)) return "購入直前型";
    if (/比較|おすすめ|ランキング|vs|違い|どっち|選び方/.test(q)) return "比較検討型";
    return "情報収集型";
  };

  const classifiedQueries = searchRows.slice(0, 10).map((r) => ({
    query: r.keys[0],
    intent: classifyQueryIntent(r.keys[0]),
    clicks: r.clicks,
    ctr: (r.ctr * 100).toFixed(1),
    position: r.position.toFixed(1),
  }));

  const rangeLabel =
    range === "7d" ? "7日間" : range === "30d" ? "30日間" : range === "90d" ? "90日間" : range;

  const dataContext = `
## ${project?.name ?? "サイト"} の分析データ（直近${rangeLabel}）

### KPI
- セッション数: ${totalSessions.toLocaleString()}（前期比: ${sessionChange !== null ? `${sessionChange > 0 ? "+" : ""}${sessionChange}%` : "比較データなし"}）
- CV数: ${totalConversions.toLocaleString()}（前期比: ${cvChange !== null ? `${cvChange > 0 ? "+" : ""}${cvChange}%` : "比較データなし"}）
- CVR: ${cvr.toFixed(2)}%
- 直帰率: ${bounceRate.toFixed(1)}%
- エンゲージメント率: ${engagementRate.toFixed(1)}%
- 平均セッション時間: ${avgDuration}秒

### セッション品質分類
- 成功（CV達成）: ${sessionQuality.success}件（${totalSessions > 0 ? Math.round((sessionQuality.success / totalSessions) * 100) : 0}%）
- 惜敗（高エンゲージだがCV未達）: ${sessionQuality.near_miss}件（${totalSessions > 0 ? Math.round((sessionQuality.near_miss / totalSessions) * 100) : 0}%）※ 滞在120秒超 or スクロール80%超
- 失敗（離脱）: ${sessionQuality.failure}件（${totalSessions > 0 ? Math.round((sessionQuality.failure / totalSessions) * 100) : 0}%）

### CTA 意思決定シグナル
${ctaImpressions > 0 ? `- CTAインプレッション: ${ctaImpressions}回
- CTAホバー→非クリック（躊躇）: ${ctaHesitations}回（躊躇率: ${hesitationRate}%）
- FAQ/アコーディオン開閉: ${contentToggles}回
- タブ切り替え: ${tabSwitches}回` : "- CTAシグナルデータなし（SDKを最新版に更新すると取得開始）"}

### チャネル別セッション構成
${topChannels.map((c) => `- ${c.name}: ${c.sessionCount}セッション（${c.share}%）`).join("\n")}

### 上位ランディングページ（直帰率付き）
${topLandingPages.map((p) => `- ${p.path}: ${p.sessions}セッション、直帰率${p.bounceRate}%`).join("\n")}

### デバイス構成
${deviceBreakdown.map((d) => `- ${d.device}: ${d.share}%`).join("\n")}

${topConversions.length > 0 ? `### CV内訳\n${topConversions.map((c) => `- ${c.name}: ${c.count}件`).join("\n")}` : ""}

${
  classifiedQueries.length > 0
    ? `### 検索キーワード（意図分類済み）
${classifiedQueries.map((r) => `- [${r.intent}] "${r.query}": クリック${r.clicks}、CTR${r.ctr}%、順位${r.position}位`).join("\n")}`
    : ""
}
`.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 2500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "あなたはWebマーケティングの上級アナリストです。提供されたアクセス解析データを構造的に分析し、必ずJSON形式のみで返答してください。",
      },
      {
        role: "user",
        content: `以下のアクセス解析データを4段階で分析してください。

${dataContext}

---
【分析の4段階】

STEP1: 問題の言語化（どこで・誰が・何を見て・何をしなかったか）
STEP2: 原因仮説（2〜3個。情報不足/信頼不足/比較不安/価格不安/行動コストから選択）
STEP3: 仮説を支持するデータ（各仮説に対してデータの数値を根拠として示す）
STEP4: 優先度付き改善案（3〜5個、priority: high→medium→lowの順）

---
【出力形式】以下のJSONのみを返してください（他のテキスト不要）

{
  "problem_summary": "問題の1文要約（50文字以内）",
  "root_cause_hypotheses": [
    {
      "cause": "情報不足|信頼不足|比較不安|価格不安|行動コスト",
      "evidence": "根拠となるデータの具体的数値（例：惜敗率XX%、躊躇率XX%）",
      "confidence": "high|medium|low"
    }
  ],
  "improvements": [
    {
      "title": "改善案タイトル（20文字以内）",
      "description": "具体的な実施内容（80文字以内）",
      "affected_segment": "影響ユーザー層（例：PCユーザー、離脱直前ユーザー）",
      "affected_metric": "CVR|CTR|直帰率|滞在時間|エンゲージメント率",
      "expected_impact": "例: CVR+3〜8%改善見込み",
      "implementation_cost": "low|medium|high",
      "validation_method": "A/Bテスト|ビフォーアフター|ユーザーインタビュー",
      "priority": "high|medium|low"
    }
  ],
  "insights": [
    {
      "type": "positive|warning|neutral",
      "title": "タイトル（20文字以内）",
      "body": "具体的な数値を含む分析（100〜150文字）"
    }
  ]
}

条件:
- 全て日本語
- improvements は priority: high → medium → low の順で並べる
- データが少ない（100セッション未満）場合はその旨を各フィールドに反映
- 「惜敗セッション」が多い場合は必ずその原因仮説を含めること
${searchRows.length > 0 ? "- 検索キーワードの意図分類と流入意図とLPの対応ギャップを必ず分析すること" : ""}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: {
    problem_summary?: string;
    root_cause_hypotheses?: Array<{ cause: string; evidence: string; confidence: string }>;
    improvements?: Array<{
      title: string;
      description: string;
      affected_segment: string;
      affected_metric: string;
      expected_impact: string;
      implementation_cost: string;
      validation_method: string;
      priority: string;
    }>;
    insights?: Array<{ type: string; title: string; body: string }>;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return Response.json({
    problem_summary: parsed.problem_summary ?? null,
    root_cause_hypotheses: Array.isArray(parsed.root_cause_hypotheses)
      ? parsed.root_cause_hypotheses
      : [],
    improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    sessionQuality,
    hesitationSignals: { ctaImpressions, ctaHesitations, hesitationRate, contentToggles, tabSwitches },
    generatedAt: new Date().toISOString(),
  });
}
