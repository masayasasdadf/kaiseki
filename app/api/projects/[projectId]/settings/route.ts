import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  allowedDomains: z.array(z.string()).optional(),
  excludedIps: z.array(z.string()).optional(),
});

async function verifyOwner(projectId: string, userId: string) {
  return db.projectMember.findFirst({
    where: { projectId, userId, role: { in: ["owner", "admin"] } },
  });
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
  const member = await db.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
  });
  if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      publicKey: true,
      // secretKey は返さない（セキュリティ上）
      allowedDomains: true,
      excludedIps: true,
      createdAt: true,
    },
  });

  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  // オーナーのみ secretKey を返す
  if (member.role === "owner") {
    const full = await db.project.findUnique({
      where: { id: projectId },
      select: { secretKey: true },
    });
    return Response.json({ project: { ...project, secretKey: full?.secretKey } });
  }

  return Response.json({ project });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;
  const member = await verifyOwner(projectId, session.user.id);
  if (!member) return Response.json({ error: "Forbidden" }, { status: 403 });

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

  const project = await db.project.update({
    where: { id: projectId },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      publicKey: true,
      allowedDomains: true,
      excludedIps: true,
    },
  });

  return Response.json({ project });
}
