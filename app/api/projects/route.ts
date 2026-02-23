import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSecretKey } from "@/lib/utils";

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db.projectMember.findMany({
    where: { userId: session.user.id },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          publicKey: true,
          createdAt: true,
          allowedDomains: true,
          _count: {
            select: { sessions: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({
    projects: memberships.map((m) => ({
      ...m.project,
      role: m.role,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const project = await db.project.create({
    data: {
      name: parsed.data.name,
      secretKey: generateSecretKey(),
      members: {
        create: {
          userId: session.user.id,
          role: "owner",
        },
      },
    },
    select: {
      id: true,
      name: true,
      publicKey: true,
      secretKey: true,
      createdAt: true,
    },
  });

  return Response.json({ project }, { status: 201 });
}
