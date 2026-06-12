import type { AscentConfig, ClassicPathConfig } from "../../api/types";

interface Props {
  config: AscentConfig;
  disabled: boolean;
  onChange: (config: AscentConfig) => void;
}

export function ClassicModeFields({ config, disabled, onChange }: Props) {
  const update = <K extends keyof ClassicPathConfig>(
    key: K,
    value: ClassicPathConfig[K]
  ) => {
    onChange({
      ...config,
      classic: { ...config.classic, [key]: value },
    });
  };

  return (
    <div className="mode-section">
      <h3>Classic path</h3>
      <div className="row">
        <div className="field">
          <label>Turn start alt (km)</label>
          <input
            type="number"
            step="0.1"
            value={config.classic.turn_start_altitude_km}
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
            value={config.classic.turn_start_velocity_ms}
            onChange={(e) =>
              update("turn_start_velocity_ms", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Turn end alt (km)</label>
          <input
            type="number"
            step="0.1"
            value={config.classic.turn_end_altitude_km}
            onChange={(e) =>
              update("turn_end_altitude_km", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Turn end angle (deg)</label>
          <input
            type="number"
            step="0.1"
            value={config.classic.turn_end_angle_deg}
            onChange={(e) =>
              update("turn_end_angle_deg", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Turn shape (%)</label>
          <input
            type="number"
            step="0.1"
            value={config.classic.turn_shape_exponent}
            onChange={(e) =>
              update("turn_shape_exponent", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
      </div>
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <label>
          <input
            type="checkbox"
            checked={config.classic.auto_path}
            onChange={(e) => update("auto_path", e.target.checked)}
            disabled={disabled}
          />{" "}
          Auto path
        </label>
      </div>
    </div>
  );
}
