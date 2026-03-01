"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { type DateRange } from "@/lib/utils";
import { Loader2, MousePointerClick, Eye, EyeOff, AlertTriangle } from "lucide-react";

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
  siteUrl: string | null;
}

// Canvas にヒートマップを描画する
function renderHeatmap(canvas: HTMLCanvasElement, clicks: ClickPoint[]) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  if (clicks.length === 0) return;

  const heat = document.createElement("canvas");
  heat.width = W;
  heat.height = H;
  const hCtx = heat.getContext("2d");
  if (!hCtx) return;

  const radius = Math.min(W, H) * 0.05;

  for (const { x, y } of clicks) {
    const cx = (x / 100) * W;
    const cy = (y / 100) * H;
    const grd = hCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grd.addColorStop(0, "rgba(255,255,255,0.5)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    hCtx.fillStyle = grd;
    hCtx.beginPath();
    hCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    hCtx.fill();
  }

  const src = hCtx.getImageData(0, 0, W, H);
  const out = ctx.createImageData(W, H);

  for (let i = 0; i < src.data.length; i += 4) {
    const a = src.data[i];
    if (a === 0) continue;
    const t = a / 255;
    let r = 0, g = 0, b = 0;
    if (t < 0.25) { r = 0; g = Math.round(t * 4 * 255); b = 255; }
    else if (t < 0.5) { r = 0; g = 255; b = Math.round((1 - (t - 0.25) * 4) * 255); }
    else if (t < 0.75) { r = Math.round((t - 0.5) * 4 * 255); g = 255; b = 0; }
    else { r = 255; g = Math.round((1 - (t - 0.75) * 4) * 255); b = 0; }
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = Math.round(a * 0.82);
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
  const [showPreview, setShowPreview] = useState(true);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (path: string, range: DateRange) => {
      setLoading(true);
      setIframeBlocked(false);
      try {
        const qs = new URLSearchParams({ range });
        if (path) qs.set("path", path);
        const res = await fetch(`/api/projects/${projectId}/heatmap?${qs}`);
        if (!res.ok) throw new Error();
        const json: HeatmapData = await res.json();
        setData(json);
        if (!path && json.paths[0]) setSelectedPath(json.paths[0].path);
      } catch {
        setData({ clicks: [], total: 0, paths: [], siteUrl: null });
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    setSelectedPath("");
    load("", dateRange);
  }, [dateRange, load]);

  // データ更新 → キャンバス再描画
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    // コンテナサイズに合わせてcanvasの論理サイズを設定
    const container = containerRef.current;
    if (container) {
      canvasRef.current.width = container.clientWidth;
      canvasRef.current.height = container.clientHeight;
    }
    renderHeatmap(canvasRef.current, data.clicks);
  }, [data]);

  // iframeのロード検知（X-Frame-Options で弾かれた場合を判定）
  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      // アクセスできて body が空 → ブロックされた可能性
      if (doc && doc.body && doc.body.innerHTML.trim() === "") {
        setIframeBlocked(true);
      }
    } catch {
      // cross-origin → 正常にロード済み（アクセス制限はブラウザ側）
    }
  }

  const hasData = data && data.paths.length > 0;
  const iframeUrl = data?.siteUrl && selectedPath
    ? `${data.siteUrl}${selectedPath}`
    : null;

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />

      <main className="flex-1 p-6 space-y-6">
        {/* タイトル */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ヒートマップ</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode ? "どこがクリックされているか一目で分かります" : "ページ上のクリック分布を可視化します"}
          </p>
        </div>

        {/* コントロールバー */}
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
              合計{" "}
              <span className="font-semibold text-slate-800">
                {data.total.toLocaleString()}
              </span>{" "}
              クリック
            </span>

            {/* プレビュー表示切り替え */}
            {iframeUrl && (
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPreview ? "プレビューを隠す" : "プレビューを表示"}
              </button>
            )}
          </div>
        )}

        {/* ヒートマップ本体 */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
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
                SDKを導入してサイトを操作するとここにヒートマップが表示されます。
              </p>
            </div>
          ) : (
            /* プレビュー + ヒートマップ重ね合わせ */
            <div
              ref={containerRef}
              className="relative bg-slate-100 overflow-hidden"
              style={{ height: "680px" }}
            >
              {/* iframe サイトプレビュー */}
              {iframeUrl && showPreview && !iframeBlocked && (
                <iframe
                  ref={iframeRef}
                  src={iframeUrl}
                  onLoad={handleIframeLoad}
                  className="absolute inset-0 border-0 pointer-events-none"
                  style={{
                    width: "1280px",
                    height: "100%",
                    transformOrigin: "top left",
                    transform: `scaleX(${containerRef.current ? containerRef.current.clientWidth / 1280 : 1})`,
                  }}
                  sandbox="allow-scripts allow-same-origin"
                  title="Site preview"
                />
              )}

              {/* iframeブロック時のフォールバック */}
              {iframeBlocked && showPreview && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-center gap-2">
                  <AlertTriangle className="h-8 w-8 text-slate-300" />
                  <p className="text-xs text-slate-400">
                    このサイトはプレビュー表示をブロックしています
                  </p>
                </div>
              )}

              {/* ヒートマップ canvas オーバーレイ */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ width: "100%", height: "100%" }}
              />

              {/* カラースケール凡例 */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm px-3 py-1.5 shadow-sm">
                <span className="text-xs text-slate-500">少</span>
                <div
                  className="h-2 w-20 rounded-full"
                  style={{
                    background: "linear-gradient(to right, #3b82f6, #22c55e, #eab308, #ef4444)",
                  }}
                />
                <span className="text-xs text-slate-500">多</span>
              </div>

              {/* siteUrl未設定の案内 */}
              {!iframeUrl && (
                <div className="absolute top-3 left-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
                  <p className="text-xs text-amber-700">
                    設定ページで計測ドメインを登録するとサイトのプレビューが表示されます
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {hasData && (
          <p className="text-xs text-slate-400 text-center">
            ※ Y軸はページ全体の高さに対する相対位置。スクロールが多いページは下部のクリックが薄く表示されます
          </p>
        )}
      </main>
    </>
  );
}
