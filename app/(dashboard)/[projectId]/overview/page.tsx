"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { KPICard } from "@/components/dashboard/kpi-card";
import { ChannelTable } from "@/components/dashboard/channel-table";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { getEmptyState } from "@/lib/terminology";
import { formatPercent, calcChangeRate, type DateRange } from "@/lib/utils";
import {
  Loader2,
  RefreshCw,
  Search,
  GitFork,
  Layers,
  Filter,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { AIInsights } from "@/components/dashboard/ai-insights";

interface SearchRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface MetricsData {
  kpi: {
    sessions: number;
    users: number;
    conversions: number;
    cvr: number;
    bounceRate: number;
    engagementRate: number;
    pageviews: number;
    avgDuration: number;
    prevSessions: number;
    prevConversions: number;
  };
  channels: Array<{
    name: string;
    sessions: number;
    visitors: number;
    conversions: number;
  }>;
  landingPages: Array<{
    path: string;
    sessions: number;
    visitors: number;
    bounceRate: number;
  }>;
  trend: Array<{
    date: string;
    sessions: number;
    conversions: number;
  }>;
}

// easy mode でパスを読みやすいラベルに変換
function humanizePath(path: string, easyMode: boolean): string {
  if (!easyMode) return path === "/" ? "/ (TOP)" : path;
  if (path === "/" || path === "") return "TOPページ";
  const clean = path.split("?")[0].replace(/^\/+/, "").replace(/\/+$/, "");
  const last = clean.split("/").pop() || "";
  return last.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || path;
}

const ANALYSIS_SHORTCUTS = [
  {
    label: "動線分析",
    labelEasy: "ページ遷移を見る",
    desc: "ユーザーがどのルートで移動したかを把握",
    descEasy: "TOPの後にどこへ行ったか分かる",
    href: "flow",
    icon: GitFork,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-50",
  },
  {
    label: "セグメント比較",
    labelEasy: "デバイス別に比べる",
    desc: "デバイス・チャネル別のCVR差を可視化",
    descEasy: "スマホとPCで成果がどう違うか",
    href: "segments",
    icon: Layers,
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50",
  },
  {
    label: "ファネル分析",
    labelEasy: "離脱ポイントを探す",
    desc: "申込ステップ別の離脱率を可視化",
    descEasy: "申込まで、どこで諦めているか",
    href: "funnel",
    icon: Filter,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
  },
];

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<MetricsData | null>(null);
  const [searchRows, setSearchRows] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [metricsRes, scRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/metrics?range=${dateRange}`),
        fetch(`/api/projects/${projectId}/search-console?range=${dateRange}`),
      ]);
      if (!metricsRes.ok) throw new Error("Failed to fetch");
      const json = await metricsRes.json();
      setData(json);
      if (scRes.ok) {
        const scJson = await scRes.json();
        setSearchRows(Array.isArray(scJson.rows) ? scJson.rows : []);
      }
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sessionChange = data
    ? calcChangeRate(data.kpi.sessions, data.kpi.prevSessions)
    : undefined;
  const convChange = data
    ? calcChangeRate(data.kpi.conversions, data.kpi.prevConversions)
    : undefined;

  // KPIから最も注目すべき改善ポイントをひとつ選ぶ
  const alertHint =
    data && data.kpi.sessions >= 30
      ? data.kpi.bounceRate > 60
        ? {
            message: `直帰率が ${data.kpi.bounceRate.toFixed(0)}% と高め。動線分析でTOP後の行動を確認しましょう`,
            href: "flow",
          }
        : data.kpi.cvr < 1
        ? {
            message: `CVR が ${data.kpi.cvr.toFixed(2)}% と低め。ファネル分析で離脱ポイントを特定しましょう`,
            href: "funnel",
          }
        : data.kpi.engagementRate > 60 && data.kpi.cvr < 2
        ? {
            message: `エンゲージメント率 ${data.kpi.engagementRate.toFixed(0)}% なのにCVRが低め。セグメント別に原因を調べましょう`,
            href: "segments",
          }
        : null
      : null;

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />

      <main className="flex-1 p-6 space-y-6">
        {/* ページタイトル */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ダッシュボード</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              サイト全体のパフォーマンスをまとめて確認
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
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="ml-3 text-slate-500">
              {getEmptyState("loading", easyMode)}
            </span>
          </div>
        ) : data ? (
          <>
            {/* KPI グリッド */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICard
                termKey="sessions"
                value={data.kpi.sessions}
                change={sessionChange}
              />
              <KPICard
                termKey="users"
                value={data.kpi.users}
              />
              <KPICard
                termKey="conversions"
                value={data.kpi.conversions}
                change={convChange}
                highlight
              />
              <KPICard
                termKey="cvr"
                value={data.kpi.cvr}
                format="percent"
                highlight
              />
              <KPICard
                termKey="bounceRate"
                value={data.kpi.bounceRate}
                format="percent"
              />
              <KPICard
                termKey="engagementRate"
                value={data.kpi.engagementRate}
                format="percent"
              />
            </div>

            {/* アラートバナー（KPIに問題がある場合のみ） */}
            {alertHint && (
              <Link href={`/${projectId}/${alertHint.href}`}>
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="flex-1">{alertHint.message}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </div>
              </Link>
            )}

            {/* トレンドグラフ + 深堀り分析ショートカット */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* トレンド折れ線 */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-800 mb-4">セッション推移</h2>
                <TrendChart data={data.trend} />
              </div>

              {/* 深堀り分析ショートカット */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
                <h2 className="text-sm font-semibold text-slate-700 mb-3">
                  {easyMode ? "もっと詳しく調べる" : "深堀り分析"}
                </h2>
                {ANALYSIS_SHORTCUTS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <Link key={s.href} href={`/${projectId}/${s.href}`}>
                      <div className="flex items-center gap-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-colors px-3 py-2.5 cursor-pointer group">
                        <div className={`shrink-0 rounded-lg p-1.5 ${s.iconBg}`}>
                          <Icon className={`h-4 w-4 ${s.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {easyMode ? s.labelEasy : s.label}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {easyMode ? s.descEasy : s.desc}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* チャネル別テーブル */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "どこから来たか" : "チャネル別流入"}
              </h2>
              <ChannelTable
                data={data.channels}
                totalSessions={data.kpi.sessions}
              />
            </div>

            {/* LP別テーブル（検索・AIより上に配置） */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "最初に見られたページ" : "ランディングページ別"}
              </h2>
              {data.landingPages.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">
                  {getEmptyState("noData", easyMode)}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {[
                          easyMode ? "ページ" : "パス",
                          easyMode ? "訪問数" : "セッション数",
                          easyMode ? "訪問した人" : "ユーザー数",
                          easyMode ? "すぐ離脱した割合" : "直帰率",
                        ].map((h) => (
                          <th
                            key={h}
                            className="pb-3 text-left font-medium text-slate-500 first:pl-0 last:pr-0 px-3"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.landingPages.slice(0, 10).map((lp) => (
                        <tr
                          key={lp.path}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3 pl-0 pr-3 max-w-[200px] truncate"
                            title={lp.path}>
                            <span className={easyMode ? "text-sm text-slate-700" : "font-mono text-xs text-slate-700"}>
                              {humanizePath(lp.path, easyMode)}
                            </span>
                          </td>
                          <td className="py-3 px-3 tabular-nums text-slate-700">
                            {lp.sessions.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 tabular-nums text-slate-700">
                            {lp.visitors.toLocaleString()}
                          </td>
                          <td className="py-3 pl-3 pr-0">
                            <span
                              className={
                                lp.bounceRate > 70
                                  ? "text-red-600 font-medium"
                                  : lp.bounceRate > 50
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }
                            >
                              {formatPercent(lp.bounceRate)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 検索キーワード */}
            {searchRows.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-4 w-4 text-slate-400" />
                  <h2 className="text-base font-semibold text-slate-800">
                    {easyMode ? "どんなキーワードで来たか" : "検索キーワード（Search Console）"}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {[
                          "キーワード",
                          easyMode ? "クリック数" : "クリック",
                          easyMode ? "表示回数" : "表示",
                          "CTR",
                          easyMode ? "順位" : "平均順位",
                        ].map((h) => (
                          <th
                            key={h}
                            className="pb-3 text-left font-medium text-slate-500 first:pl-0 last:pr-0 px-3"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {searchRows.slice(0, 10).map((row) => (
                        <tr key={row.keys[0]} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 pl-0 pr-3 text-slate-700 max-w-[220px] truncate">
                            {row.keys[0]}
                          </td>
                          <td className="py-3 px-3 tabular-nums text-slate-700">
                            {row.clicks.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 tabular-nums text-slate-500">
                            {row.impressions.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 tabular-nums text-slate-700">
                            {(row.ctr * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 pl-3 pr-0 tabular-nums text-slate-700">
                            {row.position.toFixed(1)}位
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI分析（最下部に配置） */}
            <AIInsights projectId={projectId} range={dateRange} searchRows={searchRows} />
          </>
        ) : null}
      </main>
    </>
  );
}
