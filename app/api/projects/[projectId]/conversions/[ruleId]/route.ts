/**
 * Kaiseki Analytics - Conversion Rule Detail API
 * DELETE /api/projects/:projectId/conversions/:ruleId
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; ruleId: string }> }
) {
  const { projectId, ruleId } = await params;

  const rule = await db.trackingRule.findFirst({
    where: { id: ruleId, projectId },
  });

  if (!rule) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  await db.trackingRule.delete({ where: { id: ruleId } });

  await db.auditLog.create({
    data: {
      projectId,
      action: "deleted",
      details: { ruleName: rule.name, ruleType: rule.type },
    },
  });

  return Response.json({ ok: true });
}
