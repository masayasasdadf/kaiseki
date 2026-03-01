"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { AIPageInsights } from "@/components/dashboard/ai-page-insights";
import { type DateRange, formatPercent } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Trash2,
  Play,
  Filter,
  ArrowDown,
  TrendingDown,
  CheckCircle2,
} from "lucide-react";

interface FunnelStep {
  path: string;
  sessions: number;
  percentage: number;
  dropOff: number;
  dropOffRate: number;
  conversionCount: number;
}

interface FunnelResult {
  steps: FunnelStep[];
  totalEntered: number;
  totalCompleted: number;
  completionRate: number;
  stepTitles: Record<string, string>;
}

const PRESETS = [
  {
    label: "シンプルLP",
    labelEasy: "シンプルなLP",
    steps: ["/", "/contact", "/thanks"],
  },
  {
    label: "LP → 料金 → CV",
    labelEasy: "LP→料金→申込",
    steps: ["/", "/price", "/contact", "/thanks"],
  },
  {
    label: "サービス紹介 → 申込",
    labelEasy: "サービス→申込",
    steps: ["/", "/service", "/form", "/complete"],
  },
];

function displayStep(path: string, titles: Record<string, string>, easyMode: boolean): string {
  if (easyMode) {
    if (titles[path]) return titles[path];
    if (path === "/" || path === "") return "TOPページ";
    const clean = path.split("?")[0].replace(/^\/+/, "").replace(/\/+$/, "");
    const last = clean.split("/").pop() || "";
    return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || path;
  }
  return path === "/" ? "/ (TOP)" : path;
}

