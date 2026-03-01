"use client";

import { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Users,
  MousePointerClick,
} from "lucide-react";

interface Insight {
  type: "positive" | "warning" | "neutral";
  title: string;
  body: string;
}

interface Hypothesis {
  cause: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

interface Improvement {
  title: string;
  description: string;
  affected_segment: string;
  affected_metric: string;
  expected_impact: string;
  implementation_cost: "low" | "medium" | "high";
  validation_method: string;
  priority: "high" | "medium" | "low";
}

interface AnalysisResult {
  problem_summary: string | null;
  root_cause_hypotheses: Hypothesis[];
  improvements: Improvement[];
  insights: Insight[];
  sessionQuality: { success: number; near_miss: number; failure: number };
  hesitationSignals: {
    ctaImpressions: number;
    ctaHesitations: number;
    hesitationRate: number | null;
    contentToggles: number;
    tabSwitches: number;
  };
  generatedAt: string;
}

interface SearchRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface AIInsightsProps {
  projectId: string;
  range: string;
  searchRows?: SearchRow[];
}

const costConfig = {
  low:    { label: "低コスト",   className: "bg-emerald-100 text-emerald-700" },
  medium: { label: "中コスト",   className: "bg-amber-100 text-amber-700" },
  high:   { label: "高コスト",   className: "bg-red-100 text-red-700" },
};
const priorityConfig = {
  high:   { label: "優先度：高", className: "bg-red-500 text-white" },
  medium: { label: "優先度：中", className: "bg-amber-500 text-white" },
  low:    { label: "優先度：低", className: "bg-slate-400 text-white" },
};
const confidenceConfig = {
  high:   { label: "確信度：高", className: "text-emerald-600" },
  medium: { label: "確信度：中", className: "text-amber-600" },
  low:    { label: "確信度：低", className: "text-slate-400" },
};
const insightTypeConfig = {
  positive: {
    icon: TrendingUp,
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-800",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-200",
    bg: "bg-amber-50",
    iconColor: "text-amber-600",
    titleColor: "text-amber-800",
  },
  neutral: {
    icon: Info,
    border: "border-slate-200",
    bg: "bg-slate-50",
    iconColor: "text-slate-500",
    titleColor: "text-slate-700",
  },
};

export function AIInsights({ projectId, range, searchRows }: AIInsightsProps) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedImprovement, setExpandedImprovement] = useState<number | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range, searchRows: searchRows ?? [] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "分析に失敗しました");
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const totalSessions = result
    ? result.sessionQuality.success + result.sessionQuality.near_miss + result.sessionQuality.failure
    : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-800">AI分析・改善提案</h2>
          <span className="text-xs text-slate-400 font-normal">4段階分析 / Powered by GPT</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "分析中..." : result ? "再分析" : "分析する"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="h-8 w-8 text-slate-200 mb-3" />
          <p className="text-sm text-slate-500 leading-relaxed">
            「分析する」を押すと、セッション品質・CTA躊躇率・検索意図を含む<br />
            4段階分析と優先度付き改善提案を生成します
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
          <p className="text-sm text-slate-500">データを分析しています...</p>
        </div>
      )}

      {result && !loading && (
        <>
          {/* セッション品質サマリー */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">セッション品質</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "成功（CV）", value: result.sessionQuality.success, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
                { label: "惜敗（高関心・未CV）", value: result.sessionQuality.near_miss, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
                { label: "離脱", value: result.sessionQuality.failure, color: "text-slate-600", bg: "bg-slate-100 border-slate-200" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-lg border px-3 py-2.5 ${bg}`}>
                  <p className={`text-xl font-bold tabular-nums ${color}`}>{value.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  {totalSessions > 0 && (
                    <p className="text-xs text-slate-400">
                      {Math.round((value / totalSessions) * 100)}%
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* CTA躊躇シグナル */}
            {result.hesitationSignals.ctaImpressions > 0 && (
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  CTA表示 {result.hesitationSignals.ctaImpressions}回
                </div>
                {result.hesitationSignals.hesitationRate !== null && (
                  <div className="text-xs text-amber-600 font-medium">
                    躊躇率 {result.hesitationSignals.hesitationRate}%（ホバー→非クリック）
                  </div>
                )}
                {result.hesitationSignals.contentToggles > 0 && (
                  <div className="text-xs text-slate-500">
                    FAQ開閉 {result.hesitationSignals.contentToggles}回
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 問題サマリー + 原因仮説 */}
          {result.problem_summary && (
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-violet-900">{result.problem_summary}</p>
              {result.root_cause_hypotheses.length > 0 && (
                <div className="space-y-2">
                  {result.root_cause_hypotheses.map((h, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded-full bg-violet-200 px-2 py-0.5 text-xs font-medium text-violet-800">
                        {h.cause}
                      </span>
                      <span className="text-xs text-violet-700 leading-relaxed">{h.evidence}</span>
                      <span className={`ml-auto shrink-0 text-xs ${confidenceConfig[h.confidence as keyof typeof confidenceConfig]?.className ?? "text-slate-400"}`}>
                        {confidenceConfig[h.confidence as keyof typeof confidenceConfig]?.label ?? h.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 優先度付き改善提案 */}
          {result.improvements.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                改善提案（優先度順）
              </h3>
              {result.improvements.map((imp, i) => {
                const isOpen = expandedImprovement === i;
                const priority = priorityConfig[imp.priority as keyof typeof priorityConfig] ?? priorityConfig.low;
                const cost = costConfig[imp.implementation_cost as keyof typeof costConfig] ?? costConfig.medium;
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedImprovement(isOpen ? null : i)}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${priority.className}`}>
                        {priority.label}
                      </span>
                      <span className="flex-1 text-sm font-medium text-slate-800 truncate">
                        {imp.title}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${cost.className}`}>
                        {cost.label}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-white">
                        <p className="text-sm text-slate-600 leading-relaxed">{imp.description}</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                          <div>
                            <span className="text-slate-400">対象ユーザー</span>
                            <p className="text-slate-700 font-medium">{imp.affected_segment}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">改善指標</span>
                            <p className="text-slate-700 font-medium">{imp.affected_metric}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">期待インパクト</span>
                            <p className="text-emerald-700 font-semibold">{imp.expected_impact}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">検証方法</span>
                            <p className="text-slate-700 font-medium">{imp.validation_method}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 観察インサイト */}
          {result.insights.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                観察インサイト
              </h3>
              {result.insights.map((insight, i) => {
                const config = insightTypeConfig[insight.type as keyof typeof insightTypeConfig] ?? insightTypeConfig.neutral;
                const Icon = config.icon;
                return (
                  <div key={i} className={`rounded-lg border p-3 ${config.border} ${config.bg}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.iconColor}`} />
                      <div>
                        <p className={`text-sm font-semibold mb-0.5 ${config.titleColor}`}>
                          {insight.title}
                        </p>
                        <p className="text-xs text-slate-600 leading-relaxed">{insight.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {result.generatedAt && (
            <p className="text-right text-xs text-slate-400">
              生成日時:{" "}
              {new Date(result.generatedAt).toLocaleString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
