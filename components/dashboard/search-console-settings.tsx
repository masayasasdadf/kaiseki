"use client";

import { useState, useEffect } from "react";
import { Search, CheckCircle2, XCircle, Loader2, ExternalLink, Unlink } from "lucide-react";

interface SearchConsoleSettingsProps {
  projectId: string;
  connected: boolean;
  property: string | null;
}

export function SearchConsoleSettings({
  projectId,
  connected: initialConnected,
  property: initialProperty,
}: SearchConsoleSettingsProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [property, setProperty] = useState(initialProperty);
  const [sites, setSites] = useState<string[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSite, setSelectedSite] = useState(initialProperty || "");
  const [statusMsg, setStatusMsg] = useState("");

  // URLパラメータでOAuth結果を受け取る
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("sc_connected") === "1") {
      setConnected(true);
      setStatusMsg("Googleアカウントと接続しました。プロパティを選択してください。");
      window.history.replaceState({}, "", window.location.pathname);
    }
    const err = params.get("sc_error");
    if (err) {
      setStatusMsg(`接続エラー: ${decodeURIComponent(err)}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // 接続済みならサイト一覧を取得
  useEffect(() => {
    if (!connected) return;
    setLoadingSites(true);
    fetch(`/api/projects/${projectId}/search-console?sites=1`)
      .then((r) => r.json())
      .then((d) => {
        if (d.sites) setSites(d.sites);
      })
      .finally(() => setLoadingSites(false));
  }, [connected, projectId]);

  const handleConnect = () => {
    window.location.href = `/api/auth/google?projectId=${projectId}`;
  };

  const handleSaveProperty = async () => {
    if (!selectedSite) return;
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/search-console`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property: selectedSite }),
    });
    setSaving(false);
    if (res.ok) {
      setProperty(selectedSite);
      setStatusMsg("プロパティを保存しました");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Search Console との連携を解除しますか？")) return;
    await fetch(`/api/projects/${projectId}/search-console`, { method: "DELETE" });
    setConnected(false);
    setProperty(null);
    setSites([]);
    setSelectedSite("");
    setStatusMsg("連携を解除しました");
  };

  const googleConfigured =
    typeof process !== "undefined"
      ? true // サーバー側では判定できないのでtrue
      : true;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <Search className="h-5 w-5 text-indigo-500" />
        <h2 className="text-base font-semibold text-slate-800">
          Google Search Console 連携
        </h2>
        {connected && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            接続済み
          </span>
        )}
      </div>

      <p className="text-sm text-slate-600 mb-4">
        Search Consoleと連携すると、流入分析ページに
        <strong>検索クエリ・表示回数・クリック率・掲載順位</strong>
        が表示されます。
      </p>

      {statusMsg && (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            statusMsg.includes("エラー")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {statusMsg}
        </div>
      )}

      {!connected ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Vercelの環境変数に
            <code className="bg-slate-100 px-1 rounded">GOOGLE_CLIENT_ID</code>
            と
            <code className="bg-slate-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code>
            の設定が必要です。
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-indigo-600 hover:underline inline-flex items-center gap-0.5"
            >
              Google Cloud Console <ExternalLink className="h-3 w-3" />
            </a>
          </p>
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Googleアカウントで接続
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* プロパティ選択 */}
          {property ? (
            <div className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">連携中のプロパティ</p>
                <p className="text-xs text-emerald-600 font-mono">{property}</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                使用するプロパティを選択
              </label>
              {loadingSites ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  プロパティを取得中...
                </div>
              ) : sites.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <XCircle className="h-4 w-4" />
                  Search Console に登録されたプロパティが見つかりません
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">選択してください</option>
                    {sites.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSaveProperty}
                    disabled={!selectedSite || saving}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "保存"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* プロパティ変更 + 切断 */}
          <div className="flex items-center gap-3 pt-1">
            {property && sites.length > 0 && (
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {sites.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
            {property && sites.length > 0 && (
              <button
                onClick={handleSaveProperty}
                disabled={saving || selectedSite === property}
                className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
              >
                変更
              </button>
            )}
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
            >
              <Unlink className="h-3 w-3" />
              連携を解除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
