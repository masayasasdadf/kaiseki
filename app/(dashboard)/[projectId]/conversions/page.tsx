"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/dashboard/header";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { CV_TYPE_LABELS } from "@/lib/terminology";
import { type DateRange } from "@/lib/utils";
import { CHANNEL_COLORS, channelLabel } from "@/lib/attribution";
import { formatPercent } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Target,
  CheckCircle2,
  MousePointerClick,
  Send,
  Trash2,
  X,
  ChevronRight,
} from "lucide-react";

interface TrackingRule {
  id: string;
  name: string;
  type: string;
  config: Record<string, string>;
  active: boolean;
  createdAt: string;
}

interface MetricsData {
  conversionsByName: Array<{ name: string; count: number }>;
  channels: Array<{ name: string; sessions: number; conversions: number; cvr: number }>;
  channelConversions: Array<{
    channel: string;
    breakdown: Array<{ name: string; count: number }>;
  }>;
}

export default function ConversionsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { easyMode } = useEasyMode();

  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [rules, setRules] = useState<TrackingRule[]>([]);
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, metricsRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/conversions`),
        fetch(`/api/projects/${projectId}/metrics?range=${dateRange}`),
      ]);
      if (rulesRes.ok) {
        const { rules: r } = await rulesRes.json();
        setRules(r);
      }
      if (metricsRes.ok) setMetricsData(await metricsRes.json());
    } finally {
      setLoading(false);
    }
  }, [projectId, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const deleteRule = async (id: string) => {
    if (!confirm(easyMode ? "この成果設定を削除しますか？" : "Delete this conversion rule?")) return;
    await fetch(`/api/projects/${projectId}/conversions/${id}`, { method: "DELETE" });
    fetchData();
  };

  const typeIcon = (type: string) => {
    if (type === "url_match") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    if (type === "click") return <MousePointerClick className="h-4 w-4 text-indigo-500" />;
    return <Send className="h-4 w-4 text-amber-500" />;
  };

  const typeLabel = (type: string) => {
    const labels = easyMode ? CV_TYPE_LABELS.easy : CV_TYPE_LABELS.normal;
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <>
      <Header dateRange={dateRange} onDateRangeChange={setDateRange} />
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {easyMode ? "成果の設定" : "Conversions"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {easyMode
                ? "「お問い合わせ完了」「購入完了」などの成果を設定します"
                : "No-code conversion tracking setup"}
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {easyMode ? "成果を追加" : "Add Conversion"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {/* 成果サマリー */}
            {metricsData && metricsData.conversionsByName.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-800 mb-4">
                  {easyMode ? "成果の実績" : "Conversion Performance"}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {metricsData.conversionsByName.map((cv) => (
                    <div
                      key={cv.name}
                      className="rounded-xl border border-indigo-100 bg-indigo-50 p-4"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-indigo-500" />
                        <span className="text-xs text-indigo-700 font-medium truncate">
                          {cv.name}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-indigo-900">
                        {cv.count.toLocaleString()}
                      </p>
                      <p className="text-xs text-indigo-600">
                        {easyMode ? "件の成果" : "conversions"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* チャネル別CV */}
            {metricsData && metricsData.channels.some((ch) => ch.conversions > 0) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-800 mb-4">
                  {easyMode ? "どこから来た人が成果を出したか" : "Channel CV Breakdown"}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        {(easyMode
                          ? ["流入元", "訪問数", "成果数", "成果率", "成果の内訳"]
                          : ["Channel", "Sessions", "Conversions", "CVR", "Breakdown"]
                        ).map((h) => (
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
                      {metricsData.channels
                        .filter((ch) => ch.conversions > 0)
                        .map((ch) => {
                          const color =
                            CHANNEL_COLORS[ch.name as keyof typeof CHANNEL_COLORS] || "#94A3B8";
                          const crossTab = metricsData.channelConversions.find(
                            (x) => x.channel === ch.name
                          );
                          return (
                            <tr key={ch.name} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 pl-0 pr-3">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-3 w-3 rounded-full shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="font-medium text-slate-800">
                                    {channelLabel(ch.name, easyMode)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-3 tabular-nums text-slate-700">
                                {ch.sessions.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 tabular-nums font-semibold text-indigo-700">
                                {ch.conversions.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 tabular-nums">
                                <span
                                  className={
                                    ch.cvr >= 3
                                      ? "text-emerald-600 font-medium"
                                      : ch.cvr >= 1
                                      ? "text-amber-600"
                                      : "text-slate-500"
                                  }
                                >
                                  {formatPercent(ch.cvr)}
                                </span>
                              </td>
                              <td className="py-3 pl-3 pr-0">
                                {crossTab && crossTab.breakdown.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {crossTab.breakdown.map((b) => (
                                      <span
                                        key={b.name}
                                        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
                                      >
                                        <span className="truncate max-w-[120px]">{b.name}</span>
                                        <span className="font-semibold">{b.count}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CV設定一覧 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800 mb-4">
                {easyMode ? "設定済みの成果" : "Conversion Rules"}
              </h2>
              {rules.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">
                    {easyMode ? "まだ成果が設定されていません" : "No conversion rules yet"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {easyMode
                      ? "「成果を追加」から設定してください"
                      : "Click 'Add Conversion' to get started"}
                  </p>
                  <button
                    onClick={() => setShowWizard(true)}
                    className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 mx-auto"
                  >
                    <Plus className="h-4 w-4" />
                    {easyMode ? "成果を追加" : "Add Conversion"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-start justify-between rounded-xl border border-slate-200 p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        {typeIcon(rule.type)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">
                              {rule.name}
                            </span>
                            {rule.active && (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {easyMode ? "有効" : "Active"}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 mt-0.5">
                            {typeLabel(rule.type)}
                          </p>
                          {rule.config.pattern && (
                            <p className="text-xs font-mono text-slate-400 mt-1">
                              {rule.config.pattern}
                            </p>
                          )}
                          {rule.config.selector && (
                            <p className="text-xs font-mono text-slate-400 mt-1">
                              {rule.config.selector}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                        title={easyMode ? "削除" : "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* CV追加ウィザード */}
        {showWizard && (
          <ConversionWizard
            projectId={projectId}
            easyMode={easyMode}
            onClose={() => setShowWizard(false)}
            onCreated={() => {
              setShowWizard(false);
              fetchData();
            }}
          />
        )}
      </main>
    </>
  );
}

// =========================================================
// CV追加ウィザード
// =========================================================

type WizardStep = "type" | "config" | "name";
type ConversionType = "url_match" | "click" | "form_submit";

function ConversionWizard({
  projectId,
  easyMode,
  onClose,
  onCreated,
}: {
  projectId: string;
  easyMode: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<WizardStep>("type");
  const [type, setType] = useState<ConversionType>("url_match");
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState("contains");
  const [selector, setSelector] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const labels = easyMode ? CV_TYPE_LABELS.easy : CV_TYPE_LABELS.normal;

  const typeOptions = [
    {
      value: "url_match" as ConversionType,
      label: labels.url_match,
      desc: labels.url_match_desc,
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
    },
    {
      value: "click" as ConversionType,
      label: labels.click,
      desc: labels.click_desc,
      icon: <MousePointerClick className="h-6 w-6 text-indigo-500" />,
    },
    {
      value: "form_submit" as ConversionType,
      label: labels.form_submit,
      desc: labels.form_submit_desc,
      icon: <Send className="h-6 w-6 text-amber-500" />,
    },
  ];

  const buildConfig = () => {
    if (type === "url_match") return { matchType, pattern };
    if (type === "click") return { selector };
    return { selector };
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError(easyMode ? "名前を入力してください" : "Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/conversions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name.trim(),
          config: buildConfig(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "保存に失敗しました");
        return;
      }
      onCreated();
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {easyMode ? "成果を追加する" : "Add Conversion Rule"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ステップ */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-6">
            {(["type", "config", "name"] as WizardStep[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    step === s
                      ? "bg-indigo-600 text-white"
                      : i < ["type", "config", "name"].indexOf(step)
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && <ChevronRight className="h-4 w-4 text-slate-300" />}
              </div>
            ))}
          </div>

          {/* Step 1: タイプ選択 */}
          {step === "type" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700 mb-3">
                {easyMode ? "どんな成果を計測しますか？" : "What triggers a conversion?"}
              </p>
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    type === opt.value
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {opt.icon}
                  <div>
                    <p className="font-medium text-slate-800">{opt.label}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: 設定 */}
          {step === "config" && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700">
                {easyMode ? "詳細を設定してください" : "Configure the rule"}
              </p>

              {type === "url_match" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {easyMode ? "一致の種類" : "Match Type"}
                    </label>
                    <select
                      value={matchType}
                      onChange={(e) => setMatchType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="contains">{easyMode ? "URLに含む" : "Contains"}</option>
                      <option value="equals">{easyMode ? "完全一致" : "Equals"}</option>
                      <option value="starts_with">{easyMode ? "前方一致" : "Starts with"}</option>
                      <option value="regex">{easyMode ? "正規表現" : "Regex"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {easyMode ? "ページのURL（パス）" : "URL Pattern"}
                    </label>
                    <input
                      type="text"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder={easyMode ? "例: /thanks" : "e.g. /thank-you"}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      {easyMode
                        ? "「/thanks」と入力すると、/thanksページが表示されたら成果として記録されます"
                        : "Path pattern to match against the URL"}
                    </p>
                  </div>
                </>
              )}

              {(type === "click" || type === "form_submit") && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {easyMode ? "ボタン・フォームのCSS指定" : "CSS Selector"}
                  </label>
                  <input
                    type="text"
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    placeholder={easyMode ? "例: #contact-form, .cta-button" : "e.g. #submit-btn, .cta"}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {easyMode
                      ? "クリックを計測したいボタンのID（#送信ボタン）やクラス名（.btn-primary）を入力"
                      : "CSS selector for the element to track"}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: 名前 */}
          {step === "name" && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700">
                {easyMode ? "この成果に名前をつけてください" : "Name this conversion"}
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {easyMode ? "成果の名前" : "Conversion Name"}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={easyMode ? "例: お問い合わせ完了" : "e.g. Contact Form Submit"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            onClick={() => {
              if (step === "type") onClose();
              if (step === "config") setStep("type");
              if (step === "name") setStep("config");
            }}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            {step === "type" ? (easyMode ? "キャンセル" : "Cancel") : (easyMode ? "戻る" : "Back")}
          </button>
          <button
            onClick={() => {
              if (step === "type") setStep("config");
              else if (step === "config") setStep("name");
              else handleSave();
            }}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {step === "name"
              ? easyMode ? "保存する" : "Save"
              : easyMode ? "次へ" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
