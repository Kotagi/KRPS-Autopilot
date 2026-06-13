import { useEffect, useState } from "react";

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

export function FlightDeckAutopilotModule() {
  const connection = useAppStore((s) => s.connection);
  const maneuver = useAppStore((s) => s.maneuver);
  const telemetry = useAppStore((s) => s.telemetry);
  const setManeuver = useAppStore((s) => s.setManeuver);
  const setLastError = useAppStore((s) => s.setLastError);

  const [busy, setBusy] = useState(false);
  const [warping, setWarping] = useState(false);

  const ready = connection.connected;
  const running = maneuver?.state === "running" || !!maneuver?.executor_enabled;
  const nodeCount = maneuver?.node_count ?? telemetry?.maneuver_node_count ?? 0;
  const timeToNode =
    maneuver?.next_node_time_to_s ?? telemetry?.next_node_time_to_s ?? null;
  const hasNodes = nodeCount > 0;
  const disabled = !ready || busy || running || !hasNodes;

  useEffect(() => {
    if (!ready) return;
    if (maneuver != null) return;
    api.maneuverStatus().then(setManeuver).catch(() => {});
  }, [ready, maneuver, setManeuver]);

  const handleWarp = async () => {
    setBusy(true);
    setWarping(true);
    setLastError(null);
    try {
      await api.warpToManeuverNode({ lead_time_s: 3 });
      setManeuver(await api.maneuverStatus());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Warp failed");
    } finally {
      setWarping(false);
      setBusy(false);
    }
  };

  const handleExecuteNext = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const status = await api.executeManeuver({
        mode: "one",
        autowarp: true,
        lead_time_s: 3,
      });
      setManeuver(status);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Execute failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cockpit-autopilot">
      <div className="cockpit-autopilot-meta">
        <span>
          NODES <strong>{hasNodes ? nodeCount : "—"}</strong>
        </span>
        <span>
          T− <strong>{formatDuration(timeToNode)}</strong>
        </span>
      </div>

      <div className="cockpit-autopilot-actions">
        <button
          type="button"
          className="cockpit-control-btn cockpit-control-btn--autopilot"
          onClick={handleWarp}
          disabled={disabled || warping}
          aria-label="Warp to next maneuver node"
        >
          <span className="cockpit-control-btn-label">Warp to node</span>
          <span className="cockpit-control-btn-state">
            {warping ? "WARPING" : "ARM"}
          </span>
        </button>
        <button
          type="button"
          className="cockpit-control-btn cockpit-control-btn--execute"
          onClick={handleExecuteNext}
          disabled={disabled}
          aria-label="Execute next maneuver node"
        >
          <span className="cockpit-control-btn-label">Execute next</span>
          <span className="cockpit-control-btn-state">
            {running ? "BURN" : "MEJ"}
          </span>
        </button>
      </div>

      {!ready ? (
        <p className="meta cockpit-autopilot-hint">Connect kRPC to use node autopilot.</p>
      ) : !hasNodes ? (
        <p className="meta cockpit-autopilot-hint">No maneuver nodes planned.</p>
      ) : running ? (
        <p className="meta cockpit-autopilot-hint">Maneuver burn in progress.</p>
      ) : null}
    </div>
  );
}
