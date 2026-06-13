import { starBody, type MapContext } from "../../MapContext";
import type { SystemAnchor } from "../../types";

/** Resolve star anchors for the active snapshot. Phase 1: single root star. */
export function resolveSystemAnchors(ctx: MapContext): SystemAnchor[] {
  const star = starBody(ctx);
  if (!star) {
    return [];
  }
  return [
    {
      id: `star-${star.name}`,
      bodyName: star.name,
      position: star.position,
      radiusMeters: star.radiusMeters,
    },
  ];
}
