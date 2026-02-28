/**
 * Google OAuth コールバックエンドポイント
 * GET /api/auth/google/callback?code=xxx&state=projectId
 *
 * 認可コードをリフレッシュトークンに交換してDBに保存する
 */

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const projectId = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const settingsUrl = `${appUrl}/${projectId}/settings`;

  if (error || !code || !projectId) {
    return Response.redirect(
      `${settingsUrl}?sc_error=${encodeURIComponent(error || "認証に失敗しました")}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.redirect(`${settingsUrl}?sc_error=設定エラー`);
  }

  const redirectUri = `${appUrl}/api/auth/google/callback`;

  // コードをトークンに交換
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return Response.redirect(`${settingsUrl}?sc_error=トークン取得に失敗しました`);
  }

  const tokens = await tokenRes.json();
  const refreshToken = tokens.refresh_token as string | undefined;

  if (!refreshToken) {
    return Response.redirect(
      `${settingsUrl}?sc_error=リフレッシュトークンが取得できませんでした`
    );
  }

  // リフレッシュトークンをDBに保存
  await db.project.update({
    where: { id: projectId },
    data: { searchConsoleRefreshToken: refreshToken },
  });

  return Response.redirect(`${settingsUrl}?sc_connected=1`);
}
