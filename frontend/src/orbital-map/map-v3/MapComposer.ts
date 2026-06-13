import type { MapElementKind } from "./types";
import type { MapV3LayerFlags } from "./layerFlags";

/** Layer component ids — must match `scene/v3/layers/*` file stems. */
export const MAP_V3_LAYER_IDS: Record<MapElementKind, string> = {
  starMarker: "StarMarkerLayer",
  planetOrbit: "PlanetOrbitLayer",
  planetBody: "PlanetBodyLayer",
  moonOrbit: "MoonOrbitLayer",
  moonBody: "MoonBodyLayer",
  vesselMarker: "VesselMarkerLayer",
  bodyLod: "BodyLodLayer",
  vesselOrbit: "VesselOrbitLayer",
  bodyLabel: "BodyLabelLayer",
  futureRoute: "FutureRouteLayer",
  soiRing: "SoiRingLayer",
  selection: "SelectionLayer",
};

const COMPOSE_ORDER: MapElementKind[] = [
  "starMarker",
  "planetOrbit",
  "moonOrbit",
  "planetBody",
  "moonBody",
  "vesselOrbit",
  "futureRoute",
  "vesselMarker",
  "soiRing",
  "bodyLabel",
  "selection",
];

/** Pure composition order for active layers (tests + docs). */
export function composeMapV3Layers(flags: MapV3LayerFlags): string[] {
  return COMPOSE_ORDER.filter((kind) => flags[kind]).map(
    (kind) => MAP_V3_LAYER_IDS[kind],
  );
}
