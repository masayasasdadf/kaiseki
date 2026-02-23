"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import {
  Radio,
  Globe,
  MousePointerClick,
  Target,
  Zap,
  Circle,
} from "lucide-react";
import { type DateRange } from "@/lib/utils";
import { CHANNEL_COLORS } from "@/lib/attribution";

interface LiveEvent {
  id: string;
  type: string;
  sessionId?: string;
  path?: string;
  conversionName?: string;
  channelGroup?: string;
  eventName?: string;
  props?: Record<string, unknown>;
  timestamp: string;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  session_start: <Globe className="h-4 w-4 text-blue-500" />,
  page_view: <Globe className="h-4 w-4 text-slate-400" />,
  cta_click: <MousePointerClick className="h-4 w-4 text-indigo-500" />,
  conversion: <Target className="h-4 w-4 text-emerald-500" />,
  custom: <Zap className="h-4 w-4 text-amber-500" />,
  connected: <Circle className="h-4 w-4 text-emerald-400" />,
};

export default function LivePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("today");
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({ sessions: 0, pageviews: 0, conversions: 0 });
  const eventSourceRef = useRef<EventSource | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/live?projectId=${projectId}`);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e) => {
      try {
        const event: Omit<LiveEvent, "id"> = JSON.parse(e.data);
        if (event.type === "connected") return;

        const newEvent: LiveEvent = {
          ...event,
          id: Math.random().toString(36).slice(2),
          timestamp: event.timestamp || new Date().toISOString(),
        };

        setEvents((prev) => [newEvent, ...prev].slice(0, 100));

        // 統計更新
        setStats((prev) => ({
          sessions: prev.sessions + (event.type === "session_start" ? 1 : 0),
          pageviews: prev.pageviews + (event.type === "page_view" ? 1 : 0),
          conversions: prev.conversions + (event.type === "conversion" ? 1 : 0),
        }));
      } catch {
        // ignore parse errors
      }
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [projectId]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getEventLabel = (event: LiveEvent): string => {
    if (easyMode) {
      if (event.type === "session_start") return `新しい訪問者が来ました ${event.channelGroup ? `（${event.channelGroup}から）` : ""}`;
      if (event.type === "page_view") return `ページを見ています: ${event.path || "/"}`;
      if (event.type === "cta_click") return `ボタンが押されました`;
      if (event.type === "conversion") return `🎉 成果が発生！「${event.conversionName || ""}」`;
      if (event.type === "custom") return `カスタムイベント: ${event.eventName || ""}`;
      return event.type;
    } else {
      if (event.type === "session_start") return `New session ${event.channelGroup ? `via ${event.channelGroup}` : ""}`;
      if (event.type === "page_view") return `Page view: ${event.path || "/"}`;
      if (event.type === "cta_click") return `CTA click`;
      if (event.type === "conversion") return `Conversion: ${event.conversionName || ""}`;
      if (event.type === "custom") return `Event: ${event.eventName || ""}`;
      return event.type;
    }
  };

  const getEventBg = (type: string) => {
    if (type === "conversion") return "border-l-4 border-l-emerald-400 bg-emerald-50";
    if (type === "session_start") return "border-l-4 border-l-blue-400 bg-blue-50";
    if (type === "cta_click") return "border-l-4 border-l-indigo-400 bg-indigo-50";
    return "border-l-4 border-l-slate-200 bg-white";
  };

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio className="h-6 w-6 text-slate-700" />
            {connected && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {easyMode ? "今の動き" : "Live Events"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  connected ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connected ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
                {connected
                  ? easyMode ? "リアルタイム接続中" : "Connected"
                  : easyMode ? "接続中..." : "Connecting..."}
              </span>
            </div>
          </div>
        </div>

        {/* リアルタイム統計 */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: easyMode ? "今日の訪問数" : "Sessions (today)",
              value: stats.sessions,
              color: "text-blue-600",
              bg: "bg-blue-50 border-blue-200",
            },
            {
              label: easyMode ? "今日のページ閲覧" : "Page Views (today)",
              value: stats.pageviews,
              color: "text-slate-700",
              bg: "bg-slate-50 border-slate-200",
            },
            {
              label: easyMode ? "今日の成果" : "Conversions (today)",
              value: stats.conversions,
              color: "text-emerald-600",
              bg: "bg-emerald-50 border-emerald-200",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border p-5 ${stat.bg}`}
            >
              <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
              <p className={`text-3xl font-bold tabular-nums ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {easyMode ? "このセッション中" : "since page load"}
              </p>
            </div>
          ))}
        </div>

        {/* イベントストリーム */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-800">
              {easyMode ? "リアルタイムの動き" : "Event Stream"}
            </h2>
            {events.length > 0 && (
              <button
                onClick={() => setEvents([])}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                クリア
              </button>
            )}
          </div>

          <div
            ref={containerRef}
            className="space-y-2 max-h-[500px] overflow-y-auto"
          >
            {events.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Radio className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">
                  {easyMode
                    ? "サイトに誰かが来るのを待っています..."
                    : "Waiting for events..."}
                </p>
                <p className="text-sm mt-1">
                  {easyMode
                    ? "訪問者がいるとここにリアルタイムで表示されます"
                    : "Events will appear here in real-time"}
                </p>
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-start gap-3 rounded-lg p-3 ${getEventBg(event.type)}`}
                >
                  <div className="shrink-0 mt-0.5">
                    {EVENT_ICONS[event.type] || <Zap className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 font-medium">
                      {getEventLabel(event)}
                    </p>
                    {event.sessionId && (
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {event.sessionId.slice(0, 8)}...
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </>
  );
}
