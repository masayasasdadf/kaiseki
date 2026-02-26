"use client";

import { ChevronDown } from "lucide-react";
import { EasyModeToggle } from "@/components/easy-mode/easy-mode-toggle";
import { DATE_RANGES, type DateRange } from "@/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

interface HeaderProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function Header({ dateRange, onDateRangeChange }: HeaderProps) {
  const currentRange = DATE_RANGES.find((r) => r.value === dateRange);

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-white border-b border-slate-200 px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">期間:</span>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {currentRange?.label || "過去30日"}
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[10rem] rounded-xl bg-white shadow-lg border border-slate-200 p-1 mt-1"
              align="start"
              sideOffset={4}
            >
              {DATE_RANGES.map((range) => (
                <DropdownMenu.Item
                  key={range.value}
                  onSelect={() => onDateRangeChange(range.value)}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none",
                    range.value === dateRange
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {range.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <EasyModeToggle />
    </header>
  );
}
