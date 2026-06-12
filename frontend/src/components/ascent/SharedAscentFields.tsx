import type { AscentConfig } from "../../api/types";

interface Props {
  config: AscentConfig;
  disabled: boolean;
  onChange: (config: AscentConfig) => void;
}

export function SharedAscentFields({ config, disabled, onChange }: Props) {
  const update = <K extends keyof AscentConfig>(
    key: K,
    value: AscentConfig[K]
  ) => {
    onChange({ ...config, [key]: value });
  };

  const showOrbitAltitude = config.ascent_path !== "pvg";

  return (
    <>
      <div className="row">
        {showOrbitAltitude && (
          <div className="field">
            <label>Orbit altitude (km)</label>
            <input
              type="number"
              value={config.desired_orbit_altitude_km}
              onChange={(e) =>
                update("desired_orbit_altitude_km", Number(e.target.value))
              }
              disabled={disabled}
            />
          </div>
        )}
        <div className="field">
          <label>Inclination (deg)</label>
          <input
            type="number"
            step="0.01"
            value={config.desired_inclination_deg}
            onChange={(e) =>
              update("desired_inclination_deg", Number(e.target.value))
            }
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Vertical roll</label>
          <input
            type="number"
            value={config.vertical_roll}
            onChange={(e) => update("vertical_roll", Number(e.target.value))}
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label>Turn roll</label>
          <input
            type="number"
            value={config.turn_roll}
            onChange={(e) => update("turn_roll", Number(e.target.value))}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <label>
          <input
            type="checkbox"
            checked={config.autostage}
            onChange={(e) => update("autostage", e.target.checked)}
            disabled={disabled}
          />{" "}
          Autostage
        </label>
        <label>
          <input
            type="checkbox"
            checked={config.force_roll}
            onChange={(e) => update("force_roll", e.target.checked)}
            disabled={disabled}
          />{" "}
          Force roll
        </label>
      </div>
    </>
  );
}
