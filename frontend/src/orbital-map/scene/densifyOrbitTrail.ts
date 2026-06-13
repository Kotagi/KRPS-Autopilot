/** Closed body orbit period vertices (telemetry ships ~128). */
export const BODY_ORBIT_TRAIL_PERIOD_VERTICES = 512;

type Point3 = [number, number, number];

function dist3(a: Point3, b: Point3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function lerp3(a: Point3, b: Point3, t: number): Point3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Uniform arc-length resample so zoomed orbits are smooth circles, not sparse telemetry gons.
 */
export function densifyOrbitTrailPoints(
  points: Point3[],
  closedWithDuplicateEndpoint: boolean,
  targetPeriodVertices = BODY_ORBIT_TRAIL_PERIOD_VERTICES,
  /** When true, wrap last→first even if the polyline has no duplicate closing vertex. */
  closedLoop = false,
): Point3[] {
  if (points.length < 3) {
    return points;
  }

  const closed = closedLoop || closedWithDuplicateEndpoint;
  const period =
    closedWithDuplicateEndpoint && !closedLoop
      ? points.slice(0, -1)
      : points;
  if (period.length < 3) {
    return points;
  }
  const segCount = closed ? period.length : period.length - 1;
  const segLengths: number[] = [];
  let total = 0;

  for (let i = 0; i < segCount; i++) {
    const j = closed ? (i + 1) % period.length : i + 1;
    const len = dist3(period[i], period[j]);
    segLengths.push(len);
    total += len;
  }

  if (total < 1e-12) {
    return points;
  }

  const target = Math.max(targetPeriodVertices, period.length);
  const dense: Point3[] = [];

  for (let k = 0; k < target; k++) {
    const distAlong =
      closed && target > 1
        ? (k / (target - 1)) * total
        : (k / target) * total;
    let walked = 0;
    for (let i = 0; i < segCount; i++) {
      const segLen = segLengths[i];
      if (walked + segLen >= distAlong || i === segCount - 1) {
        const local = segLen > 1e-12 ? (distAlong - walked) / segLen : 0;
        const j = closed ? (i + 1) % period.length : i + 1;
        dense.push(lerp3(period[i], period[j], Math.max(0, Math.min(1, local))));
        break;
      }
      walked += segLen;
    }
  }

  if (dense.length < 2) {
    return points;
  }

  if (closedWithDuplicateEndpoint) {
    return [...dense, dense[0]];
  }

  return dense;
}

export function densifySampleUniversalTimes(
  sampleUniversalTimes: number[],
  targetPeriodVertices: number,
): number[] {
  const n = sampleUniversalTimes.length;
  if (n < 2 || targetPeriodVertices < 2) {
    return sampleUniversalTimes;
  }

  return Array.from({ length: targetPeriodVertices }, (_, i) => {
    const phase = (i / targetPeriodVertices) * n;
    const i0 = Math.min(Math.floor(phase), n - 1);
    const i1 = (i0 + 1) % n;
    const frac = phase - i0;
    return (
      sampleUniversalTimes[i0] * (1 - frac)
      + sampleUniversalTimes[i1] * frac
    );
  });
}
