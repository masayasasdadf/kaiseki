"use client";

import { useState } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Info, RefreshCw } from "lucide-react";

interface Insight {
  type: "positive" | "warning" | "neutral";
  title: string;
  body: string;
}

interface AIInsightsProps {
  projectId: string;
  range: string;
}

export function AIInsights({ projectId, range }: AIInsightsProps) {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "分析に失敗しました");
      }
      const data = await res.json();
      setInsights(data.insights);
      setGeneratedAt(data.generatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const typeConfig = {
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-800">AI分析・解説</h2>
          <span className="text-xs text-slate-400 font-normal">Powered by Claude</span>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "分析中..." : insights ? "再分析" : "分析する"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!insights && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="h-8 w-8 text-slate-200 mb-3" />
          <p className="text-sm text-slate-500">
            「分析する」を押すと、現在の期間のデータをAIが解析して<br />改善ポイントや注目指標を日本語で解説します
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
          <p className="text-sm text-slate-500">データを分析しています...</p>
        </div>
      )}

      {insights && !loading && (
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const config = typeConfig[insight.type] ?? typeConfig.neutral;
            const Icon = config.icon;
            return (
              <div
                key={i}
                className={`rounded-lg border p-4 ${config.border} ${config.bg}`}
              >
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
          {generatedAt && (
            <p className="text-right text-xs text-slate-400 pt-1">
              生成日時:{" "}
              {new Date(generatedAt).toLocaleString("ja-JP", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
