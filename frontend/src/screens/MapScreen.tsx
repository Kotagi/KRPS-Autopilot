import { OrbitalMapView } from "../components/map/OrbitalMapView";
import { ScreenFrame } from "../components/layout/ScreenFrame";

export function MapScreen() {
  return (
    <ScreenFrame
      title="Trajectory"
      tagline="3D solar system map with planet orbits, textures, tilt, and spin"
      bodyClassName="screen-frame-body--map"
    >
      <OrbitalMapView />
    </ScreenFrame>
  );
}
