"use client";

import * as Switch from "@radix-ui/react-switch";
import { useEasyMode } from "./easy-mode-context";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function EasyModeToggle({ className }: { className?: string }) {
  const { easyMode, toggle, isPending } = useEasyMode();

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors",
        easyMode
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-600",
        className
      )}
    >
      <Sparkles
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors",
          easyMode ? "text-amber-600" : "text-slate-400"
        )}
      />
      <span className="text-xs font-medium whitespace-nowrap">
        {easyMode ? "やさしいモード" : "通常モード"}
      </span>
      <Switch.Root
        checked={easyMode}
        onCheckedChange={toggle}
        disabled={isPending}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          easyMode ? "bg-amber-500" : "bg-slate-300",
          isPending && "opacity-50 cursor-not-allowed"
        )}
        aria-label="やさしいモード切替"
      >
        <Switch.Thumb
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            easyMode ? "translate-x-4" : "translate-x-0"
          )}
        />
      </Switch.Root>
    </div>
  );
}
