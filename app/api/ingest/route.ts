/**
 * Kaiseki Analytics - Ingest API
 *
 * POST /api/ingest
 *
 * セキュリティ:
 * - Rate limiting（IPベース、インメモリ）
 * - CORS（allowedDomains チェック）
 * - PII除外
 * - 入力バリデーション（Zod）
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { classifyChannel } from "@/lib/attribution";
import { sanitizePII, detectDevice, detectBrowser, detectOS } from "@/lib/utils";

// ========== Rate Limiting ==========

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 100; // リクエスト数
const RATE_LIMIT_WINDOW = 60 * 1000; // 1分

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;

  entry.count++;
  return true;
}

// メモリリーク防止のため定期的にクリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore.entries()) {
    if (now > val.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ========== バリデーションスキーマ ==========

const attributionSchema = z.object({
  landingUrl: z.string().max(2048).nullable().optional(),
  landingPath: z.string().max(512).nullable().optional(),
  referrer: z.string().max(2048).nullable().optional(),
  utmSource: z.string().max(255).nullable().optional(),
  utmMedium: z.string().max(255).nullable().optional(),
  utmCampaign: z.string().max(255).nullable().optional(),
  utmContent: z.string().max(255).nullable().optional(),
  utmTerm: z.string().max(255).nullable().optional(),
  gclid: z.string().max(255).nullable().optional(),
  wbraid: z.string().max(255).nullable().optional(),
  gbraid: z.string().max(255).nullable().optional(),
  fbclid: z.string().max(255).nullable().optional(),
});

const ingestSchema = z.object({
  projectKey: z.string().min(1).max(255),
  visitorId: z.string().min(1).max(255),
  sessionId: z.string().min(1).max(255),
  eventType: z.enum([
    "session_start",
    "page_view",
    "engagement_ping",
    "scroll_depth",
    "cta_click",
    "conversion",
    "custom",
  ]),
  eventName: z.string().max(255).optional(),
  conversionName: z.string().max(255).optional(),
  path: z.string().max(2048).optional(),
  timestamp: z.string().datetime().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  attribution: attributionSchema.optional(),
});

// ========== Live Events（SSE）用のグローバルストア ==========

export const liveEventClients = new Map<
  string,
  ReadableStreamDefaultController[]
>();

function broadcastLiveEvent(projectId: string, event: object) {
  const controllers = liveEventClients.get(projectId);
  if (!controllers || controllers.length === 0) return;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  const deadControllers: ReadableStreamDefaultController[] = [];

  for (const controller of controllers) {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch {
      deadControllers.push(controller);
    }
  }

  // 死んだ接続を削除
  if (deadControllers.length > 0) {
    liveEventClients.set(
      projectId,
      controllers.filter((c) => !deadControllers.includes(c))
    );
  }
}

// ========== CORS ヘルパー ==========

function getCORSHeaders(origin: string | null, allowedDomains: string[]): Headers {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");

  if (allowedDomains.length === 0 || !origin) {
    headers.set("Access-Control-Allow-Origin", "*");
  } else {
    const isAllowed = allowedDomains.some((domain) => {
      try {
        const originHost = new URL(origin).hostname;
        return originHost === domain || originHost.endsWith(`.${domain}`);
      } catch {
        return false;
      }
    });
    headers.set(
      "Access-Control-Allow-Origin",
      isAllowed ? origin : "null"
    );
  }

  return headers;
}

// ========== メインハンドラ ==========

export async function OPTIONS(req: NextRequest) {
  // プリフライトリクエスト処理
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: NextRequest) {
  // Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      }
    );
  }

  // リクエストボディをパース
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // バリデーション
  const parsed = ingestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // プロジェクト取得
  const project = await db.project.findUnique({
    where: { publicKey: data.projectKey },
  });

  if (!project) {
    return Response.json({ error: "Invalid project key" }, { status: 401 });
  }

  // IP除外チェック
  if (project.excludedIps.includes(ip)) {
    return Response.json({ ok: true }); // サイレントに無視
  }

  // CORS ヘッダー
  const origin = req.headers.get("origin");
  const corsHeaders = getCORSHeaders(origin, project.allowedDomains);

  // User-Agent 解析
  const ua = req.headers.get("user-agent") || "";
  const device = detectDevice(ua);
  const browser = detectBrowser(ua);
  const os = detectOS(ua);

  const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();

  try {
    switch (data.eventType) {
      case "session_start": {
        const attr = data.attribution || {};
        const channelGroup = classifyChannel({
          utmSource: attr.utmSource,
          utmMedium: attr.utmMedium,
          utmCampaign: attr.utmCampaign,
          gclid: attr.gclid,
          fbclid: attr.fbclid,
          referrer: attr.referrer,
        });

        await db.session.upsert({
          where: { sessionId: data.sessionId },
          create: {
            projectId: project.id,
            visitorId: data.visitorId,
            sessionId: data.sessionId,
            startedAt: timestamp,
            landingUrl: attr.landingUrl,
            landingPath: attr.landingPath,
            referrer: attr.referrer,
            utmSource: attr.utmSource,
            utmMedium: attr.utmMedium,
            utmCampaign: attr.utmCampaign,
            utmContent: attr.utmContent,
            utmTerm: attr.utmTerm,
            gclid: attr.gclid,
            fbclid: attr.fbclid,
            channelGroup,
            device,
            browser,
            os,
          },
          update: {},
        });

        broadcastLiveEvent(project.id, {
          type: "session_start",
          sessionId: data.sessionId,
          channelGroup,
          path: attr.landingPath,
          timestamp: timestamp.toISOString(),
        });
        break;
      }

      case "page_view": {
        // セッションのpageview数を増やす
        await db.session.update({
          where: { sessionId: data.sessionId },
          data: { pageviewCount: { increment: 1 } },
        }).catch(() => {}); // セッションが存在しない場合は無視

        await db.pageView.create({
          data: {
            projectId: project.id,
            sessionId: data.sessionId,
            visitorId: data.visitorId,
            path: data.path || "/",
            title: (data.props as { title?: string } | undefined)?.title,
            timestamp,
          },
        });

        await db.event.create({
          data: {
            projectId: project.id,
            sessionId: data.sessionId,
            visitorId: data.visitorId,
            eventType: "page_view",
            path: data.path,
            props: data.props ? sanitizePII(data.props as Record<string, unknown>) as Prisma.InputJsonValue : undefined,
            timestamp,
          },
        });

        broadcastLiveEvent(project.id, {
          type: "page_view",
          sessionId: data.sessionId,
          path: data.path,
          timestamp: timestamp.toISOString(),
        });
        break;
      }

      case "engagement_ping": {
        // セッションをエンゲージド状態に更新
        await db.session.update({
          where: { sessionId: data.sessionId },
          data: {
            engaged: true,
            bounced: false,
            duration: {
              increment: 10, // 10秒ごとのping
            },
          },
        }).catch(() => {});
        break;
      }

      case "scroll_depth": {
        const percent = (data.props as { percent?: number } | undefined)?.percent ?? 0;

        // 最大スクロール更新
        const session = await db.session.findUnique({
          where: { sessionId: data.sessionId },
          select: { maxScroll: true, id: true },
        });

        if (session && percent > session.maxScroll) {
          const engaged = percent >= 25;
          await db.session.update({
            where: { sessionId: data.sessionId },
            data: {
              maxScroll: percent,
              ...(engaged ? { engaged: true, bounced: false } : {}),
            },
          });
        }

        await db.event.create({
          data: {
            projectId: project.id,
            sessionId: data.sessionId,
            visitorId: data.visitorId,
            eventType: "scroll_depth",
            path: data.path,
            props: { percent } as Prisma.InputJsonValue,
            timestamp,
          },
        });
        break;
      }

      case "cta_click": {
        const sanitizedProps: Prisma.InputJsonValue = sanitizePII(
          (data.props as Record<string, unknown>) || {}
        ) as Prisma.InputJsonValue;

        await db.event.create({
          data: {
            projectId: project.id,
            sessionId: data.sessionId,
            visitorId: data.visitorId,
            eventType: "cta_click",
            path: data.path,
            props: sanitizedProps,
            timestamp,
          },
        });

        // CTAクリックはengagedとみなす
        await db.session.update({
          where: { sessionId: data.sessionId },
          data: { engaged: true, bounced: false },
        }).catch(() => {});

        broadcastLiveEvent(project.id, {
          type: "cta_click",
          sessionId: data.sessionId,
          path: data.path,
          props: sanitizedProps,
          timestamp: timestamp.toISOString(),
        });
        break;
      }

      case "conversion": {
        const convName = data.conversionName || "unknown";
        const sanitizedProps: Prisma.InputJsonValue = sanitizePII(
          (data.props as Record<string, unknown>) || {}
        ) as Prisma.InputJsonValue;

        // 重複除外: 同セッション×同名CVは1回のみ
        const existingConv = await db.conversion.findFirst({
          where: {
            sessionId: data.sessionId,
            conversionName: convName,
          },
        });

        if (!existingConv) {
          await db.conversion.create({
            data: {
              projectId: project.id,
              sessionId: data.sessionId,
              visitorId: data.visitorId,
              conversionName: convName,
              path: data.path,
              props: sanitizedProps,
              timestamp,
            },
          });

          broadcastLiveEvent(project.id, {
            type: "conversion",
            sessionId: data.sessionId,
            conversionName: convName,
            path: data.path,
            timestamp: timestamp.toISOString(),
          });
        }
        break;
      }

      case "custom": {
        const sanitizedProps: Prisma.InputJsonValue = sanitizePII(
          (data.props as Record<string, unknown>) || {}
        ) as Prisma.InputJsonValue;

        await db.event.create({
          data: {
            projectId: project.id,
            sessionId: data.sessionId,
            visitorId: data.visitorId,
            eventType: "custom",
            eventName: data.eventName,
            path: data.path,
            props: sanitizedProps,
            timestamp,
          },
        });

        broadcastLiveEvent(project.id, {
          type: "custom",
          eventName: data.eventName,
          sessionId: data.sessionId,
          path: data.path,
          timestamp: timestamp.toISOString(),
        });
        break;
      }
    }

    // URL一致のCV自動判定
    if (data.eventType === "page_view" && data.path) {
      await checkUrlConversionRules(project.id, data.sessionId, data.visitorId, data.path, timestamp);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("[Ingest] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

// ========== URLベースCV自動判定 ==========

async function checkUrlConversionRules(
  projectId: string,
  sessionId: string,
  visitorId: string,
  path: string,
  timestamp: Date
) {
  const rules = await db.trackingRule.findMany({
    where: { projectId, type: "url_match", active: true },
  });

  for (const rule of rules) {
    const config = rule.config as { pattern?: string; matchType?: string };
    const pattern = config.pattern;
    const matchType = config.matchType || "contains";

    if (!pattern) continue;

    let matched = false;
    if (matchType === "equals") {
      matched = path === pattern;
    } else if (matchType === "contains") {
      matched = path.includes(pattern);
    } else if (matchType === "starts_with") {
      matched = path.startsWith(pattern);
    } else if (matchType === "regex") {
      try {
        matched = new RegExp(pattern).test(path);
      } catch {
        continue;
      }
    }

    if (matched) {
      // 重複除外
      const existing = await db.conversion.findFirst({
        where: { sessionId, conversionName: rule.name },
      });
      if (!existing) {
        await db.conversion.create({
          data: {
            projectId,
            sessionId,
            visitorId,
            trackingRuleId: rule.id,
            conversionName: rule.name,
            path,
            timestamp,
          },
        });
      }
    }
  }
}
