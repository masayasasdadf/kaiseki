import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateSecretKey } from "@/lib/utils";

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const projects = await db.project.findMany({
    select: {
      id: true,
      name: true,
      publicKey: true,
      createdAt: true,
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ projects });
}

export async function POST(req: NextRequest) {
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
