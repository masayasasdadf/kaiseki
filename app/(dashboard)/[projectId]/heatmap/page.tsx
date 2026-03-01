"use client";

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { type DateRange } from "@/lib/utils";
import {
  Loader2,
  MousePointerClick,
  AlertTriangle,
  Monitor,
  Smartphone,
  Flame,
  Dot,
} from "lucide-react";

type Device = "all" | "desktop" | "mobile";
type ViewMode = "heat" | "dots";

interface ClickPoint { x: number; y: number; }
interface PathStat { path: string; count: number; }
interface HeatmapData {
  clicks: ClickPoint[];
  total: number;
  paths: PathStat[];
  siteUrl: string | null;
  pageDocH: number | null;
}

// Desktop reference viewport width (same as what iframe renders at)
const DESKTOP_VW = 1280;
// Mobile reference viewport width
const MOBILE_VW = 390;

// ヒートマップ描画（密度→色グラデーション）
function renderHeatmap(canvas: HTMLCanvasElement, clicks: ClickPoint[]) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || clicks.length === 0) { ctx?.clearRect(0, 0, W, H); return; }

  const heat = document.createElement("canvas");
  heat.width = W;
  heat.height = H;
  const hCtx = heat.getContext("2d");
  if (!hCtx) return;

  // 密度に応じてradius を調整（クリックが多いほど小さくして粒度を上げる）
  const radius = Math.max(18, Math.min(80, Math.sqrt(W * H) * 0.035 / Math.pow(clicks.length, 0.18)));

  for (const { x, y } of clicks) {
    const cx = (x / 100) * W;
    const cy = (y / 100) * H;
    const grd = hCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grd.addColorStop(0, "rgba(255,255,255,0.65)");
    grd.addColorStop(0.4, "rgba(255,255,255,0.25)");
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
    if (a < 4) continue;
    const t = a / 255;
    let r = 0, g = 0, b = 0, alpha = 0;
    if (t < 0.2)       { r = 0;   g = Math.round(t * 5 * 180); b = 255;  alpha = Math.round(t * 5 * 160); }
    else if (t < 0.45) { const s = (t - 0.2) / 0.25; r = 0;   g = Math.round(180 + s * 75); b = Math.round(255 * (1 - s)); alpha = Math.round(160 + s * 40); }
    else if (t < 0.7)  { const s = (t - 0.45) / 0.25; r = Math.round(s * 255); g = 255; b = 0; alpha = Math.round(200 + s * 30); }
    else               { const s = (t - 0.7) / 0.3; r = 255; g = Math.round(255 * (1 - s)); b = 0; alpha = Math.round(230 + s * 25); }
    out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b;
    out.data[i + 3] = Math.min(255, alpha);
  }
  ctx.putImageData(out, 0, 0);
}

