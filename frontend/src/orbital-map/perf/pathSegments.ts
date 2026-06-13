import type { Vector3 } from "../telemetry/schema-v6";

export function distance3(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function pathEndpointsClose(
  points: Vector3[],
  maxGapMeters: number,
): boolean {
  if (points.length < 3) {
    return false;
  }
  return distance3(points[0], points[points.length - 1]) <= maxGapMeters;
}

/**
 * Body trails sample i/N for i=0..N-1 (never UT+period), so the wrap gap is ~one sample step.
 * Fixed 5 Gm tolerance fails for outer planets (e.g. Jool); use leg scale instead.
 */
export function shouldCloseOrbitPeriodTrail(points: Vector3[]): boolean {
  if (points.length < 3) {
    return false;
  }
  const wrapGap = distance3(points[0], points[points.length - 1]);
  const maxLeg = maxConsecutiveLegMeters(points);
  const expectedWrap = Math.max(maxLeg * 2.5, 5e9);
  return wrapGap <= expectedWrap;
}

/** Break polylines where consecutive samples jump (missing/invalid propagation). */
export function splitPathAtGaps(
  positions: Vector3[],
  maxLegMeters: number,
): Vector3[][] {
  if (positions.length < 2) {
    return [];
  }
  const segments: Vector3[][] = [];
  let current: Vector3[] = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const next = positions[i];
    if (distance3(prev, next) > maxLegMeters) {
      if (current.length >= 2) {
        segments.push(current);
      }
      current = [next];
    } else {
      current.push(next);
    }
  }
  if (current.length >= 2) {
    segments.push(current);
  }
  return segments;
}

/** Drop legs that connect the root (Kerbol) to a non-root anchor — bad placement samples. */
export function filterRootBodyChords(
  positions: Vector3[],
  nearRootMeters = 5e10,
): Vector3[] {
  if (positions.length < 2) {
    return positions;
  }
  const radius = (p: Vector3) => distance3(p, { x: 0, y: 0, z: 0 });
  const nearRoot = (p: Vector3) => radius(p) < nearRootMeters;
  const filtered: Vector3[] = [positions[0]];
  for (let i = 1; i < positions.length; i++) {
    const prev = filtered[filtered.length - 1];
    const next = positions[i];
    if (nearRoot(prev) === nearRoot(next)) {
      filtered.push(next);
    }
  }
  return filtered.length >= 2 ? filtered : [];
}

export function nearestPathPointIndex(
  positions: Vector3[],
  target: Vector3,
): number {
  if (positions.length === 0) {
    return -1;
  }
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < positions.length; i++) {
    const d = distance3(positions[i], target);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function maxConsecutiveLegMeters(positions: Vector3[]): number {
  let max = 0;
  for (let i = 1; i < positions.length; i++) {
    max = Math.max(max, distance3(positions[i - 1], positions[i]));
  }
  return max;
}
