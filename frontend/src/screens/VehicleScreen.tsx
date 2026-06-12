import { ComingSoonScreen } from "./ComingSoonScreen";

export function VehicleScreen() {
  return (
    <ComingSoonScreen
      title="Vehicle"
      tagline="Stage tree, resources, and vessel inspection"
      modules={[
        "Full stage and part breakdown",
        "Resource totals and engine stats",
        "MechJeb Δv readouts by stage",
        "3D vessel viewer placeholder",
      ]}
    />
  );
}
