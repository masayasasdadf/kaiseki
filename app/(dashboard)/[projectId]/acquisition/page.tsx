"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { ChannelTable } from "@/components/dashboard/channel-table";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { type DateRange, formatPercent } from "@/lib/utils";
import { Loader2 } from "lucide-react";
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

export default function AcquisitionPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/metrics?range=${dateRange}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {easyMode ? "どこから来たか" : "Acquisition"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode
              ? "お客さんがどのルートでサイトにやってきたか分かります"
              : "Traffic sources and channel performance"}
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
                {easyMode ? "流入元別 訪問数" : "Sessions by Channel"}
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
                      name={easyMode ? "訪問数" : "Sessions"}
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
                {easyMode ? "流入元の詳細" : "Channel Details"}
              </h2>
              <ChannelTable
                data={data.channels}
                totalSessions={data.kpi.sessions}
              />
            </div>

            {/* CVR by channel */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "流入元別 成果率" : "CVR by Channel"}
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
          </>
        ) : null}
      </main>
    </>
  );
}
