"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Globe,
  TrendingUp,
  Target,
  Radio,
  Settings,
  ChevronDown,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";

interface Project {
  id: string;
  name: string;
}

interface SidebarProps {
  projects: Project[];
  currentProjectId: string;
}

const NAV_ITEMS = [
  {
    label: "概要",
    labelEasy: "ダッシュボード",
    href: "overview",
    icon: BarChart3,
  },
  {
    label: "流入分析",
    labelEasy: "どこから来たか",
    href: "acquisition",
    icon: Globe,
  },
  {
    label: "コンテンツ分析",
    labelEasy: "どのページが読まれたか",
    href: "behavior",
    icon: TrendingUp,
  },
  {
    label: "コンバージョン",
    labelEasy: "成果",
    href: "conversions",
    icon: Target,
  },
  {
    label: "ライブイベント",
    labelEasy: "今の動き",
    href: "live",
    icon: Radio,
  },
  {
    label: "設定",
    labelEasy: "設定",
    href: "settings",
    icon: Settings,
  },
];

export function Sidebar({ projects, currentProjectId }: SidebarProps) {
  const pathname = usePathname();
  const { easyMode } = useEasyMode();

  const currentProject = projects.find((p) => p.id === currentProjectId);

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-slate-900 min-h-screen">
      {/* ロゴ */}
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-500 rounded-lg p-1.5">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Kaiseki</span>
        </div>
      </div>

      {/* プロジェクト選択 */}
      <div className="px-3 py-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            プロジェクト
          </span>
          <Link
            href="/projects/new"
            className="text-slate-400 hover:text-white transition-colors"
            title="新しいプロジェクト"
          >
            <Plus className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 cursor-pointer hover:bg-slate-700 transition-colors">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-sm text-white truncate flex-1">
            {currentProject?.name || "プロジェクトなし"}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
        </div>

        {/* プロジェクトリスト（簡易版） */}
        {projects.length > 1 && (
          <div className="mt-1 space-y-0.5">
            {projects
              .filter((p) => p.id !== currentProjectId)
              .map((p) => (
                <Link
                  key={p.id}
                  href={`/${p.id}/overview`}
                  className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <div className="h-2 w-2 rounded-full bg-slate-600 shrink-0" />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const href = `/${currentProjectId}/${item.href}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;
          const label = easyMode ? item.labelEasy : item.label;

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
              {item.href === "live" && (
                <span className="ml-auto flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* フッター */}
      <div className="px-3 py-4 border-t border-slate-800">
        <p className="text-xs text-slate-600 text-center">
          Kaiseki Analytics v1.0
        </p>
      </div>
    </aside>
  );
}
