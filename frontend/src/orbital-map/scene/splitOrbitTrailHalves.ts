import {
  ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON,
  ORBIT_TRAIL_OPACITY_TRAILING,
  resolveProgradeIndexStep,
} from "./orbitTrailDirectionStyle";

type Point3 = [number, number, number];

export type OrbitTrailHalf = {
  points: Point3[];
  opacity: number;
};

/** Two continuous polylines meeting at the anchor: solid retrograde + faint prograde. */
export function splitOrbitTrailHalves(
  points: Point3[],
  anchorIndex: number,
  closedWithDuplicateEndpoint: boolean,
  sampleUniversalTimes?: number[],
): { retrograde: OrbitTrailHalf; prograde: OrbitTrailHalf } {
  const period = closedWithDuplicateEndpoint ? points.slice(0, -1) : points;
  const n = period.length;
  const anchor = period[anchorIndex % n] ?? points[0];
  const step = resolveProgradeIndexStep(anchorIndex, n, sampleUniversalTimes);
  const half = Math.max(1, Math.floor(n / 2));

  const progradePts: Point3[] = [anchor];
  const retrogradePts: Point3[] = [anchor];

  for (let i = 1; i <= half; i++) {
    progradePts.push(period[(anchorIndex + step * i + n) % n]);
    retrogradePts.push(period[(anchorIndex - step * i + n) % n]);
  }

  return {
    retrograde: {
      points: retrogradePts,
      opacity: ORBIT_TRAIL_OPACITY_TRAILING,
    },
    prograde: {
      points: progradePts,
      opacity: ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON,
    },
  };
}
