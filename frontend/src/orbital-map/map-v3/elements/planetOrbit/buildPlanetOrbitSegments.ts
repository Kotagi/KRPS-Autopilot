import type { Vector3 } from "../../../telemetry/schema-v6";
import type { MapContext } from "../../MapContext";
import type { TrajectorySegment } from "../../types";
import {
  densifyPlanetOrbitRootPoints,
  densifyPlanetOrbitSampleUniversalTimes,
  planetOrbitTrailUsesAnalyticSource,
  resolvePlanetOrbitSourcePoints,
  sampleUniversalTimesFromPath,
} from "./densifyPlanetOrbitTrail";
import { shouldIncludeHeliocentricPlanetOrbit } from "./filterHeliocentricPlanetOrbit";

function nearestIndex(
  points: Vector3[],
  target: Vector3,
): number {
  let best = 0;
  let bestDist = Infinity;
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/**
 * Heliocentric planet trails — v3-native path list + samples-first geometry (512 verts).
 */
export function buildPlanetOrbitSegments(ctx: MapContext): TrajectorySegment[] {
  const paths = ctx.telemetry.bodyOrbitPaths ?? [];
  const segments: TrajectorySegment[] = [];

  paths.forEach((path, index) => {
    if (!shouldIncludeHeliocentricPlanetOrbit(ctx, path)) {
      return;
    }

    const bodyName = path.bodyName!;
    const source = resolvePlanetOrbitSourcePoints(ctx, bodyName, []);
    if (source.length < 2) {
      return;
    }

    const points = densifyPlanetOrbitRootPoints(source);
    const bodyEntry = ctx.bodyByName.get(bodyName);
    const anchorIndex = bodyEntry
      ? nearestIndex(points, bodyEntry.position)
      : 0;

    let sampleUniversalTimes: number[] | undefined;
    if (!planetOrbitTrailUsesAnalyticSource(path)) {
      const raw = sampleUniversalTimesFromPath(path);
      if (raw) {
        sampleUniversalTimes = densifyPlanetOrbitSampleUniversalTimes(raw);
      }
    }

    const ref = path.referenceBody ?? path.orbitElements?.referenceBody;
    const parentBody = ref && ref !== ctx.rootBody ? ref : undefined;

    segments.push({
      kind: "planetOrbit",
      key: `orbit-${bodyName ?? index}`,
      points,
      bodyName,
      referenceBody: ref ?? undefined,
      parentBody,
      closed: true,
      anchorIndex,
      sampleUniversalTimes,
      closedWithDuplicateEndpoint: false,
    });
  });

  return segments;
}
