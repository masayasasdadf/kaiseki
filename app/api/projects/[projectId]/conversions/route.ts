/**
 * Kaiseki Analytics - Conversion Rules API
 *
 * GET/POST /api/projects/:projectId/conversions
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const urlMatchConfig = z.object({
  matchType: z.enum(["equals", "contains", "starts_with", "regex"]),
  pattern: z.string().min(1).max(512),
});

const clickConfig = z.object({
  selector: z.string().min(1).max(512),
});

const formConfig = z.object({
  selector: z.string().min(1).max(512),
});

const createRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("url_match"),
    name: z.string().min(1).max(100),
    config: urlMatchConfig,
  }),
  z.object({
    type: z.literal("click"),
    name: z.string().min(1).max(100),
    config: clickConfig,
  }),
  z.object({
    type: z.literal("form_submit"),
    name: z.string().min(1).max(100),
    config: formConfig,
  }),
]);

async function verifyAccess(projectId: string, userId: string, roles?: string[]) {
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) return null;
  if (roles && !roles.includes(member.role)) return null;
  return member;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const member = await verifyAccess(projectId, session.user.id);
  if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });

  const rules = await db.trackingRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ rules });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const member = await verifyAccess(projectId, session.user.id, [
    "owner",
    "admin",
  ]);
  if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });

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
      config: parsed.data.config,
    },
  });

  // 監査ログ
  await db.auditLog.create({
    data: {
      projectId,
      trackingRuleId: rule.id,
      action: "created",
      actorEmail: session.user.email ?? undefined,
      details: { rule: parsed.data },
    },
  });

  return Response.json({ rule }, { status: 201 });
}
