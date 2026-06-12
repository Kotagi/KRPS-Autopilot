import { AscentPanel } from "../components/ascent/AscentPanel";
import { ManeuverPanel } from "../components/maneuver/ManeuverPanel";
import { StageFuelPanel } from "../components/resources/StageFuelPanel";
import { TargetPanel } from "../components/target/TargetPanel";
import { VesselControls } from "../components/vessel/VesselControls";
import { ScreenFrame } from "../components/layout/ScreenFrame";

export function AutopilotScreen() {
  return (
    <ScreenFrame
      title="Autopilot"
      tagline="Target catalog, ascent, maneuvers, and vessel controls"
    >
      <TargetPanel />
      <VesselControls />
      <StageFuelPanel />
      <ManeuverPanel />
      <AscentPanel />
    </ScreenFrame>
  );
}
