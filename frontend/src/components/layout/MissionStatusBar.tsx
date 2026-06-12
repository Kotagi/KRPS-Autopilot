import { useState } from "react";

import { api } from "../../api/client";
import { useAppStore } from "../../store/appStore";

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function phaseLabel(
  ascentState: string | undefined,
  maneuverState: string | undefined
): string {
  if (ascentState === "running") return "ASCENT";
  if (maneuverState === "running") return "MNV EXEC";
  if (ascentState === "completed") return "ASCENT DONE";
  if (maneuverState === "completed") return "MNV DONE";
  if (ascentState === "error" || maneuverState === "error") return "FAULT";
  return "STANDBY";
}

export function MissionStatusBar() {
  const connection = useAppStore((s) => s.connection);
  const wsConnected = useAppStore((s) => s.wsConnected);
  const telemetry = useAppStore((s) => s.telemetry);
  const maneuver = useAppStore((s) => s.maneuver);
  const ascent = useAppStore((s) => s.ascent);
  const target = useAppStore((s) => s.target);
  const setConnection = useAppStore((s) => s.setConnection);
  const setLastError = useAppStore((s) => s.setLastError);
  const [busy, setBusy] = useState(false);

  const onPad =
    connection.situation === "pre_launch" ||
    connection.situation === "VesselSituation.pre_launch";
  const linkClass = connection.connected ? (onPad ? "warn" : "ok") : "off";

  const handleConnect = async () => {
    setBusy(true);
    setLastError(null);
    try {
      setConnection(await api.connect());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      setConnection(await api.disconnect());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="mission-status-bar">
      <div className="mission-status-brand">
        <span className="mission-status-overline">KPRS Flight Software</span>
        <strong className="mission-status-title">Mission Control</strong>
      </div>

      <div className="mission-status-metrics">
        <div className="mission-status-metric">
          <span>Vessel</span>
          <strong>{connection.vessel_name ?? telemetry?.vessel_name ?? "—"}</strong>
        </div>
        <div className="mission-status-metric">
          <span>Situation</span>
          <strong>{connection.situation ?? telemetry?.situation ?? "—"}</strong>
        </div>
        <div className="mission-status-metric">
          <span>Target</span>
          <strong>
            {target?.name && target.target_type !== "none" ? target.name : "—"}
          </strong>
        </div>
        <div className="mission-status-metric">
          <span>Phase</span>
          <strong>{phaseLabel(ascent?.state, maneuver?.state)}</strong>
        </div>
        <div className="mission-status-metric">
          <span>Next node</span>
          <strong>T− {formatDuration(maneuver?.next_node_time_to_s)}</strong>
        </div>
        {telemetry && (
          <div className="mission-status-metric">
            <span>Altitude</span>
            <strong>{Math.round(telemetry.altitude_m).toLocaleString()} m</strong>
          </div>
        )}
      </div>

      <div className="mission-status-comms">
        <span className={`status-dot ${linkClass}`} title="kRPC" />
        <span className="mission-status-comms-label">
          kRPC {connection.connected ? "LINK" : "OFF"}
        </span>
        <span className={`status-dot ${wsConnected ? "ok" : "warn"}`} title="WebSocket" />
        <span className="mission-status-comms-label">
          WS {wsConnected ? "LIVE" : "—"}
        </span>
        <button onClick={handleConnect} disabled={busy || connection.connected}>
          Connect
        </button>
        <button
          className="secondary"
          onClick={handleDisconnect}
          disabled={busy || !connection.connected}
        >
          Disconnect
        </button>
      </div>
    </header>
  );
}
