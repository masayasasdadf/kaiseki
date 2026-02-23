"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useEasyMode } from "@/components/easy-mode/easy-mode-context";

interface TrendPoint {
  date: string;
  sessions: number;
  conversions: number;
}

interface TrendChartProps {
  data: TrendPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
  const { easyMode } = useEasyMode();

  const labels = easyMode
    ? { sessions: "訪問数", conversions: "成果数" }
    : { sessions: "Sessions", conversions: "Conversions" };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
        データがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            fontSize: "12px",
          }}
          labelFormatter={(label: unknown) => formatDate(String(label))}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
        />
        <Line
          type="monotone"
          dataKey="sessions"
          name={labels.sessions}
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="conversions"
          name={labels.conversions}
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
