"use client";

import React, {
  createContext,
  useContext,
  useState,
  useTransition,
  useCallback,
} from "react";

interface EasyModeContextValue {
  easyMode: boolean;
  toggle: () => void;
  isPending: boolean;
}

const EasyModeContext = createContext<EasyModeContextValue>({
  easyMode: false,
  toggle: () => {},
  isPending: false,
});

export function EasyModeProvider({
  children,
  initialValue = false,
}: {
  children: React.ReactNode;
  initialValue?: boolean;
}) {
  const [easyMode, setEasyMode] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const toggle = useCallback(() => {
    const next = !easyMode;
    setEasyMode(next);

    // サーバーに保存（非同期、失敗しても UIは即時反映）
    startTransition(async () => {
      try {
        await fetch("/api/user/easy-mode", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ easyMode: next }),
        });
      } catch {
        // エラーは無視（ローカル状態を優先）
      }
    });
  }, [easyMode]);

  return (
    <EasyModeContext.Provider value={{ easyMode, toggle, isPending }}>
      {children}
    </EasyModeContext.Provider>
  );
}

export function useEasyMode() {
  return useContext(EasyModeContext);
}
