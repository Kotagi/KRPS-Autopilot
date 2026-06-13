import type { MapContext } from "../../MapContext";
import type { TrajectorySegment } from "../../types";
import { resolveSystemAnchors } from "./resolveSystemAnchors";

export function buildStarMarkerSegments(ctx: MapContext): TrajectorySegment[] {
  return resolveSystemAnchors(ctx).map((anchor) => ({
    kind: "starMarker" as const,
    key: anchor.id,
    points: [anchor.position],
    bodyName: anchor.bodyName,
  }));
}