// ドット描画（個別クリック表示）
function renderDots(canvas: HTMLCanvasElement, clicks: ClickPoint[]) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  for (const { x, y } of clicks) {
    const cx = (x / 100) * W;
    const cy = (y / 100) * H;
    // グロー
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16);
    grd.addColorStop(0, "rgba(239,68,68,0.35)");
    grd.addColorStop(1, "rgba(239,68,68,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    // コア
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239,68,68,0.85)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export default function HeatmapPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [device, setDevice] = useState<Device>("desktop");
  const [viewMode, setViewMode] = useState<ViewMode>("heat");
  const [data, setData] = useState<HeatmapData | null>(null);
  const [selectedPath, setSelectedPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1280);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        setData({ clicks: [], total: 0, paths: [], siteUrl: null, pageDocH: null });
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

  const hasData = data && data.paths.length > 0;

  // --- 座標を合わせるための高さ計算 ---
  // pageDocH = 実際のページのピクセル高。これにデスクトップスケールを掛けた値が
  // キャンバスの論理高さ（= iframe が画面上で占める高さ）と一致する。
  const desktopScale = containerWidth / DESKTOP_VW;
  const pageDocH = data?.pageDocH ?? null;

  // 表示上の仮想高さ（CSSピクセル）
  const virtualH = (() => {
    if (device === "mobile") {
      return pageDocH ? Math.min(pageDocH, 6000) : 1200;
    }
    return pageDocH
      ? Math.min(Math.round(pageDocH * desktopScale), 6000)
      : Math.round(containerWidth * 1.6); // fallback: 1.6 aspect ratio
  })();

  // キャンバスの論理ピクセル解像度
  const canvasW = device === "mobile" ? MOBILE_VW : containerWidth;
  // canvasH はキャンバスの論理px = virtualH（ただしモバイルはscale=1なのでそのまま）
  const canvasH = device === "mobile"
    ? (pageDocH ? Math.min(pageDocH, 6000) : 1200)
    : (pageDocH ? Math.min(pageDocH, Math.round(6000 / desktopScale)) : Math.round(containerWidth * 1.6 / desktopScale));

  // canvas の論理サイズをセットして描画
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    canvas.width = canvasW;
    canvas.height = canvasH;
    if (viewMode === "dots") {
      renderDots(canvas, data.clicks);
    } else {
      renderHeatmap(canvas, data.clicks);
    }
  }, [data, viewMode, canvasW, canvasH]);

  function handleIframeLoad() {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc && doc.body && doc.body.innerHTML.trim() === "") setIframeBlocked(true);
    } catch { /* cross-origin = 正常 */ }
  }

  const iframeUrl = data?.siteUrl && selectedPath ? `${data.siteUrl}${selectedPath}` : null;

  // pageDocH が不明な場合に表示するバナー
  const noDocH = hasData && !pageDocH;

  const DEVICE_TABS: { id: Device; label: string; icon: React.ReactNode }[] = [
    { id: "desktop", label: easyMode ? "PC" : "デスクトップ", icon: <Monitor className="h-3.5 w-3.5" /> },
    { id: "mobile",  label: easyMode ? "スマホ" : "モバイル",   icon: <Smartphone className="h-3.5 w-3.5" /> },
    { id: "all",     label: "全て",                             icon: null },
  ];

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />

      <main className="flex-1 p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ヒートマップ</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {easyMode ? "どこがクリックされているか一目で分かります" : "ページ上のクリック分布を可視化します"}
          </p>
        </div>

        {/* コントロール行 */}
        <div className="flex flex-wrap items-center gap-3">
          {/* デバイス切り替え */}
          <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1">
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

          {/* 表示モード切り替え */}
          <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setViewMode("heat")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "heat" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              {easyMode ? "ヒートマップ" : "ヒート"}
            </button>
            <button
              onClick={() => setViewMode("dots")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "dots" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Dot className="h-3.5 w-3.5" />
              {easyMode ? "クリック点" : "ドット"}
            </button>
          </div>

          {hasData && (
            <>
              {/* パス選択 */}
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
                合計 <span className="font-semibold text-slate-800">{data.total.toLocaleString()}</span> クリック
              </span>
            </>
          )}
        </div>

        {/* pageDocH 未取得の案内 */}
        {noDocH && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            SDKを最新版に更新するとページ高さが記録され、縦方向の座標精度が向上します
          </div>
        )}

        {/* siteUrl 未設定の案内 */}
        {hasData && !data?.siteUrl && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            設定ページで計測ドメインを登録するとページのプレビューが重なって表示されます
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
                クリックデータがまだありません。<br />
                SDKを導入してサイトを操作するとここにヒートマップが表示されます。
              </p>
            </div>
          ) : (
            /* スクロール可能コンテナ: 高さはビューポートの80%に制限してスクロール */
            <div
              ref={containerRef}
              className="relative bg-slate-800 overflow-y-auto"
              style={{ maxHeight: "80vh", minHeight: 400 }}
            >
              {/* ===== モバイル ===== */}
              {device === "mobile" && (
                <div className="relative mx-auto" style={{ width: MOBILE_VW, height: virtualH }}>
                  {/* iframeプレビュー */}
                  {iframeUrl && !iframeBlocked && (
                    <iframe
                      ref={iframeRef}
                      src={iframeUrl}
                      onLoad={handleIframeLoad}
                      className="absolute top-0 left-0 border-0 pointer-events-none"
                      style={{ width: MOBILE_VW, height: pageDocH ?? virtualH }}
                      sandbox="allow-scripts allow-same-origin"
                      title="Mobile site preview"
                    />
                  )}
                  {iframeBlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-700 text-center gap-2">
                      <AlertTriangle className="h-8 w-8 text-slate-400" />
                      <p className="text-xs text-slate-400">プレビューをブロックされました</p>
                    </div>
                  )}
                  {/* キャンバスオーバーレイ（mobile: scale=1なので1:1で重なる） */}
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{ width: MOBILE_VW, height: virtualH }}
                  />
                  {/* 縦位置ガイドライン */}
                  <PageGuides virtualH={virtualH} />
                </div>
              )}

              {/* ===== デスクトップ / 全て ===== */}
              {device !== "mobile" && (
                <div className="relative" style={{ height: virtualH }}>
                  {/* iframeプレビュー: 1280px で描画してスケールダウン */}
                  {iframeUrl && !iframeBlocked && (
                    <iframe
                      ref={iframeRef}
                      src={iframeUrl}
                      onLoad={handleIframeLoad}
                      className="absolute top-0 left-0 border-0 pointer-events-none"
                      style={{
                        width: DESKTOP_VW,
                        height: pageDocH ?? Math.round(virtualH / desktopScale),
                        transform: `scale(${desktopScale})`,
                        transformOrigin: "top left",
                      }}
                      sandbox="allow-scripts allow-same-origin"
                      title="Desktop site preview"
                    />
                  )}
                  {iframeBlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-700 text-center gap-2">
                      <AlertTriangle className="h-8 w-8 text-slate-400" />
                      <p className="text-xs text-slate-400">プレビューをブロックされました</p>
                    </div>
                  )}
                  {/* キャンバス: containerWidth × virtualH でピクセルパーフェクトに重なる */}
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{ width: containerWidth, height: virtualH }}
                  />
                  {/* 縦位置ガイドライン */}
                  <PageGuides virtualH={virtualH} />
                </div>
              )}

              {/* カラースケール凡例（右下固定） */}
              {viewMode === "heat" && (
                <div className="sticky bottom-3 float-right mr-3 flex items-center gap-2 rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5 shadow-sm z-20 pointer-events-none">
                  <span className="text-xs text-white/70">低</span>
                  <div className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(to right,#3b82f6,#22c55e,#eab308,#ef4444)" }} />
                  <span className="text-xs text-white/70">高</span>
                </div>
              )}
            </div>
          )}
        </div>

        {hasData && (
          <p className="text-xs text-slate-400 text-center">
            {pageDocH
              ? `ページ高さ ${pageDocH.toLocaleString()}px を実寸で表示（スクロール可）`
              : "※ 縦位置は推定値です。SDKを最新版に更新すると精度が向上します"}
          </p>
        )}
      </main>
    </>
  );
}

// 25%・50%・75%・100% 位置に補助ラインを表示
function PageGuides({ virtualH }: { virtualH: number }) {
  const marks = [25, 50, 75];
  return (
    <>
      {marks.map((pct) => (
        <div
          key={pct}
          className="absolute left-0 right-0 pointer-events-none z-10"
          style={{ top: (pct / 100) * virtualH }}
        >
          <div className="border-t border-dashed border-white/20 w-full" />
          <span className="absolute right-2 -translate-y-full text-[10px] text-white/40 leading-none pb-0.5">
            {pct}%
          </span>
        </div>
      ))}
    </>
  );
}
