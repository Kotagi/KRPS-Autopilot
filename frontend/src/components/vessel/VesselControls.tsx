import { useState } from "react";

import { api } from "../../api/client";
import type { VesselControlsState, VesselPointMode } from "../../api/types";
import { useAppStore } from "../../store/appStore";

type VesselControlsVariant = "default" | "compact" | "cockpit";

type PointSpec = {
  mode: VesselPointMode;
  label: string;
  short: string;
};

const ORBIT_POINT_MODES: PointSpec[] = [
  { mode: "prograde", label: "Prograde", short: "PRO" },
  { mode: "retrograde", label: "Retrograde", short: "RET" },
  { mode: "normal", label: "Normal", short: "N+" },
  { mode: "anti_normal", label: "Anti-normal", short: "N-" },
  { mode: "radial", label: "Radial", short: "R+" },
  { mode: "anti_radial", label: "Anti-radial", short: "R-" },
];

const NAV_POINT_MODES: PointSpec[] = [
  { mode: "maneuver", label: "Maneuver", short: "MNV" },
  { mode: "target", label: "Target", short: "TGT" },
  { mode: "anti_target", label: "Anti-target", short: "A-T" },
  { mode: "stability_assist", label: "Stabilize", short: "STB" },
];

function cockpitBtnClass(active: boolean, extra = ""): string {
  return `cockpit-control-btn${active ? " cockpit-control-btn--on" : ""}${extra ? ` ${extra}` : ""}`;
}

