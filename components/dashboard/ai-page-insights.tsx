"use client";

import { useState } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Info, RefreshCw } from "lucide-react";

interface Insight {
  type: "positive" | "warning" | "neutral";
  title: string;
  body: string;
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

interface AIPageInsightsProps {
  projectId: string;
  /** 分析対象のデータを文字列化したもの。data が null の間は空文字を渡す */
  context: string;
  /** AI プロンプトで使う分析ページ名（例: "動線分析"） */
  label: string;
}

export function AIPageInsights({ projectId, context, label }: AIPageInsightsProps) {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  async function generate() {
    if (!context) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, label }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "分析に失敗しました");
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

  return (
    <div className="rounded-xl border border-violet-100 bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h2 className="text-sm font-semibold text-slate-800">AIコメント</h2>
          <span className="text-xs text-slate-400">このデータのポイントを要約</span>
        </div>
        <button
          onClick={generate}
          disabled={loading || !context}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          {loading ? "分析中..." : insights ? "再分析" : "AI分析"}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
      )}

      {!insights && !loading && !error && (
        <p className="text-xs text-slate-400 py-2">
          「AI分析」を押すと、このページのデータから改善ポイントを自動で要約します
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-2">
          <div className="h-4 w-4 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
          <span className="text-xs text-slate-400">分析中...</span>
        </div>
      )}

      {insights && !loading && (
        <div className="space-y-2">
          {insights.map((insight, i) => {
            const config = typeConfig[insight.type as keyof typeof typeConfig] ?? typeConfig.neutral;
            const Icon = config.icon;
            return (
              <div key={i} className={`rounded-lg border p-3 ${config.border} ${config.bg}`}>
                <div className="flex items-start gap-2">
                  <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${config.iconColor}`} />
                  <div>
                    <p className={`text-xs font-semibold mb-0.5 ${config.titleColor}`}>
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
