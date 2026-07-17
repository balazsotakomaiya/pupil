import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getTodayDayKey } from "../lib/daily-checkin";
import { invalidateDateSensitiveAppData } from "../lib/query";

export function useDateSensitiveQuerySync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timeoutId = 0;
    let currentDayKey = getTodayDayKey();

    function syncDaySensitiveQueries() {
      const nextDayKey = getTodayDayKey();

      if (nextDayKey === currentDayKey) {
        return;
      }

      currentDayKey = nextDayKey;
      void invalidateDateSensitiveAppData(queryClient);
    }

    function scheduleNextDayRefresh() {
      const nextMidnight = new Date();
      nextMidnight.setHours(24, 0, 1, 0);

      timeoutId = window.setTimeout(
        () => {
          syncDaySensitiveQueries();
          scheduleNextDayRefresh();
        },
        Math.max(1_000, nextMidnight.getTime() - Date.now()),
      );
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncDaySensitiveQueries();
      }
    }

    window.addEventListener("focus", syncDaySensitiveQueries);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleNextDayRefresh();

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", syncDaySensitiveQueries);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient]);
}
