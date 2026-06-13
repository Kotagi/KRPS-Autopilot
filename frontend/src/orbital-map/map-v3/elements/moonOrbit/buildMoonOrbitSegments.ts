import type { Vector3 } from "../../../telemetry/schema-v6";
import type { MapContext } from "../../MapContext";
import type { TrajectorySegment } from "../../types";
import {
  densifyPlanetOrbitRootPoints,
  densifyPlanetOrbitSampleUniversalTimes,
  sampleUniversalTimesFromPath,
} from "../planetOrbit/densifyPlanetOrbitTrail";
import { MOON_ORBIT_STYLE } from "./moonOrbitStyle";
import { shouldIncludeMoonOrbit } from "./filterMoonOrbit";
import { liveMoonParentRelativePosition } from "./moonOrbitGeometry";
import {
  moonOrbitTrailUsesAnalyticSource,
  resolveMoonOrbitSourcePoints,
} from "./resolveMoonOrbitSource";

function nearestIndex(points: Vector3[], target: Vector3): number {
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
 * Moon trails — parent-relative samples per UT (DLL), densified like planets.
 */
export function buildMoonOrbitSegments(ctx: MapContext): TrajectorySegment[] {
  const paths = ctx.telemetry.bodyOrbitPaths ?? [];
  const segments: TrajectorySegment[] = [];

  paths.forEach((path, index) => {
    if (!shouldIncludeMoonOrbit(ctx, path)) {
      return;
    }

    const bodyName = path.bodyName!;
    const ref = path.referenceBody ?? path.orbitElements?.referenceBody;
    const parentBody = ref && ref !== ctx.rootBody ? ref : undefined;
    const { points: source, source: geometrySource } =
      resolveMoonOrbitSourcePoints(path, ctx);
    if (source.length < 2) {
      return;
    }

    const points = densifyPlanetOrbitRootPoints(source);
    const liveRelative =
      parentBody && bodyName
        ? liveMoonParentRelativePosition(ctx, bodyName, parentBody)
        : null;
    const anchorIndex = liveRelative
      ? nearestIndex(points, liveRelative)
      : 0;

    let sampleUniversalTimes: number[] | undefined;
    if (!moonOrbitTrailUsesAnalyticSource(path, ctx)) {
      const raw = sampleUniversalTimesFromPath(path);
      if (raw) {
        sampleUniversalTimes = densifyPlanetOrbitSampleUniversalTimes(raw);
      }
    }

    segments.push({
      kind: "moonOrbit",
      key: `moon-orbit-${bodyName ?? index}`,
      points,
      bodyName,
      referenceBody: ref ?? undefined,
      parentBody,
      closed: true,
      anchorIndex,
      sampleUniversalTimes,
      closedWithDuplicateEndpoint: false,
      lineWidth: MOON_ORBIT_STYLE.retrogradeLineWidth,
      geometrySource,
    });
  });

  return segments;
}
