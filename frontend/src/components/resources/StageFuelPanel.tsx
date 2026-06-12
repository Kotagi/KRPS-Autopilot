import { FuelGaugeRow } from "./FuelGauge";
import { useAppStore } from "../../store/appStore";

export function StageFuelPanel() {
  const connection = useAppStore((s) => s.connection);
  const stageResources = useAppStore((s) => s.stageResources);

  if (!connection.connected) {
    return null;
  }

  const stages = stageResources?.stages ?? [];

  return (
    <section className="panel">
      <h2>Stage Fuel</h2>
      <FuelGaugeRow stages={stages} />
      {stages.length > 0 && (
        <div className="meta" style={{ marginTop: "0.75rem" }}>
          Current stage {stageResources?.current_stage ?? "—"} · Red line drops
          as propellant burns
        </div>
      )}
    </section>
  );
}
