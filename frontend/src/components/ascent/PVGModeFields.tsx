import type { AscentConfig, PVGPathConfig } from "../../api/types";

interface Props {
  config: AscentConfig;
  disabled: boolean;
  onChange: (config: AscentConfig) => void;
}

export function PVGModeFields({ config, disabled, onChange }: Props) {
  const update = <K extends keyof PVGPathConfig>(
    key: K,
    value: PVGPathConfig[K]
  ) => {
    const nextPvg = { ...config.pvg, [key]: value };
    if (key === "target_periapsis_km") {
      const peri = Number(value);
      const apo = nextPvg.target_apoapsis_km;
      if (apo <= 0 || apo <= peri) {
        nextPvg.target_apoapsis_km = peri;
      }
    }
    onChange({
      ...config,
      desired_orbit_altitude_km: nextPvg.target_periapsis_km,
      pvg: nextPvg,
    });
  };

  return (
    <div className="mode-section">
      <h3>PVG / RSS / RO path</h3>
      <p className="meta" style={{ marginBottom: "0.75rem" }}>
        Target Pe/Ap here should match MechJeb after you click Configure or Start
        Ascent. Use Sync from MechJeb to pull what the in-game window shows.
      </p>
      <div className="row">
        <div className="field">
          <label>Target periapsis (km)</label>
          <input
            type="number"
            step="0.1"
            value={config.pvg.target_periapsis_km}
            onChange={(e) =>
              update("target_periapsis_km", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Target apoapsis (km)</label>
          <input
            type="number"
            step="0.1"
            value={config.pvg.target_apoapsis_km}
            onChange={(e) =>
              update("target_apoapsis_km", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Pitch start velocity (m/s)</label>
          <input
            type="number"
            value={config.pvg.pitch_start_velocity_ms}
            onChange={(e) =>
              update("pitch_start_velocity_ms", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Pitch rate (deg/s)</label>
          <input
            type="number"
            step="0.01"
            value={config.pvg.pitch_rate_deg_per_s}
            onChange={(e) =>
              update("pitch_rate_deg_per_s", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Q trigger (kPa)</label>
          <input
            type="number"
            step="0.1"
            value={config.pvg.q_trigger_kpa}
            onChange={(e) => update("q_trigger_kpa", Number(e.target.value))}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <div className="field">
          <label>Attach altitude (km)</label>
          <input
            type="number"
            step="0.1"
            value={config.pvg.attach_altitude_km}
            onChange={(e) =>
              update("attach_altitude_km", Number(e.target.value))
            }
            disabled={disabled || !config.pvg.attach_alt_enabled}
          />
        </div>
        <div className="field">
          <label>PVG after stage #</label>
          <input
            type="number"
            min={1}
            step={1}
            value={config.pvg.pvg_after_stage}
            onChange={(e) =>
              update("pvg_after_stage", Number(e.target.value))
            }
            disabled={disabled || !config.pvg.pvg_after_stage_enabled}
          />
        </div>
        <div className="field">
          <label>Fixed coast length (s)</label>
          <input
            type="number"
            step="0.1"
            value={config.pvg.fixed_coast_length_s}
            onChange={(e) =>
              update("fixed_coast_length_s", Number(e.target.value))
            }
            disabled={disabled || !config.pvg.fixed_coast}
          />
        </div>
      </div>
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <label>
          <input
            type="checkbox"
            checked={config.pvg.attach_alt_enabled}
            onChange={(e) => update("attach_alt_enabled", e.target.checked)}
            disabled={disabled}
          />{" "}
          Attach altitude
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.pvg.pvg_after_stage_enabled}
            onChange={(e) =>
              update("pvg_after_stage_enabled", e.target.checked)
            }
            disabled={disabled}
          />{" "}
          PVG after stage
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.pvg.fixed_coast}
            onChange={(e) => update("fixed_coast", e.target.checked)}
            disabled={disabled}
          />{" "}
          Fixed coast
        </label>
      </div>
    </div>
  );
}
