"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { KPICard } from "@/components/dashboard/kpi-card";
import { ChannelTable } from "@/components/dashboard/channel-table";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { getEmptyState } from "@/lib/terminology";
import { formatPercent, calcChangeRate, type DateRange } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";

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

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/projects/${projectId}/metrics?range=${dateRange}`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
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

  return (
    <>
      <Header
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <main className="flex-1 p-6 space-y-6">
        {/* ページタイトル */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {easyMode ? "ダッシュボード" : "Overview"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {easyMode
                ? "サイト全体の状況をひと目で確認できます"
                : "Site-wide performance summary"}
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

            {/* トレンド + チャネル */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* トレンド折れ線 */}
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-800 mb-4">
                  {easyMode ? "訪問数の推移" : "Session Trend"}
                </h2>
                <TrendChart data={data.trend} />
              </div>

              {/* ページビュー・滞在時間 */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "その他の指標" : "Other Metrics"}
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">
                      {easyMode ? "ページ閲覧数" : "Page Views"}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {data.kpi.pageviews.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">
                      {easyMode ? "平均滞在時間" : "Avg. Session Duration"}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">
                      {data.kpi.avgDuration < 60
                        ? `${data.kpi.avgDuration}秒`
                        : `${Math.floor(data.kpi.avgDuration / 60)}分`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-600">
                      {easyMode ? "成果率" : "CVR"}
                    </span>
                    <span className="text-sm font-semibold text-indigo-700">
                      {formatPercent(data.kpi.cvr)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* チャネル別テーブル */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "どこから来たか" : "Acquisition by Channel"}
              </h2>
              <ChannelTable
                data={data.channels}
                totalSessions={data.kpi.sessions}
              />
            </div>

            {/* LP別テーブル */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "最初に見られたページ" : "Landing Pages"}
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
                          easyMode ? "ページ" : "Path",
                          easyMode ? "訪問数" : "Sessions",
                          easyMode ? "訪問した人" : "Users",
                          easyMode ? "すぐ離脱した割合" : "Bounce Rate",
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
                          <td className="py-3 pl-0 pr-3 font-mono text-xs text-slate-700 max-w-[200px] truncate">
                            {lp.path}
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
          </>
        ) : null}
      </main>
    </>
  );
}
