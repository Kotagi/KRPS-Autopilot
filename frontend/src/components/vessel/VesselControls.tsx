import { useState } from "react";

import { api } from "../../api/client";
import { useAppStore } from "../../store/appStore";

export function VesselControls({ compact = false }: { compact?: boolean }) {
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

  if (compact) {
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
      {controls && (
        <div className="meta" style={{ marginTop: "0.75rem" }}>
          Stage {controls.current_stage} | Throttle{" "}
          {Math.round(controls.throttle * 100)}%
        </div>
      )}
    </section>
  );
}
