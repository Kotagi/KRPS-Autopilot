import { useEffect, useState } from "react";

import {
  telemetryClientDebug,
  type TelemetryClientStats,
} from "../../debug/telemetryClientDebug";

function formatMs(value: number | null): string {
  if (value === null) return "n/a";
  return `${value.toFixed(1)} ms`;
}

export function TelemetryDebugPanel() {
  const [stats, setStats] = useState<TelemetryClientStats>(() =>
    telemetryClientDebug.getStats()
  );

  useEffect(() => {
    return telemetryClientDebug.subscribe(() => {
      setStats(telemetryClientDebug.getStats());
    });
  }, []);

  return (
    <div className="telemetry-debug-panel" aria-live="polite">
      <div className="telemetry-debug-header">
        <div className="telemetry-debug-title">Client telemetry debug</div>
      </div>
      <div className="telemetry-debug-grid">
        <span>WS rate</span>
        <strong>
          {stats.wsTelemetryHz.toFixed(1)} Hz ({stats.wsTelemetryCount})
        </strong>
        <span>WS gap</span>
        <strong>
          avg {stats.wsGapAvgMs.toFixed(1)} ms · max {stats.wsGapMaxMs.toFixed(1)} ms
        </strong>
        <span>Server latency</span>
        <strong>
          avg {formatMs(stats.serverLatencyAvgMs)} · max {formatMs(stats.serverLatencyMaxMs)}
        </strong>
        <span>Unchanged attitude</span>
        <strong>
          {stats.unchangedAttitude} ({stats.duplicatePct.toFixed(0)}%)
        </strong>
        <span>Store skipped</span>
        <strong>{stats.skippedStoreUpdates}</strong>
        <span>Seq gaps</span>
        <strong>{stats.serverSeqGaps}</strong>
        <span>Navball render</span>
        <strong>
          avg {stats.navballRenderAvgMs.toFixed(1)} ms · max {stats.navballRenderMaxMs.toFixed(1)} ms
        </strong>
        <span>Canvas paint</span>
        <strong>
          avg {stats.canvasPaintAvgMs.toFixed(1)} ms · max {stats.canvasPaintMaxMs.toFixed(1)} ms
        </strong>
        <span>SVG build</span>
        <strong>
          avg {stats.svgBuildAvgMs.toFixed(1)} ms · max {stats.svgBuildMaxMs.toFixed(1)} ms
        </strong>
        <span>Slow phases</span>
        <strong>{stats.slowPhases}</strong>
        <span>Attitude</span>
        <strong>
          P {stats.lastPitch?.toFixed(1) ?? "—"} · H {stats.lastHeading?.toFixed(0) ?? "—"} · R{" "}
          {stats.lastRoll?.toFixed(1) ?? "—"}
        </strong>
      </div>
      <div className="telemetry-debug-hint">
        Console logs every 5s. Turn off debug mode in Settings.
      </div>
    </div>
  );
}
