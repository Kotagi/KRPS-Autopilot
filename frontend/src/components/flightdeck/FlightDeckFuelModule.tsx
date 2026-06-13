import { FuelGaugeRow } from "../resources/FuelGauge";
import type { StageFuelSnapshot, VesselDeltaV } from "../../api/types";

interface FlightDeckFuelModuleProps {
  stageResources: StageFuelSnapshot | null;
  deltaV: VesselDeltaV | null;
}

export function FlightDeckFuelModule({
  stageResources,
  deltaV,
}: FlightDeckFuelModuleProps) {
  const stages = stageResources?.stages ?? [];

  return (
    <section className="cockpit-module cockpit-module--fuel panel">
      <header className="cockpit-fuel-header">
        <span className="cockpit-module-label">Propellant</span>
        <div className="cockpit-fuel-metrics">
          <div className="cockpit-fuel-metric">
            <span>Stage Δv</span>
            <strong>
              {deltaV ? `${Math.round(deltaV.stage_vac_ms)} m/s` : "—"}
            </strong>
          </div>
          <div className="cockpit-fuel-metric">
            <span>Total Δv</span>
            <strong>
              {deltaV ? `${Math.round(deltaV.total_vac_ms)} m/s` : "—"}
            </strong>
          </div>
          <div className="cockpit-fuel-metric">
            <span>TWR</span>
            <strong>{deltaV ? deltaV.surface_twr.toFixed(2) : "—"}</strong>
          </div>
          {stageResources && (
            <div className="cockpit-fuel-metric cockpit-fuel-metric--stage">
              <span>Next staging</span>
              <strong>{stageResources.current_stage}</strong>
            </div>
          )}
        </div>
      </header>

      <div className="cockpit-fuel-gauges">
        <FuelGaugeRow stages={stages} />
      </div>
    </section>
  );
}
