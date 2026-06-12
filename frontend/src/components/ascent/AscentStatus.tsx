import { useAppStore } from "../../store/appStore";

export function AscentStatus() {
  const ascent = useAppStore((s) => s.ascent);

  if (!ascent) {
    return (
      <div className="meta">Ascent status: waiting for telemetry...</div>
    );
  }

  return (
    <div className="meta">
      State: <strong>{ascent.state}</strong> | Path:{" "}
      {ascent.ascent_path || "—"} | MechJeb: {ascent.mj_status || "—"} | Autopilot:{" "}
      <strong>{ascent.enabled ? "engaged" : "off"}</strong> | Launch mode:{" "}
      {ascent.launch_mode}
      {ascent.last_error && (
        <div style={{ color: "#ffb4be", marginTop: "0.5rem" }}>
          Error: {ascent.last_error}
        </div>
      )}
    </div>
  );
}
