"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Term } from "@/components/easy-mode/term";
import { type TermKey } from "@/lib/terminology";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

interface KPICardProps {
  termKey: TermKey;
  value: number;
  format?: "number" | "percent" | "duration";
  change?: number; // 前期比 %
  className?: string;
  highlight?: boolean;
}

export function KPICard({
  termKey,
  value,
  format = "number",
  change,
  className,
  highlight = false,
}: KPICardProps) {
  const displayValue = (() => {
    if (format === "percent") return formatPercent(value);
    if (format === "duration") {
      if (value < 60) return `${Math.round(value)}秒`;
      return `${Math.floor(value / 60)}分${Math.round(value % 60) > 0 ? `${Math.round(value % 60)}秒` : ""}`;
    }
    return formatNumber(Math.round(value));
  })();

  const changeDirection =
    change === undefined ? null : change > 0 ? "up" : change < 0 ? "down" : "flat";

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-shadow hover:shadow-md",
        highlight
          ? "border-indigo-200 bg-indigo-50"
          : "border-slate-200 bg-white",
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <Term
          termKey={termKey}
          className={cn(
            "text-sm font-medium",
            highlight ? "text-indigo-700" : "text-slate-600"
          )}
        />
        {changeDirection && change !== undefined && (
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              changeDirection === "up"
                ? "bg-emerald-100 text-emerald-700"
                : changeDirection === "down"
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-600"
            )}
          >
            {changeDirection === "up" ? (
              <TrendingUp className="h-3 w-3" />
            ) : changeDirection === "down" ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <p
        className={cn(
          "text-3xl font-bold tracking-tight",
          highlight ? "text-indigo-900" : "text-slate-900"
        )}
      >
        {displayValue}
      </p>
    </div>
  );
}
