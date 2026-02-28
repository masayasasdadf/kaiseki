"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { ChannelTable } from "@/components/dashboard/channel-table";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { type DateRange, formatPercent } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";
import { CHANNEL_COLORS } from "@/lib/attribution";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MetricsData {
  kpi: {
    sessions: number;
    users: number;
    conversions: number;
    cvr: number;
  };
  channels: Array<{
    name: string;
    sessions: number;
    visitors: number;
    conversions: number;
  }>;
}

interface SearchRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export default function AcquisitionPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Search Console
  const [scRows, setScRows] = useState<SearchRow[] | null>(null);
  const [scConnected, setScConnected] = useState(false);
  const [scLoading, setScLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/metrics?range=${dateRange}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  const fetchSC = useCallback(async () => {
    setScLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/search-console?range=${dateRange}`
      );
      if (!res.ok) return;
      const json = await res.json();
      setScConnected(json.connected);
      if (json.rows) setScRows(json.rows);
    } finally {
      setScLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => {
    fetchData();
    fetchSC();
  }, [fetchData, fetchSC]);

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {easyMode ? "どこから来たか" : "流入分析"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode
              ? "お客さんがどのルートでサイトにやってきたか分かります"
              : "トラフィックの流入元とチャネル別パフォーマンス"}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : data ? (
          <>
            {/* チャネル別バーチャート */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "流入元別 訪問数" : "チャネル別セッション数"}
              </h2>
              {data.channels.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={data.channels}
                    margin={{ top: 4, right: 16, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "0.75rem",
                        border: "1px solid #e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="sessions"
                      name={easyMode ? "訪問数" : "セッション数"}
                      radius={[4, 4, 0, 0]}
                      fill="#6366f1"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center">
                  データがありません
                </p>
              )}
            </div>

            {/* チャネル別詳細テーブル */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "流入元の詳細" : "チャネル詳細"}
              </h2>
              <ChannelTable
                data={data.channels}
                totalSessions={data.kpi.sessions}
              />
            </div>

            {/* CVR by channel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "流入元別 成果率" : "チャネル別 CVR"}
              </h2>
              <div className="space-y-3">
                {data.channels.map((ch) => {
                  const cvr =
                    ch.sessions > 0 ? (ch.conversions / ch.sessions) * 100 : 0;
                  const color =
                    CHANNEL_COLORS[ch.name as keyof typeof CHANNEL_COLORS] ||
                    "#94A3B8";
                  return (
                    <div key={ch.name} className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm text-slate-700 w-32 shrink-0 truncate">
                        {ch.name}
                      </span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, cvr * 5)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-12 text-right">
                        {formatPercent(cvr)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Search Console 検索クエリ */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Search className="h-4 w-4 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "どんなキーワードで来たか" : "検索クエリ（Search Console）"}
                </h2>
              </div>

              {!scConnected ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Search className="h-8 w-8 text-slate-200" />
                  <p className="text-sm text-slate-500">
                    Search Console と連携すると、どのキーワードで
                    <br />
                    サイトが検索されているか確認できます
                  </p>
                  <a
                    href={`/${projectId}/settings`}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    設定ページから連携する →
                  </a>
                </div>
              ) : scLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : scRows && scRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {[
                          easyMode ? "検索キーワード" : "クエリ",
                          "クリック",
                          "表示回数",
                          "CTR",
                          easyMode ? "掲載順位" : "平均順位",
                        ].map((h) => (
                          <th
                            key={h}
                            className="pb-3 text-left font-medium text-slate-500 first:pl-0 last:pr-0 px-3 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pl-0 pr-3 text-slate-800 max-w-[180px] truncate">
                            {row.keys[0]}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums font-medium text-indigo-700">
                            {row.clicks.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-slate-600">
                            {row.impressions.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 tabular-nums text-slate-600">
                            {(row.ctr * 100).toFixed(1)}%
                          </td>
                          <td className="py-2.5 pl-3 pr-0 tabular-nums text-slate-600">
                            {row.position.toFixed(1)}位
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center">
                  この期間のデータがありません
                </p>
              )}
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}
