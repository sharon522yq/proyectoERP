import React, { createContext, useContext, useEffect, useRef } from "react";
export const BackActionContext = createContext(null);
// Register the deepest open screen before the shell falls back to the dashboard.
export function useBackAction(action) {
  const registry = useContext(BackActionContext),
    latest = useRef(action);
  latest.current = action;
  useEffect(() => {
    if (!registry) return;
    const handler = () => latest.current?.() || false;
    registry.current = handler;
    return () => {
      if (registry.current === handler) registry.current = null;
    };
  }, [registry]);
}
