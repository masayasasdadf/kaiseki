/**
 * Kaiseki Analytics - Conversion Rules API
 * GET/POST /api/projects/:projectId/conversions
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const createRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url_match"),
    name: z.string().min(1).max(100),
    config: z.object({
      matchType: z.enum(["equals", "contains", "starts_with", "regex"]),
      pattern: z.string().min(1).max(512),
    }),
  }),
  z.object({
    type: z.literal("click"),
    name: z.string().min(1).max(100),
    config: z.object({ selector: z.string().min(1).max(512) }),
  }),
  z.object({
    type: z.literal("form_submit"),
    name: z.string().min(1).max(100),
    config: z.object({ selector: z.string().min(1).max(512) }),
  }),
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const rules = await db.trackingRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    rules: rules.map((r) => ({ ...r, config: JSON.parse(r.config) })),
  });
}

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

  const parsed = createRuleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const rule = await db.trackingRule.create({
    data: {
      projectId,
      name: parsed.data.name,
      type: parsed.data.type,
      config: JSON.stringify(parsed.data.config),
    },
  });

  await db.auditLog.create({
    data: {
      projectId,
      trackingRuleId: rule.id,
      action: "created",
      details: JSON.stringify({ rule: parsed.data }),
    },
  });

  return Response.json({ rule: { ...rule, config: JSON.parse(rule.config) } }, { status: 201 });
}
