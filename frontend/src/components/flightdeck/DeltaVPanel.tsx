import type { VesselDeltaV } from "../../api/types";

interface DeltaVPanelProps {
  deltaV: VesselDeltaV | null;
}

export function DeltaVPanel({ deltaV }: DeltaVPanelProps) {
  if (!deltaV) {
    return (
      <div className="delta-v-panel delta-v-panel--empty">
        <div className="telemetry-item">
          <span>Stage Δv</span>
          <strong>—</strong>
        </div>
        <div className="telemetry-item">
          <span>Total Δv</span>
          <strong>—</strong>
        </div>
        <div className="telemetry-item">
          <span>Surface TWR</span>
          <strong>—</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="delta-v-panel">
      <div className="telemetry-item">
        <span>Stage {deltaV.current_stage} Δv (vac)</span>
        <strong>{Math.round(deltaV.stage_vac_ms)} m/s</strong>
      </div>
      <div className="telemetry-item">
        <span>Total Δv (vac)</span>
        <strong>{Math.round(deltaV.total_vac_ms)} m/s</strong>
      </div>
      <div className="telemetry-item">
        <span>Surface TWR</span>
        <strong>{deltaV.surface_twr.toFixed(2)}</strong>
      </div>
    </div>
  );
}
