import { FuelGaugeRow } from "../resources/FuelGauge";
import { DeltaVPanel } from "./DeltaVPanel";
import type { StageFuelSnapshot, VesselDeltaV } from "../../api/types";

interface FlightResourcesColumnProps {
  stageResources: StageFuelSnapshot | null;
  deltaV: VesselDeltaV | null;
}

export function FlightResourcesColumn({
  stageResources,
  deltaV,
}: FlightResourcesColumnProps) {
  const stages = stageResources?.stages ?? [];

  return (
    <div className="flight-resources-column">
      <DeltaVPanel deltaV={deltaV} />
      <div className="flight-resources-fuel">
        <FuelGaugeRow stages={stages} />
      </div>
      {stageResources && (
        <div className="meta flight-resources-meta">
          Stage {stageResources.current_stage} active · {stages.length} tracked
        </div>
      )}
    </div>
  );
}
