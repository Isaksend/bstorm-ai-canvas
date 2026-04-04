"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Api = {
  registerExport: (fn: (() => Promise<void>) | null) => void;
  exportSummary: () => Promise<void>;
  exportReady: boolean;
};

const BrainstormActionsContext = createContext<Api | null>(null);

export function BrainstormActionsProvider({ children }: { children: ReactNode }) {
  const ref = useRef<(() => Promise<void>) | null>(null);
  const [exportReady, setExportReady] = useState(false);

  const registerExport = useCallback((fn: (() => Promise<void>) | null) => {
    ref.current = fn;
    setExportReady(fn != null);
  }, []);

  const exportSummary = useCallback(async () => {
    await ref.current?.();
  }, []);

  const value = useMemo(
    () => ({ registerExport, exportSummary, exportReady }),
    [registerExport, exportSummary, exportReady]
  );

  return (
    <BrainstormActionsContext.Provider value={value}>{children}</BrainstormActionsContext.Provider>
  );
}

export function useBrainstormActionsOptional() {
  return useContext(BrainstormActionsContext);
}
