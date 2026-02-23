/**
 * Kaiseki Analytics - Live Events SSE
 *
 * GET /api/live?projectId=xxx
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { liveEventClients } from "@/app/api/ingest/route";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }

  // プロジェクトアクセス権確認
  const member = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: session.user.id,
      },
    },
  });

  if (!member) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // SSE ストリーム
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;

      // このプロジェクトのクライアントリストに追加
      if (!liveEventClients.has(projectId)) {
        liveEventClients.set(projectId, []);
      }
      liveEventClients.get(projectId)!.push(controller);

      // 接続確認メッセージ
      const connectMsg = `data: ${JSON.stringify({ type: "connected", projectId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectMsg));

      // Keep-alive ping (30秒ごと)
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30_000);
    },
    cancel() {
      // 切断時にクライアントリストから削除
      const clients = liveEventClients.get(projectId);
      if (clients) {
        const idx = clients.indexOf(controller);
        if (idx !== -1) clients.splice(idx, 1);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx用
    },
  });
}
