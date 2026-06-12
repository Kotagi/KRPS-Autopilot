import { ComingSoonScreen } from "./ComingSoonScreen";

export function MapScreen() {
  return (
    <ComingSoonScreen
      title="Trajectory"
      tagline="In-game map view with patched conics and body selection"
      modules={[
        "Active vessel orbit and maneuver nodes",
        "SOI transitions and encounter markers",
        "Select catalog bodies and show their trajectories",
        "2D/3D view toggle",
      ]}
    />
  );
}
