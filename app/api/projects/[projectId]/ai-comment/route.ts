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

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 700,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "あなたはWebマーケティングの上級アナリストです。提供されたデータを分析し、マーケターへの実用的な改善提案をJSON形式のみで返してください。",
      },
      {
        role: "user",
        content: `以下の${label ?? "分析"}データを見て、最も重要な改善ポイントを2〜3個指摘してください。

${context}

以下のJSONのみを返してください（前後のテキスト不要）:
{
  "insights": [
    {
      "type": "positive|warning|neutral",
      "title": "タイトル（20文字以内）",
      "body": "具体的な数値を含む分析と改善提案（80〜130文字）"
    }
  ]
}

条件:
- 2〜3個のみ
- データの中で最も差が大きい/改善インパクトが高いポイントを優先
- 具体的な数値を必ず引用する
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
