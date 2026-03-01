"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { type DateRange } from "@/lib/utils";
import { Loader2, MousePointerClick } from "lucide-react";

interface ClickPoint {
  x: number;
  y: number;
}

interface PathStat {
  path: string;
  count: number;
}

interface HeatmapData {
  clicks: ClickPoint[];
  total: number;
  paths: PathStat[];
}

// Canvas にヒートマップを描画する
function renderHeatmap(canvas: HTMLCanvasElement, clicks: ClickPoint[]) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  if (clicks.length === 0) return;

  // オフスクリーンキャンバスでアルファ値の熱分布を計算
  const heat = document.createElement("canvas");
  heat.width = W;
  heat.height = H;
  const hCtx = heat.getContext("2d");
  if (!hCtx) return;

  const radius = Math.min(W, H) * 0.06;

  for (const { x, y } of clicks) {
    const cx = (x / 100) * W;
    const cy = (y / 100) * H;
    const grd = hCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grd.addColorStop(0, "rgba(255,255,255,0.45)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    hCtx.fillStyle = grd;
    hCtx.beginPath();
    hCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    hCtx.fill();
  }

  // アルファ値をカラーマップ（青→緑→黄→赤）に変換
  const src = hCtx.getImageData(0, 0, W, H);
  const out = ctx.createImageData(W, H);

  for (let i = 0; i < src.data.length; i += 4) {
    const a = src.data[i]; // 白なのでRGB全チャンネルが同値
    if (a === 0) continue;
    const t = a / 255;
    let r = 0,
      g = 0,
      b = 0;
    if (t < 0.25) {
      r = 0;
      g = Math.round(t * 4 * 255);
      b = 255;
    } else if (t < 0.5) {
      r = 0;
      g = 255;
      b = Math.round((1 - (t - 0.25) * 4) * 255);
    } else if (t < 0.75) {
      r = Math.round((t - 0.5) * 4 * 255);
      g = 255;
      b = 0;
    } else {
      r = 255;
      g = Math.round((1 - (t - 0.75) * 4) * 255);
      b = 0;
    }
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = Math.round(a * 0.85);
  }

  ctx.putImageData(out, 0, 0);
}

export default function HeatmapPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data, setData] = useState<HeatmapData | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(
    async (path: string, range: DateRange) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ range });
        if (path) qs.set("path", path);
        const res = await fetch(`/api/projects/${projectId}/heatmap?${qs}`);
        if (!res.ok) throw new Error();
        const json: HeatmapData = await res.json();
        setData(json);
        if (!path && json.paths[0]) {
          setSelectedPath(json.paths[0].path);
        }
      } catch {
        setData({ clicks: [], total: 0, paths: [] });
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  // 日付レンジが変わったらリセットして再取得
  useEffect(() => {
    setSelectedPath("");
    load("", dateRange);
  }, [dateRange, load]);

  // データが更新されたらCanvasを再描画
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    renderHeatmap(canvasRef.current, data.clicks);
  }, [data]);

  const hasData = data && data.paths.length > 0;

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />

      <main className="flex-1 p-6 space-y-6">
        {/* タイトル */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ヒートマップ</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode
              ? "どこがクリックされているか一目で分かります"
              : "ページ上のクリック分布を可視化します"}
          </p>
        </div>

        {/* パス選択 + 件数 */}
        {hasData && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-600">
              {easyMode ? "ページ" : "対象パス"}
            </label>
            <select
              value={selectedPath}
              onChange={(e) => {
                const p = e.target.value;
                setSelectedPath(p);
                load(p, dateRange);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {data.paths.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.path}（{p.count.toLocaleString()}クリック）
                </option>
              ))}
            </select>
            <span className="text-sm text-slate-500">
              表示中:{" "}
              <span className="font-semibold text-slate-800">
                {data.total.toLocaleString()}
              </span>{" "}
              クリック
            </span>
          </div>
        )}

        {/* ヒートマップ本体 */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-32">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="ml-3 text-slate-500">データを読み込み中...</span>
            </div>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center py-32 text-center px-6">
              <MousePointerClick className="h-12 w-12 text-slate-200 mb-4" />
              <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                クリックデータがまだありません。
                <br />
                SDKを導入するとここにヒートマップが表示されます。
              </p>
            </div>
          ) : (
            <div className="relative bg-slate-100" style={{ aspectRatio: "16/9" }}>
              {/* ページ先頭インジケーター */}
              <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none select-none">
                <span className="text-xs text-slate-400 bg-white/70 px-2 py-0.5 rounded">
                  ページ先頭
                </span>
              </div>

              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="w-full h-full"
              />

              {/* カラースケール凡例 */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm px-3 py-1.5 shadow-sm">
                <span className="text-xs text-slate-500">少</span>
                <div
                  className="h-2 w-20 rounded-full"
                  style={{
                    background:
                      "linear-gradient(to right, #3b82f6, #22c55e, #eab308, #ef4444)",
                  }}
                />
                <span className="text-xs text-slate-500">多</span>
              </div>
            </div>
          )}
        </div>

        {/* 説明テキスト */}
        {hasData && (
          <p className="text-xs text-slate-400 text-center">
            ※ Y軸はページ全体の縦幅に対する相対位置（上端=ページ先頭、下端=ページ末尾）
          </p>
        )}
      </main>
    </>
  );
}
