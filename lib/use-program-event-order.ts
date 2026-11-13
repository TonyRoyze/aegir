"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  normalizeProgramEventOrder,
  PROGRAM_ORDER_CHANGED,
  readProgramEventOrderSnapshot,
} from "./program-event-order";
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(PROGRAM_ORDER_CHANGED, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(PROGRAM_ORDER_CHANGED, listener);
  };
}
const serverSnapshot = () => null;
export function useProgramEventOrder(meetId: string | null, events: string[]) {
  const read = useCallback(
    () => readProgramEventOrderSnapshot(meetId),
    [meetId],
  );
  const snapshot = useSyncExternalStore(subscribe, read, serverSnapshot);
  return useMemo(() => {
    try {
      const parsed: unknown = snapshot ? JSON.parse(snapshot) : null;
      return normalizeProgramEventOrder(
        events,
        Array.isArray(parsed)
          ? parsed.filter((event): event is string => typeof event === "string")
          : null,
      );
    } catch {
      return [...events];
    }
  }, [events, snapshot]);
}
