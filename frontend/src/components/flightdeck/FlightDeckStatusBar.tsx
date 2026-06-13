import type { ConnectionStatus, VesselDeltaV, VesselTelemetry } from "../../api/types";

interface FlightDeckStatusBarProps {
  connection: ConnectionStatus;
  telemetry: VesselTelemetry | null;
  deltaV: VesselDeltaV | null;
}

export function FlightDeckStatusBar({
  connection,
  telemetry,
  deltaV,
}: FlightDeckStatusBarProps) {
  const vesselName =
    connection.vessel_name ?? telemetry?.vessel_name ?? "NO VESSEL";
  const situation = telemetry?.situation ?? connection.situation ?? "—";
  const connected = connection.connected;

  return (
    <header className="cockpit-status-bar panel">
      <div className="cockpit-status-primary">
        <span className="cockpit-status-callsign">{vesselName}</span>
        <span className="cockpit-status-divider" aria-hidden>
          ·
        </span>
        <span className="cockpit-status-situation">{situation}</span>
      </div>

      <div className="cockpit-status-instruments">
        <span>
          HDG <strong>{(telemetry?.heading_deg ?? 0).toFixed(0)}°</strong>
        </span>
        <span>
          PCH <strong>{(telemetry?.pitch_deg ?? 0).toFixed(1)}°</strong>
        </span>
        <span>
          ROL <strong>{(telemetry?.roll_deg ?? 0).toFixed(1)}°</strong>
        </span>
        <span>
          AoA <strong>{(telemetry?.angle_of_attack_deg ?? 0).toFixed(1)}°</strong>
        </span>
        <span>
          Δv <strong>{Math.round(deltaV?.total_vac_ms ?? 0)}</strong>
        </span>
      </div>

      <div className="cockpit-status-link">
        <span
          className={`cockpit-link-indicator${connected ? " cockpit-link-indicator--on" : ""}`}
          aria-label={connected ? "kRPC linked" : "kRPC offline"}
        />
        <span>{connected ? "LINKED" : "OFFLINE"}</span>
      </div>
    </header>
  );
}
