"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { AIPageInsights } from "@/components/dashboard/ai-page-insights";
import { type DateRange } from "@/lib/utils";
import { ArrowRight, Loader2, LogOut, GitFork, RefreshCw } from "lucide-react";

interface Transition {
  from: string;
  to: string;
  count: number;
}

interface TopPath {
  steps: string[];
  count: number;
  conversionCount: number;
  cvRate: number;
}

interface ExitPage {
  path: string;
  exits: number;
  exitRate: number;
}

interface FlowData {
  transitions: Transition[];
  topPaths: TopPath[];
  exitPages: ExitPage[];
  totalSessions: number;
  pathTitles: Record<string, string>;
}

type Tab = "transitions" | "paths" | "exits";

/** パスを表示用の文字列に変換。easyMode 時はタイトル優先 */
function displayPath(path: string, titles: Record<string, string>, easyMode: boolean): string {
  if (easyMode) {
    if (titles[path]) return titles[path];
    if (path === "/" || path === "") return "TOPページ";
    const clean = path.split("?")[0].replace(/^\/+/, "").replace(/\/+$/, "");
    const last = clean.split("/").pop() || "";
    return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || path;
  }
  return path === "/" ? "/ (TOP)" : path;
}

function PathChip({ path, titles, easyMode }: { path: string; titles: Record<string, string>; easyMode: boolean }) {
  const label = displayPath(path, titles, easyMode);
  const truncated = label.length > 20 ? label.slice(0, 20) + "…" : label;
  return (
    <span
      title={path}
      className="inline-block rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 shrink-0"
    >
      {truncated}
    </span>
  );
}

