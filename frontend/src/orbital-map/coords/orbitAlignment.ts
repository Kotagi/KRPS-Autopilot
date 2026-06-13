import type { Vector3 } from "../telemetry/schema-v6";

/** Shortest distance from point to a polyline (meters). */
export function nearestPointOnPolyline(
  point: Vector3,
  polyline: Vector3[],
): { distanceMeters: number; nearest: Vector3 } {
  if (polyline.length === 0) {
    return { distanceMeters: Infinity, nearest: point };
  }
  if (polyline.length === 1) {
    return {
      distanceMeters: distance(point, polyline[0]),
      nearest: polyline[0],
    };
  }

  let bestDistance = Infinity;
  let bestPoint = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const projected = projectOntoSegment(point, a, b);
    const d = distance(point, projected);
    if (d < bestDistance) {
      bestDistance = d;
      bestPoint = projected;
    }
  }

  return { distanceMeters: bestDistance, nearest: bestPoint };
}

function distance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function projectOntoSegment(p: Vector3, a: Vector3, b: Vector3): Vector3 {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq < 1e-18) {
    return { ...a };
  }
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const apz = p.z - a.z;
  let t = (apx * abx + apy * aby + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return {
    x: a.x + abx * t,
    y: a.y + aby * t,
    z: a.z + abz * t,
  };
}
