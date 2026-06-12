import type { AscentConfig, GTPathConfig } from "../../api/types";

interface Props {
  config: AscentConfig;
  disabled: boolean;
  onChange: (config: AscentConfig) => void;
}

export function GTModeFields({ config, disabled, onChange }: Props) {
  const update = <K extends keyof GTPathConfig>(
    key: K,
    value: GTPathConfig[K]
  ) => {
    onChange({
      ...config,
      gt: { ...config.gt, [key]: value },
    });
  };

  return (
    <div className="mode-section">
      <h3>Gravity turn path</h3>
      <div className="row">
        <div className="field">
          <label>Turn start alt (km)</label>
          <input
            type="number"
            step="0.1"
            value={config.gt.turn_start_altitude_km}
            onChange={(e) =>
              update("turn_start_altitude_km", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Turn start velocity (m/s)</label>
          <input
            type="number"
            value={config.gt.turn_start_velocity_ms}
            onChange={(e) =>
              update("turn_start_velocity_ms", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Turn start pitch (deg)</label>
          <input
            type="number"
            step="0.1"
            value={config.gt.turn_start_pitch_deg}
            onChange={(e) =>
              update("turn_start_pitch_deg", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Intermediate alt (km)</label>
          <input
            type="number"
            step="0.1"
            value={config.gt.intermediate_altitude_km}
            onChange={(e) =>
              update("intermediate_altitude_km", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Hold AP time (s)</label>
          <input
            type="number"
            step="0.1"
            value={config.gt.hold_ap_time_s}
            onChange={(e) => update("hold_ap_time_s", Number(e.target.value))}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
