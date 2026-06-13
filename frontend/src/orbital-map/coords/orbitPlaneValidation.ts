import type { Vector3 } from "../telemetry/schema-v6";

/** Unit normal from three non-collinear points (right-hand rule). */
export function planeNormalFromThreePoints(
  a: Vector3,
  b: Vector3,
  c: Vector3,
): Vector3 | null {
  const v1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
  const nx = v1.y * v2.z - v1.z * v2.y;
  const ny = v1.z * v2.x - v1.x * v2.z;
  const nz = v1.x * v2.y - v1.y * v2.x;
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-9) {
    return null;
  }
  return { x: nx / len, y: ny / len, z: nz / len };
}

/** Angle between two unit normals (degrees, 0–90). */
export function angleBetweenNormalsDegrees(a: Vector3, b: Vector3): number {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z);
  const clamped = Math.min(1, Math.max(-1, dot));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/** First valid plane normal from a polyline (needs ≥3 distinct points). */
export function planeNormalFromPolyline(points: Vector3[]): Vector3 | null {
  if (points.length < 3) {
    return null;
  }
  for (let i = 0; i < points.length - 2; i++) {
    for (let j = i + 1; j < points.length - 1; j++) {
      for (let k = j + 1; k < points.length; k++) {
        const normal = planeNormalFromThreePoints(
          points[i],
          points[j],
          points[k],
        );
        if (normal) {
          return normal;
        }
      }
    }
  }
  return null;
}
