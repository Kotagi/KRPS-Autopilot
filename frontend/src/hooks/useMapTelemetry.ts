import { useEffect } from "react";
import { useViewStore } from "../orbital-map/store/viewStore";
import type { TelemetrySnapshot } from "../orbital-map/telemetry/schema-v6";
import { HIDDEN_POLL_MS, VISIBLE_POLL_MS } from "../orbital-map/telemetry/constants";

async function fetchMapTelemetry(): Promise<TelemetrySnapshot | null> {
  const response = await fetch("/api/map/telemetry");
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as TelemetrySnapshot;
}

export function useMapTelemetry(enabled: boolean) {
  const setTelemetry = useViewStore((s) => s.setTelemetry);

  useEffect(() => {
    if (!enabled) {
      setTelemetry(null);
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      const snapshot = await fetchMapTelemetry();
      if (!cancelled) {
        setTelemetry(snapshot);
      }
    };

    const schedule = () => {
      const delay = document.hidden ? HIDDEN_POLL_MS : VISIBLE_POLL_MS;
      timer = window.setTimeout(async () => {
        await poll();
        if (!cancelled) {
          schedule();
        }
      }, delay);
    };

    void poll();
    schedule();

    const onVisibilityChange = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      schedule();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      setTelemetry(null);
    };
  }, [enabled, setTelemetry]);
}
