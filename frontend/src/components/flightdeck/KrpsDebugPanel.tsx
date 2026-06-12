import { useEffect, useState } from "react";

import { api } from "../../api/client";
import type { NavballSource } from "../../api/types";
import { useAppStore } from "../../store/appStore";

interface KrpsDebugReport {
  timestamp_ms: number;
  krps_connected: boolean;
  krpc_connected: boolean;
  active_source: NavballSource;
  krps?: {
    seq?: number | null;
    raw_heading_deg?: number | null;
    heading_from_quat_deg?: number | null;
    debug_heading_nose_deg?: number | null;
    debug_heading_bottom_deg?: number | null;
    debug_ksp_heading_deg?: number | null;
    parse_ok?: boolean;
  };
  krpc?: {
    heading_deg?: number;
    heading_from_quat_deg?: number;
    pitch_deg?: number;
    roll_deg?: number;
  };
  deltas?: Record<string, number | null>;
  warnings?: string[];
}

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  return value.toFixed(1);
}

export function KrpsDebugPanel() {
  const navballSource = useAppStore((s) => s.navballSource);
  const [report, setReport] = useState<KrpsDebugReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await api.krpsDebug();
        if (!cancelled) setReport(next as unknown as KrpsDebugReport);
      } catch {
        if (!cancelled) setReport(null);
      }
    };

    poll();
    const timer = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [navballSource.source]);

  if (navballSource.source !== "krps") return null;

  return (
    <div className="krps-debug-panel" aria-live="polite">
      <div className="krps-debug-title">KRPS debug (compare vs kRPC)</div>
      {!report ? (
        <div className="krps-debug-hint">Waiting for debug report…</div>
      ) : (
        <div className="krps-debug-grid">
          <span>KRPS connected</span>
          <strong>{report.krps_connected ? "yes" : "no"}</strong>
          <span>kRPC connected</span>
          <strong>{report.krpc_connected ? "yes" : "no"}</strong>
          <span>KRPS raw HDG</span>
          <strong>{fmt(report.krps?.raw_heading_deg)}°</strong>
          <span>KRPS quat HDG</span>
          <strong>{fmt(report.krps?.heading_from_quat_deg)}°</strong>
          <span>KRPS bottom HDG</span>
          <strong>{fmt(report.krps?.debug_heading_bottom_deg)}°</strong>
          <span>KRPS nose HDG</span>
          <strong>{fmt(report.krps?.debug_heading_nose_deg)}°</strong>
          <span>KSP vessel HDG</span>
          <strong>{fmt(report.krps?.debug_ksp_heading_deg)}°</strong>
          <span>kRPC HDG</span>
          <strong>{fmt(report.krpc?.heading_deg)}°</strong>
          <span>kRPC quat HDG</span>
          <strong>{fmt(report.krpc?.heading_from_quat_deg)}°</strong>
          <span>Δ heading</span>
          <strong>{fmt(report.deltas?.heading_deg)}°</strong>
          <span>Δ quat HDG</span>
          <strong>{fmt(report.deltas?.heading_from_quat_deg)}°</strong>
          <span>Warnings</span>
          <strong>{report.warnings?.length ? report.warnings.join(", ") : "none"}</strong>
        </div>
      )}
      <div className="krps-debug-hint">
        Server log: <code>autopilot-server.log</code> lines tagged <code>[krps-debug]</code>.
        KSP log: <code>Player.log</code> lines tagged <code>[KRPS]</code>.
      </div>
    </div>
  );
}
