"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { AIPageInsights } from "@/components/dashboard/ai-page-insights";
import { type DateRange, formatPercent } from "@/lib/utils";
import { Loader2, RefreshCw, Layers, Smartphone, Globe } from "lucide-react";

interface SegmentStats {
  segment: string;
  sessions: number;
  conversions: number;
  cvr: number;
  bounceRate: number;
  engagementRate: number;
  avgDuration: number;
  avgScroll: number;
}

interface SegmentsData {
  byDevice: SegmentStats[];
  byChannel: SegmentStats[];
  totalSessions: number;
  totalConversions: number;
  overallCvr: number;
}

// 指標の良し悪し判定（全セグメントの平均と比較して色を付ける）
function cvrColor(cvr: number, avg: number) {
  if (avg === 0) return "text-slate-700";
  if (cvr >= avg * 1.2) return "text-emerald-600 font-semibold";
  if (cvr <= avg * 0.8) return "text-red-500";
  return "text-slate-700";
}
function bounceColor(rate: number, avg: number) {
  if (avg === 0) return "text-slate-700";
  if (rate <= avg * 0.8) return "text-emerald-600 font-semibold";
  if (rate >= avg * 1.2) return "text-red-500";
  return "text-slate-700";
}

function formatDuration(sec: number) {
  if (sec < 60) return `${sec}秒`;
  return `${Math.floor(sec / 60)}分${sec % 60}秒`;
}

function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase();
  if (d === "mobile") return <Smartphone className="h-4 w-4 text-slate-400" />;
  if (d === "tablet") return <Smartphone className="h-4 w-4 text-slate-400 opacity-60" />;
  return <Globe className="h-4 w-4 text-slate-400" />;
}

const DEVICE_LABEL: Record<string, string> = {
  desktop: "デスクトップ",
  mobile: "モバイル",
  tablet: "タブレット",
  unknown: "不明",
};

