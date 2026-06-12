import { api } from "../../api/client";
import type { AscentConfig } from "../../api/types";
import { useAppStore } from "../../store/appStore";

interface TargetPlaneLaunchProps {
  config: AscentConfig;
  disabled: boolean;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onConfigChange: (config: AscentConfig) => void;
}

export function TargetPlaneLaunch({
  config,
  disabled,
  busy,
  onBusyChange,
  onConfigChange,
}: TargetPlaneLaunchProps) {
  const target = useAppStore((s) => s.target);
  const setAscent = useAppStore((s) => s.setAscent);
  const setLastError = useAppStore((s) => s.setLastError);
  const ascent = useAppStore((s) => s.ascent);

  if (!target || target.target_type === "none" || !target.name) {
    return null;
  }

  const timedLaunchActive =
    ascent?.launch_mode?.toLowerCase().includes("target_plane") ?? false;

  const handleLaunch = async () => {
    onBusyChange(true);
    setLastError(null);
    try {
      const status = await api.launchToTargetPlane(config);
      setAscent(status);
    } catch (err) {
      setLastError(
        err instanceof Error ? err.message : "Launch to target plane failed"
      );
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <section className="target-plane-launch">
      <div className="target-plane-header">
        <span className="target-plane-label">Target Plane Window</span>
        <span className="target-plane-status">
          {timedLaunchActive ? "COUNTDOWN ACTIVE" : "READY"}
        </span>
      </div>
      <p className="target-plane-copy">
        Locked on <strong>{target.name}</strong>. Schedules a MechJeb timed launch
        into the target&apos;s orbital plane and sets inclination automatically.
      </p>
      <div className="row">
        <div className="field">
          <label>LAN offset (°)</label>
          <input
            type="number"
            step="0.1"
            value={config.launch_lan_difference_deg}
            onChange={(event) =>
              onConfigChange({
                ...config,
                launch_lan_difference_deg: Number(event.target.value),
              })
            }
            disabled={disabled || busy}
          />
        </div>
      </div>
      <div className="row" style={{ marginTop: "0.65rem" }}>
        <button
          className="target-lock"
          disabled={disabled || busy}
          onClick={() => void handleLaunch()}
        >
          Launch to Target Plane
        </button>
      </div>
      <p className="target-plane-hint">
        Configures ascent, engages autopilot, and starts the plane-match countdown.
        Stage when MechJeb calls for liftoff.
      </p>
    </section>
  );
}
