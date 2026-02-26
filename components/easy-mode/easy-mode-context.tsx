"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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
}: {
  children: React.ReactNode;
}) {
  const [easyMode, setEasyMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("easyMode");
    if (stored === "true") setEasyMode(true);
  }, []);

  const toggle = useCallback(() => {
    setEasyMode((prev) => {
      const next = !prev;
      localStorage.setItem("easyMode", String(next));
      return next;
    });
  }, []);

  return (
    <EasyModeContext.Provider value={{ easyMode, toggle, isPending: false }}>
      {children}
    </EasyModeContext.Provider>
  );
}

export function useEasyMode() {
  return useContext(EasyModeContext);
}