function BarCell({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums text-slate-700 text-sm w-14 text-right">{value.toLocaleString()}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 min-w-[60px]">
        <div className="h-1.5 rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function FlowPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("transitions");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/flow?range=${dateRange}`);
      if (!res.ok) throw new Error("取得失敗");
      setData(await res.json());
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxTransitionCount = data?.transitions[0]?.count ?? 1;
  const maxExitCount = data?.exitPages[0]?.exits ?? 1;
  const titles = data?.pathTitles ?? {};

  // AI 用コンテキスト文字列
  const aiContext = useMemo(() => {
    if (!data) return "";
    return [
      `## ページ動線データ（${dateRange}）`,
      `対象セッション: ${data.totalSessions.toLocaleString()}`,
      "",
      "### 上位ページ遷移",
      ...data.transitions.slice(0, 8).map((t, i) =>
        `${i + 1}. ${t.from} → ${t.to}: ${t.count}回`
      ),
      "",
      "### よく辿られるパス",
      ...data.topPaths.slice(0, 5).map((p, i) =>
        `${i + 1}. ${p.steps.join(" → ")}: ${p.count}セッション（CV率${p.cvRate}%）`
      ),
      "",
      "### 離脱ページ",
      ...data.exitPages.slice(0, 5).map((ep, i) =>
        `${i + 1}. ${ep.path}: ${ep.exits}離脱（離脱率${ep.exitRate}%）`
      ),
    ].join("\n");
  }, [data, dateRange]);

  const tabs: { key: Tab; label: string; labelEasy: string }[] = [
    { key: "transitions", label: "ページ遷移", labelEasy: "次に見たページ" },
    { key: "paths",       label: "よく辿られるパス", labelEasy: "よく通るルート" },
    { key: "exits",       label: "離脱ページ", labelEasy: "どこで帰ったか" },
  ];

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <GitFork className="h-6 w-6 text-slate-600" />
              {easyMode ? "ページ動線分析" : "Page Flow"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {easyMode
                ? "ユーザーがどのページからどこへ移動したかを確認できます"
                : "Analyze how users navigate through pages"}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            更新
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="ml-3 text-slate-500">集計中...</span>
          </div>
        ) : data ? (
          <>
            {/* サマリー */}
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 flex items-center gap-8">
              <div>
                <p className="text-xs text-slate-400">対象セッション</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{data.totalSessions.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">遷移パターン数</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{data.transitions.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">CVに繋がったパス</p>
                <p className="text-2xl font-bold text-indigo-600 tabular-nums">
                  {data.topPaths.filter((p) => p.conversionCount > 0).length}
                </p>
              </div>
            </div>

            {/* タブ */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex border-b border-slate-200">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-5 py-3 text-sm font-medium transition-colors ${
                      tab === t.key
                        ? "border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {easyMode ? t.labelEasy : t.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* ======= ページ遷移 ======= */}
                {tab === "transitions" && (
                  <div className="space-y-1">
                    {data.transitions.length === 0 ? (
                      <p className="text-sm text-slate-400 py-8 text-center">
                        データがありません（複数ページ閲覧セッションが必要です）
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 pb-2 mb-1 border-b border-slate-100 text-xs font-medium text-slate-400">
                          <span>移動元</span>
                          <span />
                          <span>移動先</span>
                          <span className="text-right pr-1">件数</span>
                        </div>
                        {data.transitions.map((t, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-3 items-center py-2 rounded-lg hover:bg-slate-50 transition-colors px-1"
                          >
                            <span title={t.from} className="text-xs text-slate-600 truncate">
                              {displayPath(t.from, titles, easyMode)}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                            <span title={t.to} className="text-xs text-slate-800 font-medium truncate">
                              {displayPath(t.to, titles, easyMode)}
                            </span>
                            <BarCell value={t.count} max={maxTransitionCount} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* ======= よく辿られるパス ======= */}
                {tab === "paths" && (
                  <div className="space-y-3">
                    {data.topPaths.length === 0 ? (
                      <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
                    ) : (
                      data.topPaths.map((path, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-slate-200 transition-colors"
                        >
                          <span className="text-sm font-bold text-slate-300 w-5 shrink-0 tabular-nums">{i + 1}</span>
                          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                            {path.steps.map((step, si) => (
                              <div key={si} className="flex items-center gap-1.5">
                                <PathChip path={step} titles={titles} easyMode={easyMode} />
                                {si < path.steps.length - 1 && (
                                  <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>
                          {path.conversionCount > 0 && (
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              CV {path.cvRate}%
                            </span>
                          )}
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-slate-700 tabular-nums">{path.count.toLocaleString()}</p>
                            <p className="text-xs text-slate-400">{easyMode ? "人" : "セッション"}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ======= 離脱ページ ======= */}
                {tab === "exits" && (
                  <div className="space-y-1">
                    {data.exitPages.length === 0 ? (
                      <p className="text-sm text-slate-400 py-8 text-center">データがありません</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 pb-2 mb-1 border-b border-slate-100 text-xs font-medium text-slate-400">
                          <span>ページ</span>
                          <span className="text-right">離脱数</span>
                          <span className="text-right w-16">離脱率</span>
                        </div>
                        {data.exitPages.map((ep, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center py-2.5 rounded-lg hover:bg-slate-50 transition-colors px-1"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <LogOut className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                              <span title={ep.path} className="text-xs text-slate-600 truncate">
                                {displayPath(ep.path, titles, easyMode)}
                              </span>
                            </div>
                            <BarCell value={ep.exits} max={maxExitCount} />
                            <span
                              className={`text-sm font-semibold tabular-nums w-16 text-right ${
                                ep.exitRate >= 70 ? "text-red-600" : ep.exitRate >= 40 ? "text-amber-600" : "text-emerald-600"
                              }`}
                            >
                              {ep.exitRate}%
                            </span>
                          </div>
                        ))}
                        <p className="pt-3 text-xs text-slate-400">
                          ※ 離脱率 = そのページが最後だったセッション ÷ そのページの総訪問数
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* AI コメント */}
            <AIPageInsights projectId={projectId} context={aiContext} label="ページ動線分析" />
          </>
        ) : null}
      </main>
    </>
  );
}
