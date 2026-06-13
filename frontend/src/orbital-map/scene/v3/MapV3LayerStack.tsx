import { StarMarkerLayer } from "./layers/StarMarkerLayer";
import { PlanetOrbitLayer } from "./layers/PlanetOrbitLayer";
import { MoonBodyLayer } from "./layers/MoonBodyLayer";
import { MoonOrbitLayer } from "./layers/MoonOrbitLayer";
import { PlanetBodyLayer } from "./layers/PlanetBodyLayer";

/**
 * R3F layer composition for Map V3.
 * Layers self-null when their flag is off.
 */
export function MapV3LayerStack() {
  return (
    <>
      <StarMarkerLayer />
      <PlanetOrbitLayer />
      <MoonOrbitLayer />
      <PlanetBodyLayer />
      <MoonBodyLayer />
    </>
  );
}