// ステップの幅は percentage に比例（最小8%で視認性確保）
function FunnelBar({
  step, index, isLast, titles, easyMode,
}: {
  step: FunnelStep; index: number; isLast: boolean;
  titles: Record<string, string>; easyMode: boolean;
}) {
  const barWidth = Math.max(step.percentage, 8);
  const isWorstDropOff = step.dropOffRate >= 40;

  return (
    <div className="space-y-1">
      {/* ドロップオフ表示（最初のステップ以外）*/}
      {index > 0 && step.dropOff > 0 && (
        <div className="flex items-center gap-2 pl-4 py-1">
          <ArrowDown className="h-3.5 w-3.5 text-slate-300 shrink-0" />
          <span className={`text-xs ${isWorstDropOff ? "text-red-500 font-medium" : "text-slate-400"}`}>
            {step.dropOff.toLocaleString()}人が離脱（{step.dropOffRate}%）
          </span>
          {isWorstDropOff && (
            <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">
              最大離脱
            </span>
          )}
        </div>
      )}

      {/* ファネルバー本体 */}
      <div className="flex items-center gap-3">
        {/* ステップ番号 */}
        <div className="shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
          <span className="text-xs font-bold text-indigo-700">{index + 1}</span>
        </div>

        <div className="flex-1 space-y-1">
          {/* パス名 */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 truncate max-w-[240px]" title={step.path}>
              {displayStep(step.path, titles, easyMode)}
            </span>
            {isLast && (
              <span className="flex items-center gap-0.5 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                ゴール
              </span>
            )}
          </div>

          {/* バー */}
          <div className="h-9 rounded-lg bg-slate-100 relative overflow-hidden">
            <div
              className={`h-full rounded-lg transition-all duration-500 flex items-center px-3 ${
                isLast ? "bg-emerald-500" : "bg-indigo-500"
              }`}
              style={{ width: `${barWidth}%` }}
            >
              <span className="text-xs font-semibold text-white whitespace-nowrap">
                {step.sessions.toLocaleString()}人
              </span>
            </div>
            <div className="absolute inset-y-0 right-3 flex items-center">
              <span className="text-xs text-slate-400 tabular-nums">{step.percentage}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FunnelPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [steps, setSteps] = useState<string[]>(["/", "/price", "/contact", "/thanks"]);
  const [result, setResult] = useState<FunnelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addStep = () => setSteps((s) => [...s, ""]);
  const removeStep = (i: number) => setSteps((s) => s.filter((_, idx) => idx !== i));
  const updateStep = (i: number, val: string) =>
    setSteps((s) => s.map((v, idx) => (idx === i ? val : v)));

  const applyPreset = (preset: typeof PRESETS[0]) => setSteps(preset.steps);

  const analyze = useCallback(async () => {
    const validSteps = steps.filter((s) => s.trim() !== "");
    if (validSteps.length < 2) {
      setError("ステップを2つ以上入力してください");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/funnel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: validSteps, range: dateRange }),
      });
      if (!res.ok) throw new Error("取得失敗");
      setResult(await res.json());
    } catch {
      setError("分析に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectId, steps, dateRange]);

  // 最大離脱ステップ
  const worstStep = result
    ? result.steps.slice(1).reduce(
        (worst, s) => (s.dropOffRate > worst.dropOffRate ? s : worst),
        result.steps[1]
      )
    : null;

  const aiContext = useMemo(() => {
    if (!result) return "";
    const lines = [
      `ファネル分析（${dateRange}）`,
      `入口: ${result.totalEntered}人, ゴール到達: ${result.totalCompleted}人, 完了率: ${result.completionRate}%`,
      `ステップ数: ${result.steps.length}`,
      "",
      "各ステップ:",
      ...result.steps.map((s, i) =>
        `  Step${i + 1} ${s.path}: ${s.sessions}人 (${s.percentage}%)` +
        (i > 0 ? ` 離脱${s.dropOff}人(${s.dropOffRate}%)` : "")
      ),
    ];
    if (worstStep) {
      lines.push(``, `最大離脱: ${worstStep.path} (${worstStep.dropOffRate}%)`);
    }
    return lines.join("\n");
  }, [result, dateRange, worstStep]);

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-6 space-y-6">
        {/* タイトル */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Filter className="h-6 w-6 text-slate-600" />
            {easyMode ? "ファネル分析" : "Funnel Analysis"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode
              ? "申込までのステップで、どこで何人離脱したか分かります"
              : "Track how users progress through key pages and where they drop off"}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ===== 左: ステップ設定 ===== */}
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-700">
                {easyMode ? "ステップを設定する" : "ファネルのステップ"}
              </h2>

              {/* プリセット */}
              <div className="space-y-1">
                <p className="text-xs text-slate-400 mb-2">テンプレートを使う</p>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                  >
                    {easyMode ? p.labelEasy : p.label}
                    <span className="text-slate-400 ml-1">
                      ({p.steps.length}ステップ)
                    </span>
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-2">
                <p className="text-xs text-slate-400">または自分で設定</p>
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs flex items-center justify-center font-bold">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => updateStep(i, e.target.value)}
                      placeholder={i === 0 ? "/" : i === steps.length - 1 ? "/thanks" : "/page"}
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    {steps.length > 2 && (
                      <button
                        onClick={() => removeStep(i)}
                        className="text-slate-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                {steps.length < 8 && (
                  <button
                    onClick={addStep}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 transition-colors mt-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    ステップを追加
                  </button>
                )}
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>
              )}

              <button
                onClick={analyze}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {loading ? "分析中..." : easyMode ? "分析する" : "Run Analysis"}
              </button>
            </div>
          </div>

          {/* ===== 右: 結果 ===== */}
          <div className="lg:col-span-2 space-y-4">
            {!result && !loading && (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 flex flex-col items-center justify-center text-center">
                <Filter className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-sm text-slate-400">
                  左でステップを設定して「分析する」を押してください
                </p>
              </div>
            )}

            {loading && (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
                <p className="text-sm text-slate-400">集計中...</p>
              </div>
            )}

            {result && !loading && (
              <>
                {/* サマリーカード */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs text-slate-400">{easyMode ? "入口の訪問者" : "ファネル入口"}</p>
                    <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                      {result.totalEntered.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs text-slate-400">{easyMode ? "最後まで到達" : "ゴール到達"}</p>
                    <p className="text-xl font-bold text-emerald-600 tabular-nums mt-0.5">
                      {result.totalCompleted.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs text-slate-400">{easyMode ? "完走率" : "完了率"}</p>
                    <p className="text-xl font-bold text-indigo-600 tabular-nums mt-0.5">
                      {formatPercent(result.completionRate)}
                    </p>
                  </div>
                </div>

                {/* 最大離脱ポイントのインサイト */}
                {worstStep && worstStep.dropOffRate >= 20 && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <TrendingDown className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">
                      <span className="font-semibold">最大離脱：</span>
                      <span className={easyMode ? "" : "font-mono"}>
                        {displayStep(worstStep.path, result.stepTitles, easyMode)}
                      </span> で
                      {worstStep.dropOff.toLocaleString()}人（{worstStep.dropOffRate}%）が離脱しています。
                      このページの改善が最優先です。
                    </p>
                  </div>
                )}

                {/* ファネルバー */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
                  <h2 className="text-sm font-semibold text-slate-700 mb-3">
                    {easyMode ? "ステップ別の到達人数" : "ファネル可視化"}
                  </h2>
                  <div className="space-y-3">
                    {result.steps.map((step, i) => (
                      <FunnelBar
                        key={i}
                        step={step}
                        index={i}
                        isLast={i === result.steps.length - 1}
                        titles={result.stepTitles}
                        easyMode={easyMode}
                      />
                    ))}
                  </div>
                </div>

                {/* ステップ詳細テーブル */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-slate-700 mb-3">詳細数値</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {["ステップ", "到達数", "全体比", "離脱数", "離脱率"].map((h) => (
                          <th key={h} className="pb-2 text-left text-xs font-medium text-slate-400 px-1 first:pl-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.steps.map((step, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="py-2 pl-0 pr-1">
                            <span className={`text-xs text-slate-600 ${easyMode ? "" : "font-mono"}`}
                              title={step.path}>
                              {displayStep(step.path, result.stepTitles, easyMode)}
                            </span>
                          </td>
                          <td className="py-2 px-1 tabular-nums text-slate-700">
                            {step.sessions.toLocaleString()}
                          </td>
                          <td className="py-2 px-1 tabular-nums text-slate-700">
                            {formatPercent(step.percentage)}
                          </td>
                          <td className="py-2 px-1 tabular-nums text-slate-500">
                            {i === 0 ? "—" : step.dropOff.toLocaleString()}
                          </td>
                          <td className={`py-2 px-1 tabular-nums font-medium ${
                            i === 0
                              ? "text-slate-300"
                              : step.dropOffRate >= 50
                              ? "text-red-600"
                              : step.dropOffRate >= 30
                              ? "text-amber-600"
                              : "text-slate-600"
                          }`}>
                            {i === 0 ? "—" : formatPercent(step.dropOffRate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* AI解説 */}
                <AIPageInsights
                  projectId={projectId}
                  context={aiContext}
                  label="ファネル分析"
                />
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
