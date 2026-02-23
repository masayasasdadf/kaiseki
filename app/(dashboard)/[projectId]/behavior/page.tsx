"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { type DateRange, formatPercent } from "@/lib/utils";
import { Loader2, MousePointerClick, ScrollText, ArrowRight } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BehaviorData {
  topPages: Array<{ path: string; views: number }>;
  landingPages: Array<{ path: string; sessions: number; bounceRate: number }>;
}

export default function BehaviorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<BehaviorData | null>(null);
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

  const SCROLL_DISTRIBUTION = [
    { range: "0–25%", label: easyMode ? "ほとんど読まれなかった" : "0–25%", color: "#fca5a5" },
    { range: "25–50%", label: easyMode ? "少し読まれた" : "25–50%", color: "#fcd34d" },
    { range: "50–75%", label: easyMode ? "半分以上読まれた" : "50–75%", color: "#86efac" },
    { range: "75–100%", label: easyMode ? "ほぼ読み切られた" : "75–100%", color: "#6ee7b7" },
  ];

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {easyMode ? "どのページが読まれたか" : "Landing & Behavior"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode
              ? "ページがどのくらい読まれているか確認できます"
              : "Page-level engagement and scroll analysis"}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : data ? (
          <>
            {/* よく見られたページ */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <ScrollText className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "よく読まれたページ" : "Top Pages by Views"}
                </h2>
              </div>
              {data.topPages.length > 0 ? (
                <div className="space-y-2">
                  {data.topPages.slice(0, 10).map((page, i) => {
                    const maxViews = data.topPages[0].views;
                    const pct = maxViews > 0 ? (page.views / maxViews) * 100 : 0;
                    return (
                      <div key={page.path} className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-5 text-right shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-700 font-mono truncate">
                              {page.path}
                            </span>
                            <span className="text-sm font-semibold text-slate-900 ml-2 shrink-0">
                              {page.views.toLocaleString()}
                              <span className="text-xs font-normal text-slate-400 ml-1">
                                {easyMode ? "回" : "views"}
                              </span>
                            </span>
                          </div>
                          <div className="bg-slate-100 rounded-full h-1.5">
                            <div
                              className="bg-indigo-400 h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center">
                  {easyMode ? "まだデータがありません" : "No data available"}
                </p>
              )}
            </div>

            {/* LP 直帰率テーブル */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <ArrowRight className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "最初のページで帰った人の割合" : "Landing Page Bounce Rate"}
                </h2>
              </div>
              {data.landingPages.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {[
                          easyMode ? "ページ" : "Path",
                          easyMode ? "訪問数" : "Sessions",
                          easyMode ? "すぐ離脱した割合" : "Bounce Rate",
                          "",
                        ].map((h, i) => (
                          <th key={i} className="pb-3 text-left font-medium text-slate-500 px-3 first:pl-0">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.landingPages.slice(0, 10).map((lp) => (
                        <tr key={lp.path} className="hover:bg-slate-50">
                          <td className="py-3 pl-0 pr-3 font-mono text-xs text-slate-700 max-w-[200px] truncate">
                            {lp.path}
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {lp.sessions.toLocaleString()}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={
                                lp.bounceRate > 70
                                  ? "text-red-600 font-semibold"
                                  : lp.bounceRate > 50
                                    ? "text-amber-600 font-medium"
                                    : "text-emerald-600 font-medium"
                              }
                            >
                              {formatPercent(lp.bounceRate)}
                            </span>
                          </td>
                          <td className="py-3 pl-3 pr-0">
                            <div className="w-24 bg-slate-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  lp.bounceRate > 70
                                    ? "bg-red-400"
                                    : lp.bounceRate > 50
                                      ? "bg-amber-400"
                                      : "bg-emerald-400"
                                }`}
                                style={{
                                  width: `${Math.min(100, lp.bounceRate)}%`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-8 text-center">
                  {easyMode ? "まだデータがありません" : "No data available"}
                </p>
              )}
            </div>

            {/* スクロール分布（疑似データ説明） */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick className="h-5 w-5 text-indigo-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "ページの読まれ方（スクロール深度）" : "Scroll Depth Distribution"}
                </h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                {easyMode
                  ? "訪問者がページをどこまで読み進めたか"
                  : "How far visitors scroll down the page"}
              </p>
              <div className="grid grid-cols-4 gap-3">
                {SCROLL_DISTRIBUTION.map((item) => (
                  <div
                    key={item.range}
                    className="rounded-xl p-3 text-center"
                    style={{ backgroundColor: `${item.color}30` }}
                  >
                    <div
                      className="text-lg font-bold"
                      style={{ color: item.color.replace("30", "") }}
                    >
                      {item.range}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                ※ スクロール深度はSDKのscroll_depthイベントで収集されます
              </p>
            </div>
          </>
        ) : null}
      </main>
    </>
  );
}
