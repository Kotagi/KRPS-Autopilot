import type { Vector3 } from "../telemetry/schema-v6";
import { distance3, maxConsecutiveLegMeters } from "../perf/pathSegments";

const MIN_HELIOCENTRIC_RADIUS_METERS = 1e9;
const SOI_LOCAL_RADIUS_METERS = 1e8;
const WEDGE_RADIUS_SCALE_RATIO = 100;
const WEDGE_CHORD_METERS = 5e10;

function radiusMeters(p: Vector3): number {
  return distance3(p, { x: 0, y: 0, z: 0 });
}

/** Detect the Sun–SOI mixed-scale wedge, not normal long chords along one orbit. */
export function isVesselPathWedgeArtifact(points: Vector3[]): boolean {
  if (points.length < 2) {
    return true;
  }

  const radii = points.map(radiusMeters);
  const maxRadius = Math.max(...radii);
  const minRadius = Math.min(...radii);

  if (maxRadius < MIN_HELIOCENTRIC_RADIUS_METERS) {
    return true;
  }

  if (
    minRadius < SOI_LOCAL_RADIUS_METERS &&
    maxRadius > MIN_HELIOCENTRIC_RADIUS_METERS &&
    maxRadius / Math.max(minRadius, 1) > WEDGE_RADIUS_SCALE_RATIO
  ) {
    return true;
  }

  const maxLeg = maxConsecutiveLegMeters(points);
  if (minRadius < SOI_LOCAL_RADIUS_METERS && maxLeg > WEDGE_CHORD_METERS) {
    return true;
  }

  return false;
}

export function isRenderableVesselRootPath(points: Vector3[]): boolean {
  return points.length >= 2 && !isVesselPathWedgeArtifact(points);
}
