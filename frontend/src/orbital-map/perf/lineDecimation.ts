import type { Vector3 } from "../telemetry/schema-v6";

/** Reduce polyline point count by uniform stride sampling. */
export function decimatePath(points: Vector3[], maxPoints: number): Vector3[] {
  if (points.length <= maxPoints || maxPoints < 2) {
    return points;
  }
  const result: Vector3[] = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.round(i * step), points.length - 1);
    result.push(points[idx]);
  }
  return result;
}

/** Densify a sparse polyline by linear interpolation (e.g. body orbit trails). */
export function densifyPath(points: Vector3[], targetCount: number): Vector3[] {
  if (points.length < 2 || points.length >= targetCount) {
    return points;
  }
  const result: Vector3[] = [];
  const span = points.length - 1;
  for (let i = 0; i < targetCount; i++) {
    const t = (i / (targetCount - 1)) * span;
    const idx = Math.min(Math.floor(t), span - 1);
    const frac = t - idx;
    const a = points[idx];
    const b = points[idx + 1];
    result.push({
      x: a.x + (b.x - a.x) * frac,
      y: a.y + (b.y - a.y) * frac,
      z: a.z + (b.z - a.z) * frac,
    });
  }
  return result;
}
