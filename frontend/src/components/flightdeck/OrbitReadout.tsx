import type { VesselTelemetry } from "../../api/types";

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDistance(meters: number): string {
  const abs = Math.abs(meters);
  if (abs >= 1_000_000) return `${(meters / 1_000_000).toFixed(2)} Mm`;
  if (abs >= 1_000) return `${(meters / 1_000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatSpeed(ms: number): string {
  if (Math.abs(ms) >= 1000) return `${(ms / 1000).toFixed(2)} km/s`;
  return `${Math.round(ms)} m/s`;
}

interface OrbitReadoutProps {
  telemetry: VesselTelemetry | null;
  connected: boolean;
}

export function OrbitReadout({ telemetry, connected }: OrbitReadoutProps) {
  if (!telemetry) {
    return (
      <div className="flight-deck-placeholder">
        Orbit readout
        <span className="meta">
          {!connected
            ? "Click Connect in the status bar to link kRPC"
            : "Waiting for telemetry…"}
        </span>
      </div>
    );
  }

  return (
    <div className="flight-deck-orbit-readout">
      <div className="telemetry-grid">
        <div className="telemetry-item">
          <span>Body</span>
          <strong>{telemetry.orbit_body ?? "—"}</strong>
        </div>
        <div className="telemetry-item">
          <span>Situation</span>
          <strong>{telemetry.situation}</strong>
        </div>
        <div className="telemetry-item">
          <span>Altitude (MSL)</span>
          <strong>{formatDistance(telemetry.altitude_m)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Surface alt</span>
          <strong>{formatDistance(telemetry.surface_altitude_m ?? 0)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Apoapsis</span>
          <strong>{formatDistance(telemetry.apoapsis_m)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Periapsis</span>
          <strong>{formatDistance(telemetry.periapsis_m)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Inclination</span>
          <strong>{(telemetry.inclination_deg ?? 0).toFixed(2)}°</strong>
        </div>
        <div className="telemetry-item">
          <span>Eccentricity</span>
          <strong>{(telemetry.eccentricity ?? 0).toFixed(4)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Orbital speed</span>
          <strong>{formatSpeed(telemetry.orbital_speed_ms ?? 0)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Surface speed</span>
          <strong>{formatSpeed(telemetry.surface_speed_ms ?? 0)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Vertical speed</span>
          <strong>{formatSpeed(telemetry.vertical_speed_ms ?? 0)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Dynamic pressure</span>
          <strong>{Math.round(telemetry.dynamic_pressure_pa ?? 0)} Pa</strong>
        </div>
        <div className="telemetry-item">
          <span>Mach</span>
          <strong>{(telemetry.mach ?? 0).toFixed(2)}</strong>
        </div>
        <div className="telemetry-item">
          <span>G force</span>
          <strong>{(telemetry.g_force ?? 0).toFixed(2)} g</strong>
        </div>
        <div className="telemetry-item">
          <span>T to Ap</span>
          <strong>{formatDuration(telemetry.time_to_apoapsis_s)}</strong>
        </div>
        <div className="telemetry-item">
          <span>T to Pe</span>
          <strong>{formatDuration(telemetry.time_to_periapsis_s)}</strong>
        </div>
        <div className="telemetry-item">
          <span>T to SOI</span>
          <strong>{formatDuration(telemetry.time_to_soi_s)}</strong>
        </div>
        <div className="telemetry-item">
          <span>Next node</span>
          <strong>T− {formatDuration(telemetry.next_node_time_to_s)}</strong>
        </div>
      </div>
    </div>
  );
}
