import type { MapContext } from "../MapContext";
import { buildStarMarkerSegments } from "../elements/starMarker/buildStarMarkerSegments";
import { buildPlanetBodySegments } from "../elements/planetBody/buildPlanetBodySegments";
import { buildMoonBodySegments } from "../elements/moonBody/buildMoonBodySegments";
import { buildMoonOrbitSegments } from "../elements/moonOrbit/buildMoonOrbitSegments";
import { buildPlanetOrbitSegments } from "../elements/planetOrbit/buildPlanetOrbitSegments";
import type { MapElementKind, TrajectorySegment } from "../types";

export function buildSegments(
  ctx: MapContext,
  kind: MapElementKind,
): TrajectorySegment[] {
  switch (kind) {
    case "starMarker":
      return buildStarMarkerSegments(ctx);
    case "planetOrbit":
      return buildPlanetOrbitSegments(ctx);
    case "planetBody":
      return buildPlanetBodySegments(ctx);
    case "moonOrbit":
      return buildMoonOrbitSegments(ctx);
    case "moonBody":
      return buildMoonBodySegments(ctx);
    default:
      return [];
  }
}