function PointToControls({
  variant,
  ready,
  busy,
  controls,
  onPoint,
}: {
  variant: VesselControlsVariant;
  ready: boolean;
  busy: boolean;
  controls: VesselControlsState | null;
  onPoint: (mode: VesselPointMode) => void;
}) {
  const activeMode = controls?.sas ? controls.sas_mode : null;
  const disabled = !ready || busy;

  const renderButton = (spec: PointSpec) => {
    const active = activeMode === spec.mode;
    if (variant === "cockpit") {
      return (
        <button
          key={spec.mode}
          type="button"
          className={cockpitBtnClass(active, "cockpit-control-btn--point")}
          onClick={() => onPoint(spec.mode)}
          disabled={disabled}
          aria-pressed={active}
          aria-label={`Point ${spec.label}`}
          title={spec.label}
        >
          <span className="cockpit-control-btn-label">{spec.short}</span>
          <span className="cockpit-control-btn-state">
            {active ? "HOLD" : "SET"}
          </span>
        </button>
      );
    }

    return (
      <button
        key={spec.mode}
        type="button"
        className={active ? "secondary point-btn point-btn--active" : "secondary point-btn"}
        onClick={() => onPoint(spec.mode)}
        disabled={disabled}
        aria-pressed={active}
      >
        {spec.label}
      </button>
    );
  };

  if (variant === "cockpit") {
    return (
      <div className="cockpit-point-sections">
        <div className="cockpit-point-section">
          <div className="cockpit-controls-section-label">Orbit</div>
          <div className="cockpit-point-grid">
            {ORBIT_POINT_MODES.map(renderButton)}
          </div>
        </div>
        <div className="cockpit-point-section">
          <div className="cockpit-controls-section-label">Nav</div>
          <div className="cockpit-point-grid">
            {NAV_POINT_MODES.map(renderButton)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vessel-point-controls">
      <div className="vessel-point-group">
        <div className="vessel-point-group-label">Orbit</div>
        <div className="vessel-point-row">{ORBIT_POINT_MODES.map(renderButton)}</div>
      </div>
      <div className="vessel-point-group">
        <div className="vessel-point-group-label">Nav</div>
        <div className="vessel-point-row">{NAV_POINT_MODES.map(renderButton)}</div>
      </div>
    </div>
  );
}

export function VesselControls({
  compact = false,
  variant,
}: {
  compact?: boolean;
  variant?: VesselControlsVariant;
}) {
  const resolvedVariant: VesselControlsVariant =
    variant ?? (compact ? "compact" : "default");

  const connection = useAppStore((s) => s.connection);
  const controls = useAppStore((s) => s.controls);
  const setControls = useAppStore((s) => s.setControls);
  const setLastError = useAppStore((s) => s.setLastError);
  const [busy, setBusy] = useState(false);
  const [stageCooldown, setStageCooldown] = useState(false);

  const ready = connection.connected;

  const run = async (
    action: () => Promise<NonNullable<typeof controls>>
  ) => {
    setBusy(true);
    setLastError(null);
    try {
      const result = await action();
      setControls(result);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Control failed");
    } finally {
      setBusy(false);
    }
  };

  const handleStage = async () => {
    setStageCooldown(true);
    await run(() => api.stage());
    window.setTimeout(() => setStageCooldown(false), 1500);
  };

  const handlePoint = (mode: VesselPointMode) => {
    void run(() => api.pointVessel(mode));
  };

  if (resolvedVariant === "cockpit") {
    return (
      <div className="cockpit-controls-stack">
        <button
          type="button"
          className="cockpit-control-btn cockpit-control-btn--stage"
          onClick={handleStage}
          disabled={!ready || busy || stageCooldown}
          aria-label="Stage"
        >
          <span className="cockpit-control-btn-label">Stage</span>
          <span className="cockpit-control-btn-state">ARM</span>
        </button>
        <button
          type="button"
          className={cockpitBtnClass(!!controls?.sas)}
          onClick={() => run(() => api.setSas(!(controls?.sas ?? false)))}
          disabled={!ready || busy}
          aria-pressed={!!controls?.sas}
          aria-label="SAS"
        >
          <span className="cockpit-control-btn-label">SAS</span>
          <span className="cockpit-control-btn-state">
            {controls?.sas ? "ON" : "OFF"}
          </span>
        </button>
        <button
          type="button"
          className={cockpitBtnClass(!!controls?.rcs)}
          onClick={() => run(() => api.setRcs(!(controls?.rcs ?? false)))}
          disabled={!ready || busy}
          aria-pressed={!!controls?.rcs}
          aria-label="RCS"
        >
          <span className="cockpit-control-btn-label">RCS</span>
          <span className="cockpit-control-btn-state">
            {controls?.rcs ? "ON" : "OFF"}
          </span>
        </button>
        <button
          type="button"
          className={cockpitBtnClass(!!controls?.lights)}
          onClick={() => run(() => api.setLights(!(controls?.lights ?? false)))}
          disabled={!ready || busy}
          aria-pressed={!!controls?.lights}
          aria-label="Lights"
        >
          <span className="cockpit-control-btn-label">Lights</span>
          <span className="cockpit-control-btn-state">
            {controls?.lights ? "ON" : "OFF"}
          </span>
        </button>

        <PointToControls
          variant="cockpit"
          ready={ready}
          busy={busy}
          controls={controls}
          onPoint={handlePoint}
        />

        {controls ? (
          <div className="cockpit-controls-readout">
            <span>
              STG <strong>{controls.current_stage}</strong>
            </span>
            <span>
              THR <strong>{Math.round(controls.throttle * 100)}%</strong>
            </span>
          </div>
        ) : (
          <p className="meta cockpit-controls-hint">
            Connect kRPC to command the vessel.
          </p>
        )}
      </div>
    );
  }

  if (resolvedVariant === "compact") {
    return (
      <div className="flight-deck-controls">
        <button onClick={handleStage} disabled={!ready || busy || stageCooldown}>
          Stage
        </button>
        <button
          onClick={() => run(() => api.setSas(!(controls?.sas ?? false)))}
          disabled={!ready || busy}
        >
          SAS {controls?.sas ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => run(() => api.setRcs(!(controls?.rcs ?? false)))}
          disabled={!ready || busy}
        >
          RCS {controls?.rcs ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => run(() => api.setLights(!(controls?.lights ?? false)))}
          disabled={!ready || busy}
        >
          LGT {controls?.lights ? "ON" : "OFF"}
        </button>
        <PointToControls
          variant="compact"
          ready={ready}
          busy={busy}
          controls={controls}
          onPoint={handlePoint}
        />
        {controls && (
          <span className="flight-deck-controls-meta">
            STG {controls.current_stage} · THR {Math.round(controls.throttle * 100)}%
          </span>
        )}
      </div>
    );
  }

  return (
    <section className="panel">
      <h2>Vessel Controls</h2>
      <div className="toggle-group">
        <button onClick={handleStage} disabled={!ready || busy || stageCooldown}>
          Stage
        </button>
        <button
          onClick={() => run(() => api.setSas(!(controls?.sas ?? false)))}
          disabled={!ready || busy}
        >
          SAS {controls?.sas ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => run(() => api.setRcs(!(controls?.rcs ?? false)))}
          disabled={!ready || busy}
        >
          RCS {controls?.rcs ? "ON" : "OFF"}
        </button>
        <button
          onClick={() => run(() => api.setLights(!(controls?.lights ?? false)))}
          disabled={!ready || busy}
        >
          Lights {controls?.lights ? "ON" : "OFF"}
        </button>
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <h3 className="vessel-point-heading">Point to</h3>
        <PointToControls
          variant="default"
          ready={ready}
          busy={busy}
          controls={controls}
          onPoint={handlePoint}
        />
      </div>
      {controls && (
        <div className="meta" style={{ marginTop: "0.75rem" }}>
          Stage {controls.current_stage} | Throttle{" "}
          {Math.round(controls.throttle * 100)}%
        </div>
      )}
    </section>
  );
}
