/**
 * Kaiseki Analytics - AI Page Comment API
 * POST /api/projects/:projectId/ai-comment
 *
 * 各分析ページのデータを受け取り、2〜3個の改善インサイトを返す
 */

import { NextRequest } from "next/server";
import OpenAI from "openai";
import { db } from "@/lib/db";

const client = new OpenAI();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY が設定されていません" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const { context, label } = body as { context?: string; label?: string };

  if (!context) {
    return Response.json({ error: "context is required" }, { status: 400 });
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  // ページ種別ごとに特化した分析観点を追加
  const labelGuide: Record<string, string> = {
    "動線分析": `- 入口から最終ページまでの主要な経路を特定し、想定外の離脱ポイントを指摘すること
- 遷移数が多いパスと少ないパスの差が示す問題を分析すること
- 出口ページとして多いページの改善施策を具体的に提案すること`,
    "セグメント比較": `- CVRが最も高いセグメントと最低のセグメントの差を数値で示し、その原因を仮説立てること
- 改善インパクトが最も大きいセグメント（シェアが大きくCVRが低い）を優先して提案すること
- デバイス別とチャネル別でそれぞれ最重要な発見を1つずつ挙げること`,
    "ファネル分析": `- 最大の離脱ポイントを特定し、そのページで何が起きているか仮説を示すこと
- ゴール到達率を改善するための最優先アクションを1つ具体的に提案すること
- 離脱率が高いステップに対してA/Bテスト案など即実行できる改善策を含めること`,
  };

  const extraGuide = labelGuide[label ?? ""] ?? "- データの中で最も差が大きく、改善インパクトが高いポイントを優先すること";

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "あなたはWebマーケティングの上級アナリストです。提供されたデータを構造的に分析し、マーケターへの実用的な改善提案をJSON形式のみで返してください。",
      },
      {
        role: "user",
        content: `以下の${label ?? "分析"}データを分析し、最も重要な改善インサイトを2〜3個指摘してください。

${context}

【分析観点】
${extraGuide}

以下のJSONのみを返してください（前後のテキスト不要）:
{
  "insights": [
    {
      "type": "positive|warning|neutral",
      "title": "タイトル（20文字以内）",
      "body": "具体的な数値を引用した分析と改善提案（100〜150文字）"
    }
  ]
}

条件:
- 2〜3個のみ（最重要なものに絞る）
- 具体的な数値・パーセンテージを必ず引用する
- 改善提案は実行可能な具体的アクションを含める
- 全て日本語`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: { insights?: unknown[] } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return Response.json({
    insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    generatedAt: new Date().toISOString(),
  });
}