function SegmentTable({
  data,
  overallCvr,
  overallBounce,
  totalSessions,
  easyMode,
}: {
  data: SegmentStats[];
  overallCvr: number;
  overallBounce: number;
  totalSessions: number;
  easyMode: boolean;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">データがありません</p>;
  }

  const maxSessions = data[0].sessions;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {[
              easyMode ? "種別" : "セグメント",
              easyMode ? "訪問数" : "セッション",
              "CV数",
              "CVR",
              easyMode ? "すぐ離脱" : "直帰率",
              easyMode ? "ちゃんと読んだ" : "エンゲージ率",
              easyMode ? "平均滞在" : "平均時間",
              easyMode ? "読んだ深さ" : "平均スクロール",
            ].map((h) => (
              <th key={h} className="pb-3 text-left text-xs font-medium text-slate-500 px-2 first:pl-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row) => {
            const share = totalSessions > 0 ? Math.round((row.sessions / totalSessions) * 100) : 0;
            const deviceLabel = DEVICE_LABEL[row.segment.toLowerCase()] ?? row.segment;
            return (
              <tr key={row.segment} className="hover:bg-slate-50 transition-colors">
                {/* セグメント名 */}
                <td className="py-3 pl-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <DeviceIcon device={row.segment} />
                    <span className="font-medium text-slate-800">{deviceLabel}</span>
                  </div>
                </td>

                {/* セッション数 + シェアバー */}
                <td className="py-3 px-2">
                  <div className="flex flex-col gap-1">
                    <span className="tabular-nums text-slate-700">
                      {row.sessions.toLocaleString()}
                      <span className="text-slate-400 text-xs ml-1">({share}%)</span>
                    </span>
                    <div className="h-1 w-24 rounded-full bg-slate-100">
                      <div
                        className="h-1 rounded-full bg-indigo-400"
                        style={{ width: `${maxSessions > 0 ? (row.sessions / maxSessions) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </td>

                {/* CV数 */}
                <td className="py-3 px-2 tabular-nums text-slate-700">
                  {row.conversions.toLocaleString()}
                </td>

                {/* CVR */}
                <td className={`py-3 px-2 tabular-nums ${cvrColor(row.cvr, overallCvr)}`}>
                  {formatPercent(row.cvr)}
                </td>

                {/* 直帰率 */}
                <td className={`py-3 px-2 tabular-nums ${bounceColor(row.bounceRate, overallBounce)}`}>
                  {formatPercent(row.bounceRate)}
                </td>

                {/* エンゲージ率 */}
                <td className="py-3 px-2 tabular-nums text-slate-700">
                  {formatPercent(row.engagementRate)}
                </td>

                {/* 平均滞在時間 */}
                <td className="py-3 px-2 tabular-nums text-slate-700">
                  {formatDuration(row.avgDuration)}
                </td>

                {/* 平均スクロール */}
                <td className="py-3 px-2">
                  <div className="flex items-center gap-1.5">
                    <span className="tabular-nums text-slate-700">{row.avgScroll}%</span>
                    <div className="h-1.5 w-16 rounded-full bg-slate-100">
                      <div
                        className="h-1.5 rounded-full bg-violet-400"
                        style={{ width: `${row.avgScroll}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// CVR差分カード（最良セグメント vs 最悪セグメントの差を強調）
function InsightBanner({ data, label, overallCvr }: { data: SegmentStats[]; label: string; overallCvr: number }) {
  if (data.length < 2) return null;
  const sorted = [...data].filter((d) => d.sessions >= 10).sort((a, b) => b.cvr - a.cvr);
  if (sorted.length < 2) return null;
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const diff = Math.round((best.cvr - worst.cvr) * 10) / 10;
  if (diff < 0.5) return null;
  const bestLabel = DEVICE_LABEL[best.segment.toLowerCase()] ?? best.segment;
  const worstLabel = DEVICE_LABEL[worst.segment.toLowerCase()] ?? worst.segment;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span className="font-semibold">{label}格差：</span>
      {bestLabel}のCVR {formatPercent(best.cvr)} に対し、
      {worstLabel}は {formatPercent(worst.cvr)}（差 {diff}pt）。
      全体平均 {formatPercent(overallCvr)} と比較して{best.cvr > overallCvr * 1.5 ? `${bestLabel}への集中投資が有効かもしれません。` : "改善の余地があります。"}
    </div>
  );
}

export default function SegmentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<SegmentsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/segments?range=${dateRange}`);
      if (!res.ok) throw new Error("取得失敗");
      setData(await res.json());
    } catch {
      setError("データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const overallBounce = data
    ? data.byDevice.reduce((sum, d) => sum + d.bounceRate * d.sessions, 0) /
      (data.totalSessions || 1)
    : 0;

  const aiContext = useMemo(() => {
    if (!data) return "";
    const fmtRow = (r: SegmentStats) =>
      `  ${r.segment}: ${r.sessions}セッション, CVR ${r.cvr}%, 直帰${r.bounceRate}%, エンゲージ${r.engagementRate}%, 平均滞在${r.avgDuration}秒, スクロール${r.avgScroll}%`;
    return [
      `セグメント比較（${dateRange}）`,
      `全体: ${data.totalSessions}セッション, ${data.totalConversions}CV, CVR ${data.overallCvr}%`,
      "",
      "デバイス別:",
      ...data.byDevice.map(fmtRow),
      "",
      "チャネル別:",
      ...data.byChannel.map(fmtRow),
    ].join("\n");
  }, [data, dateRange]);

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-6 space-y-6">
        {/* タイトル */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-6 w-6 text-slate-600" />
              {easyMode ? "セグメント比較" : "Segment Comparison"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {easyMode
                ? "デバイスや流入経路ごとに成果の違いを比較します"
                : "Compare CVR and engagement across devices and channels"}
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
            <span className="ml-3 text-slate-500">集計中...</span>
          </div>
        ) : data ? (
          <>
            {/* 全体サマリー */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: easyMode ? "総訪問数" : "総セッション", value: data.totalSessions.toLocaleString(), sub: "" },
                { label: easyMode ? "総CV数" : "総コンバージョン", value: data.totalConversions.toLocaleString(), sub: "" },
                { label: "全体CVR", value: formatPercent(data.overallCvr), sub: "（基準値）" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                    {value}
                    {sub && <span className="text-xs text-slate-400 font-normal ml-1">{sub}</span>}
                  </p>
                </div>
              ))}
            </div>

            {/* ===== デバイス別 ===== */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "デバイス別の成果" : "デバイス別"}
                </h2>
              </div>
              <InsightBanner
                data={data.byDevice}
                label="デバイス間"
                overallCvr={data.overallCvr}
              />
              <SegmentTable
                data={data.byDevice}
                overallCvr={data.overallCvr}
                overallBounce={overallBounce}
                totalSessions={data.totalSessions}
                easyMode={easyMode}
              />
            </div>

            {/* ===== チャネル別 ===== */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-800">
                  {easyMode ? "流入経路別の成果" : "チャネル別"}
                </h2>
              </div>
              <InsightBanner
                data={data.byChannel}
                label="チャネル間"
                overallCvr={data.overallCvr}
              />
              <SegmentTable
                data={data.byChannel}
                overallCvr={data.overallCvr}
                overallBounce={overallBounce}
                totalSessions={data.totalSessions}
                easyMode={easyMode}
              />
            </div>

            {/* AI解説 */}
            <AIPageInsights
              projectId={projectId}
              context={aiContext}
              label="セグメント比較"
            />

            <p className="text-xs text-slate-400">
              ※ 緑色 = 全体平均より20%以上良い　赤色 = 全体平均より20%以上悪い
            </p>
          </>
        ) : null}
      </main>
    </>
  );
}
