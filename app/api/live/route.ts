/**
 * Kaiseki Analytics - Live Events SSE
 * GET /api/live?projectId=xxx
 */

import { NextRequest } from "next/server";
import { liveEventClients } from "@/app/api/ingest/route";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }

  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;

      if (!liveEventClients.has(projectId)) {
        liveEventClients.set(projectId, []);
      }
      liveEventClients.get(projectId)!.push(controller);

      const connectMsg = `data: ${JSON.stringify({ type: "connected", projectId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connectMsg));

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30_000);
    },
    cancel() {
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
      "X-Accel-Buffering": "no",
    },
  });
}
