import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  allowedDomains: z.array(z.string()).optional(),
  excludedIps: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      publicKey: true,
      secretKey: true,
      allowedDomains: true,
      excludedIps: true,
      createdAt: true,
    },
  });

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json({
    project: {
      ...project,
      allowedDomains: JSON.parse(project.allowedDomains) as string[],
      excludedIps: JSON.parse(project.excludedIps) as string[],
    },
  });
}

export async function PATCH(
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

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.allowedDomains !== undefined) {
    updateData.allowedDomains = JSON.stringify(parsed.data.allowedDomains);
  }
  if (parsed.data.excludedIps !== undefined) {
    updateData.excludedIps = JSON.stringify(parsed.data.excludedIps);
  }

  const project = await db.project.update({
    where: { id: projectId },
    data: updateData,
    select: {
      id: true,
      name: true,
      publicKey: true,
      allowedDomains: true,
      excludedIps: true,
    },
  });

  return Response.json({
    project: {
      ...project,
      allowedDomains: JSON.parse(project.allowedDomains) as string[],
      excludedIps: JSON.parse(project.excludedIps) as string[],
    },
  });
}
