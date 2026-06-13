import type { MapContext } from "../../MapContext";
import type { TrajectorySegment } from "../../types";

/**
 * One segment per stock moon at display authority position.
 * Visibility (parent mesh LOD + moon SOI) is applied in MoonBodyLayer.
 */
export function buildMoonBodySegments(ctx: MapContext): TrajectorySegment[] {
  const segments: TrajectorySegment[] = [];

  ctx.hierarchy.allMoonNames.forEach((name) => {
    const entry = ctx.bodyByName.get(name);
    if (!entry) {
      return;
    }
    const parent = ctx.hierarchy.planetForBody[name];
    if (!parent || !ctx.hierarchy.planetNames.includes(parent)) {
      return;
    }
    segments.push({
      kind: "moonBody",
      key: `moon-body-${name}`,
      points: [entry.position],
      bodyName: name,
      parentBody: parent,
    });
  });

  return segments;
}
