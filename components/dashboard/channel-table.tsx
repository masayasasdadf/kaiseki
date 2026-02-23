"use client";

import { useEasyMode } from "@/components/easy-mode/easy-mode-context";
import { CHANNEL_COLORS } from "@/lib/attribution";
import { formatNumber, formatPercent } from "@/lib/utils";
import { getEmptyState } from "@/lib/terminology";

interface ChannelRow {
  name: string;
  sessions: number;
  visitors: number;
  conversions: number;
}

interface ChannelTableProps {
  data: ChannelRow[];
  totalSessions: number;
}

export function ChannelTable({ data, totalSessions }: ChannelTableProps) {
  const { easyMode } = useEasyMode();

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <p className="font-medium">{getEmptyState("noData", easyMode)}</p>
        <p className="text-sm mt-1">{getEmptyState("noDataDescription", easyMode)}</p>
      </div>
    );
  }

  const headers = easyMode
    ? ["流入元", "訪問数", "訪問した人", "成果数", "割合"]
    : ["Channel", "Sessions", "Users", "Conversions", "Share"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {headers.map((h) => (
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
          {data.map((row) => {
            const share =
              totalSessions > 0 ? (row.sessions / totalSessions) * 100 : 0;
            const color =
              CHANNEL_COLORS[row.name as keyof typeof CHANNEL_COLORS] ||
              "#94A3B8";

            return (
              <tr key={row.name} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 pl-0 pr-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-slate-800">
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 tabular-nums text-slate-700">
                  {formatNumber(row.sessions)}
                </td>
                <td className="py-3 px-3 tabular-nums text-slate-700">
                  {formatNumber(row.visitors)}
                </td>
                <td className="py-3 px-3 tabular-nums text-slate-700">
                  {formatNumber(row.conversions)}
                </td>
                <td className="py-3 pl-3 pr-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 max-w-[80px]">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, share)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="text-slate-500 text-xs w-10 text-right">
                      {formatPercent(share, 0)}
                    </span>
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
