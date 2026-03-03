/**
 * Kaiseki Analytics - Site Preview Proxy
 * GET /api/projects/:projectId/preview?url=https://example.com/path
 *
 * X-Frame-Options/CSP を取り除いて HTML を返すことで、
 * ヒートマップページでサイトを iframe プレビューできるようにする。
 *
 * 対象 URL はプロジェクトに登録済みドメインのみ許可する（SSRF対策）。
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const rawUrl = req.nextUrl.searchParams.get("url");

  if (!rawUrl) {
    return new Response("Missing url", { status: 400 });
  }

  // URLのパース・バリデーション
  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return new Response("Invalid protocol", { status: 400 });
    }
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  // SSRF対策: プロジェクトに登録されたドメインのみ許可
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { allowedDomains: true },
  });

  if (!project) {
    return new Response("Project not found", { status: 404 });
  }

  const targetHostname = targetUrl.hostname.replace(/^www\./, "");
  const isAllowed = project.allowedDomains.some((domain) => {
    const d = domain.replace(/^www\./, "");
    return targetHostname === d || targetHostname.endsWith(`.${d}`);
  });

  if (!isAllowed) {
    return new Response("Domain not allowed", { status: 403 });
  }

  // サイトHTMLを取得
  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity", // gzip/brを避けて素のHTMLを受け取る
      },
      redirect: "follow",
      // タイムアウト (Node.js fetch はAbortSignalで制御)
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html")) {
      return new Response("Not an HTML page", { status: 422 });
    }

    const html = await res.text();

    // <base> タグを注入して相対URLを元サイト基準で解決させる
    const baseTag = `<base href="${targetUrl.origin}${targetUrl.pathname}">`;

    // 既存の <base> を置き換えるか、<head> 直後に挿入
    let modified = html;
    if (/<base\s/i.test(modified)) {
      modified = modified.replace(/<base\s[^>]*>/gi, baseTag);
    } else {
      modified = modified.replace(/(<head[^>]*>)/i, `$1${baseTag}`);
    }

    // Kaiseki SDK を計測対象外にする（プレビュー内での二重計測防止）
    modified = modified.replace(
      /<script[^>]+data-project[^>]*><\/script>/gi,
      ""
    );

    return new Response(modified, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // X-Frame-Options と CSP は意図的に送出しない
        // （ブラウザデフォルトは埋め込みを許可する）
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return new Response(`Failed to fetch preview: ${message}`, { status: 502 });
  }
}
