"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { SearchConsoleSettings } from "@/components/dashboard/search-console-settings";
import { type DateRange } from "@/lib/utils";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Settings,
  Key,
  Shield,
  Globe,
} from "lucide-react";

interface ProjectSettings {
  id: string;
  name: string;
  publicKey: string;
  secretKey?: string;
  allowedDomains: string[];
  excludedIps: string[];
  searchConsoleProperty?: string | null;
  searchConsoleConnected?: boolean;
}

export default function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [project, setProject] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [name, setName] = useState("");
  const [domainsInput, setDomainsInput] = useState("");
  const [ipsInput, setIpsInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`);
      if (res.ok) {
        const { project: p } = await res.json();
        setProject(p);
        setName(p.name);
        setDomainsInput(p.allowedDomains.join("\n"));
        setIpsInput(p.excludedIps.join("\n"));
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const copyKey = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          allowedDomains: domainsInput
            .split("\n")
            .map((d) => d.trim())
            .filter(Boolean),
          excludedIps: ipsInput
            .split("\n")
            .map((ip) => ip.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "保存に失敗しました");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const snippetCode = project
    ? `<script src="${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/sdk.js" data-project="${project.publicKey}"></script>`
    : "";

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-slate-600" />
            {easyMode ? "設定" : "Project Settings"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode ? "計測の基本設定を確認・変更できます" : "Manage project configuration"}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : project ? (
          <>
            {/* 計測タグ */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "計測タグの設置コード" : "Tracking Snippet"}
                </h2>
              </div>
              <p className="text-sm text-slate-600 mb-3">
                {easyMode
                  ? "このコードをサイトの</body>タグの直前に貼り付けると計測が始まります"
                  : "Add this snippet before </body> in your HTML"}
              </p>
              <div className="relative">
                <pre className="rounded-lg bg-slate-900 p-4 text-xs text-emerald-400 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
                  {snippetCode}
                </pre>
                <button
                  onClick={() => copyKey(snippetCode)}
                  className="absolute top-3 right-3 flex items-center gap-1 rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                >
                  {copiedKey ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      {easyMode ? "コピー済み" : "Copied!"}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      {easyMode ? "コピー" : "Copy"}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* プロジェクトキー */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "アクセスキー" : "API Keys"}
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {easyMode ? "公開キー（サイトに設置するもの）" : "Project Key (Public)"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={project.publicKey}
                      className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-600"
                    />
                    <button
                      onClick={() => copyKey(project.publicKey)}
                      className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 transition-colors"
                      title="コピー"
                    >
                      <Copy className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                </div>

                {project.secretKey && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {easyMode ? "秘密キー（絶対に公開しないこと）" : "Secret Key (Private)"}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type={showSecret ? "text" : "password"}
                        readOnly
                        value={project.secretKey}
                        className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-600"
                      />
                      <button
                        onClick={() => setShowSecret(!showSecret)}
                        className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 transition-colors"
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4 text-slate-500" />
                        ) : (
                          <Eye className="h-4 w-4 text-slate-500" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-red-500 mt-1">
                      {easyMode
                        ? "このキーは絶対に他人に教えないでください"
                        : "Never expose this key publicly"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 基本設定 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "基本設定" : "General Settings"}
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {easyMode ? "プロジェクト名" : "Project Name"}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {easyMode ? "計測を許可するドメイン（1行1つ）" : "Allowed Domains"}
                  </label>
                  <textarea
                    value={domainsInput}
                    onChange={(e) => setDomainsInput(e.target.value)}
                    rows={3}
                    placeholder={easyMode ? "例:\nexample.com\nwww.example.com" : "e.g.\nexample.com"}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {easyMode
                      ? "空の場合はすべてのドメインから計測を受け付けます"
                      : "Leave empty to allow all domains"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {easyMode ? "除外するIPアドレス（社内など、1行1つ）" : "Excluded IPs"}
                  </label>
                  <textarea
                    value={ipsInput}
                    onChange={(e) => setIpsInput(e.target.value)}
                    rows={3}
                    placeholder={easyMode ? "例:\n192.168.1.1\n10.0.0.1" : "e.g.\n192.168.1.1"}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {easyMode
                      ? "社内PCのIPを除外することで、自社アクセスをカウントしないようにできます"
                      : "Traffic from these IPs will be ignored"}
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                      <Check className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saved
                      ? easyMode ? "保存しました" : "Saved!"
                      : easyMode ? "保存する" : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>

            {/* Search Console 連携 */}
            <SearchConsoleSettings
              projectId={projectId}
              connected={!!project.searchConsoleConnected}
              property={project.searchConsoleProperty ?? null}
            />
          </>
        ) : null}
      </main>
    </>
  );
}
