import type { Vector3 } from "../telemetry/schema-v6";
import { decimatePath } from "../perf/lineDecimation";

/** Cap trail vertices for CEF / WebGL stability in the in-game browser. */
export const MAP_V2_MAX_TRAIL_POINTS = 180;

export function isFiniteRootPoint(p: Vector3): boolean {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Number.isFinite(p.z)
  );
}

export function sanitizeRootPoints(points: Vector3[]): Vector3[] {
  return points.filter(isFiniteRootPoint);
}

export function decimateRootTrail(points: Vector3[]): Vector3[] {
  const clean = sanitizeRootPoints(points);
  return decimatePath(clean, MAP_V2_MAX_TRAIL_POINTS);
}
