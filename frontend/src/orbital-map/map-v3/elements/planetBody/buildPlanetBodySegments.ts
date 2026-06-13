import type { MapContext } from "../../MapContext";
import type { TrajectorySegment } from "../../types";

/**
 * One segment per stock heliocentric planet at display authority position.
 * Visibility (moon LOD) is applied in PlanetBodyLayer, not here.
 */
export function buildPlanetBodySegments(ctx: MapContext): TrajectorySegment[] {
  const segments: TrajectorySegment[] = [];

  ctx.hierarchy.planetNames.forEach((name) => {
    if (name === ctx.rootBody) {
      return;
    }
    const entry = ctx.bodyByName.get(name);
    if (!entry) {
      return;
    }
    segments.push({
      kind: "planetBody",
      key: `planet-body-${name}`,
      points: [entry.position],
      bodyName: name,
    });
  });

  return segments;
}
