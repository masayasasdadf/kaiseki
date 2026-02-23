/**
 * やさしいモード設定を更新するAPI
 * PATCH /api/projects/:projectId/easy-mode
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const schema = z.object({
  easyMode: z.boolean(),
});

export async function PATCH(req: NextRequest) {
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { easyMode: parsed.data.easyMode },
  });

  return Response.json({ ok: true });
}
