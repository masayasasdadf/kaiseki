"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { useEasyMode } from "./easy-mode-context";
import { getTerm, type TermKey } from "@/lib/terminology";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface TermProps {
  termKey: TermKey;
  className?: string;
  showTooltip?: boolean;
}

/**
 * 用語辞書を参照して表示するコンポーネント。
 * やさしいモードに応じてラベルと説明が切り替わる。
 */
export function Term({ termKey, className, showTooltip = true }: TermProps) {
  const { easyMode } = useEasyMode();
  const term = getTerm(termKey, easyMode);

  if (!showTooltip) {
    return <span className={className}>{term.label}</span>;
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 cursor-help border-b border-dashed border-slate-400",
              className
            )}
          >
            {term.label}
            <Info className="h-3 w-3 text-slate-400 shrink-0" />
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 max-w-xs rounded-lg bg-slate-900 px-3 py-2 text-sm text-white shadow-lg"
            sideOffset={5}
          >
            {term.description}
            <Tooltip.Arrow className="fill-slate-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

/**
 * ラベルのみを返す（テキストとして使いたい場合）
 */
export function useTerm(termKey: TermKey) {
  const { easyMode } = useEasyMode();
  return getTerm(termKey, easyMode);
}
