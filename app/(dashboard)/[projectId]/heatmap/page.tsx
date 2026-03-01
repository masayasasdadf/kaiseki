"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { type DateRange } from "@/lib/utils";
import { Loader2, MousePointerClick, Eye, EyeOff, AlertTriangle, Monitor, Smartphone } from "lucide-react";

type Device = "all" | "desktop" | "mobile";

interface ClickPoint { x: number; y: number; }
interface PathStat { path: string; count: number; }
interface HeatmapData {
  clicks: ClickPoint[];
  total: number;
  paths: PathStat[];
  siteUrl: string | null;
}

// Desktop preview: 1280px 想定の仮想ビューポート幅
const DESKTOP_VW = 1280;
// Mobile preview: iPhone 相当
const MOBILE_VW = 390;

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

  const radius = Math.min(W, H) * 0.06;
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
    if (t < 0.25)      { r = 0;   g = Math.round(t * 4 * 255); b = 255; }
    else if (t < 0.5)  { r = 0;   g = 255; b = Math.round((1 - (t - 0.25) * 4) * 255); }
    else if (t < 0.75) { r = Math.round((t - 0.5) * 4 * 255); g = 255; b = 0; }
    else               { r = 255; g = Math.round((1 - (t - 0.75) * 4) * 255); b = 0; }
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
    out.data[i + 3] = Math.round(a * 0.82);
  }
  ctx.putImageData(out, 0, 0);
}

export default function HeatmapPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [device, setDevice] = useState<Device>("desktop");
  const [data, setData] = useState<HeatmapData | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1280);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // コンテナ幅の追跡（デスクトップiframeのスケール計算用）
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const load = useCallback(
    async (path: string, range: DateRange, dev: Device) => {
      setLoading(true);
      setIframeBlocked(false);
      try {
        const qs = new URLSearchParams({ range, device: dev });
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
    load("", dateRange, device);
  }, [dateRange, device, load]);

  // キャンバスの論理サイズをデバイスに合わせてセット → 描画
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    const h = containerRef.current?.clientHeight ?? 680;
    canvas.width  = device === "mobile" ? MOBILE_VW : containerWidth;
    canvas.height = h;
    renderHeatmap(canvas, data.clicks);
  }, [data, device, containerWidth]);

  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc && doc.body && doc.body.innerHTML.trim() === "") setIframeBlocked(true);
    } catch { /* cross-origin = 正常 */ }
  }

  const hasData = data && data.paths.length > 0;
  const iframeUrl = data?.siteUrl && selectedPath ? `${data.siteUrl}${selectedPath}` : null;
  const desktopScale = containerWidth / DESKTOP_VW;

  const DEVICE_TABS: { id: Device; label: string; icon: React.ReactNode }[] = [
    { id: "desktop", label: easyMode ? "PC" : "デスクトップ", icon: <Monitor className="h-3.5 w-3.5" /> },
    { id: "mobile",  label: easyMode ? "スマホ" : "モバイル",   icon: <Smartphone className="h-3.5 w-3.5" /> },
    { id: "all",     label: "全て",                             icon: null },
  ];

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />

      <main className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ヒートマップ</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode ? "どこがクリックされているか一目で分かります" : "ページ上のクリック分布を可視化します"}
          </p>
        </div>

        {/* デバイス切り替えタブ */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 w-fit">
          {DEVICE_TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setDevice(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                device === id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* コントロールバー */}
        {hasData && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-600">
              {easyMode ? "ページ" : "対象パス"}
            </label>
            <select
              value={selectedPath}
              onChange={(e) => { const p = e.target.value; setSelectedPath(p); load(p, dateRange, device); }}
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
              <span className="font-semibold text-slate-800">{data.total.toLocaleString()}</span>{" "}
              クリック
            </span>

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
            <div ref={containerRef} className="relative bg-slate-100 overflow-hidden" style={{ height: 680 }}>

              {/* ===== モバイルプレビュー: 390px 幅をセンタリング ===== */}
              {device === "mobile" && (
                <div className="absolute inset-0 flex justify-center overflow-hidden">
                  <div className="relative" style={{ width: MOBILE_VW, height: "100%" }}>
                    {iframeUrl && showPreview && !iframeBlocked && (
                      <iframe
                        ref={iframeRef}
                        src={iframeUrl}
                        onLoad={handleIframeLoad}
                        className="absolute inset-0 border-0 pointer-events-none"
                        style={{ width: MOBILE_VW, height: "100%" }}
                        sandbox="allow-scripts allow-same-origin"
                        title="Mobile site preview"
                      />
                    )}
                    {iframeBlocked && showPreview && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-center gap-2">
                        <AlertTriangle className="h-8 w-8 text-slate-300" />
                        <p className="text-xs text-slate-400">プレビューをブロックされました</p>
                      </div>
                    )}
                    {/* canvas はモバイル列の上だけに重ねる */}
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 pointer-events-none"
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                  {/* 左右のグレー帯 */}
                  <div className="absolute inset-0 -z-0 flex">
                    <div className="flex-1 bg-slate-200/60" />
                    <div style={{ width: MOBILE_VW }} />
                    <div className="flex-1 bg-slate-200/60" />
                  </div>
                </div>
              )}

              {/* ===== PC / 全て プレビュー: 1280px をスケールダウン ===== */}
              {device !== "mobile" && (
                <>
                  {iframeUrl && showPreview && !iframeBlocked && (
                    <iframe
                      ref={iframeRef}
                      src={iframeUrl}
                      onLoad={handleIframeLoad}
                      className="absolute top-0 left-0 border-0 pointer-events-none"
                      style={{
                        width: DESKTOP_VW,
                        height: `${680 / desktopScale}px`,
                        transform: `scale(${desktopScale})`,
                        transformOrigin: "top left",
                      }}
                      sandbox="allow-scripts allow-same-origin"
                      title="Desktop site preview"
                    />
                  )}
                  {iframeBlocked && showPreview && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-center gap-2">
                      <AlertTriangle className="h-8 w-8 text-slate-300" />
                      <p className="text-xs text-slate-400">プレビューをブロックされました</p>
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 pointer-events-none"
                    style={{ width: "100%", height: "100%" }}
                  />
                </>
              )}

              {/* カラースケール凡例 */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm px-3 py-1.5 shadow-sm z-10">
                <span className="text-xs text-slate-500">少</span>
                <div className="h-2 w-20 rounded-full" style={{ background: "linear-gradient(to right,#3b82f6,#22c55e,#eab308,#ef4444)" }} />
                <span className="text-xs text-slate-500">多</span>
              </div>

              {/* siteUrl 未設定の案内 */}
              {!iframeUrl && (
                <div className="absolute top-3 left-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 z-10">
                  <p className="text-xs text-amber-700">設定ページで計測ドメインを登録するとプレビューが表示されます</p>
                </div>
              )}
            </div>
          )}
        </div>

        {hasData && (
          <p className="text-xs text-slate-400 text-center">
            ※ Y軸はページ全体の高さに対する相対位置です
          </p>
        )}
      </main>
    </>
  );
}
