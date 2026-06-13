import {
  buildBodyOrbitTrailSegments,
  canUseAnalyticBodyOrbit,
  findBodyOrbitAnchor,
  resolveTrailRenderMode,
} from "../../../coords/buildBodyOrbitTrail";
import {
  densifyOrbitTrailPoints,
  densifySampleUniversalTimes,
} from "../../../scene/densifyOrbitTrail";
import type { BodyOrbitPath, Vector3 } from "../../../telemetry/schema-v6";
import type { MapContext } from "../../MapContext";
import type { ScenePoint3 } from "../../types";
import { PLANET_ORBIT_STYLE } from "./planetOrbitStyle";

type Point3 = [number, number, number];

function toPoint3(p: Vector3): Point3 {
  return [p.x, p.y, p.z];
}

function fromPoint3(p: Point3): Vector3 {
  return { x: p[0], y: p[1], z: p[2] };
}

function stripDuplicateClosingVertex(points: Vector3[]): Vector3[] {
  if (points.length < 2) {
    return points;
  }
  const a = points[0];
  const b = points[points.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1) {
    return points.slice(0, -1);
  }
  return points;
}

/** UT aligned with telemetry samples (one per sample position). */
export function sampleUniversalTimesFromPath(
  path: BodyOrbitPath,
): number[] | undefined {
  const times: number[] = [];
  for (const s of path.samples ?? []) {
    if (!s.positionRootRelativeMeters) {
      continue;
    }
    const t = s.sampleUniversalTimeSeconds;
    if (typeof t !== "number" || !Number.isFinite(t)) {
      return undefined;
    }
    times.push(t);
  }
  return times.length >= 2 ? times : undefined;
}

/** Resample UT to match `densifyPlanetOrbitRootPoints` vertex count. */
export function densifyPlanetOrbitSampleUniversalTimes(
  sampleUniversalTimes: number[],
): number[] {
  if (sampleUniversalTimes.length < 2) {
    return sampleUniversalTimes;
  }
  if (sampleUniversalTimes.length >= PLANET_ORBIT_STYLE.trailVertices) {
    return [...sampleUniversalTimes];
  }
  return densifySampleUniversalTimes(
    sampleUniversalTimes,
    PLANET_ORBIT_STYLE.trailVertices,
  );
}

/** Heliocentric planet periods are always closed rings (not the 1 km planner heuristic). */
export function densifyPlanetOrbitRootPoints(points: Vector3[]): Vector3[] {
  const ring = stripDuplicateClosingVertex(points);
  if (ring.length < 3) {
    return points;
  }
  if (ring.length >= PLANET_ORBIT_STYLE.trailVertices) {
    return ring.map((p) => ({ ...p }));
  }
  return densifyOrbitTrailPoints(
    ring.map(toPoint3),
    false,
    PLANET_ORBIT_STYLE.trailVertices,
    true,
  ).map(fromPoint3);
}

function samplePositionsFromPath(path: BodyOrbitPath): Vector3[] {
  const points: Vector3[] = [];
  for (const s of path.samples ?? []) {
    const p = s.positionRootRelativeMeters;
    if (
      p
      && Number.isFinite(p.x)
      && Number.isFinite(p.y)
      && Number.isFinite(p.z)
    ) {
      points.push(p);
    }
  }
  return points;
}

function analyticOrbitPoints(
  path: BodyOrbitPath,
  bodies: { body: { name?: string }; position: Vector3 }[],
  rootBody: string | null | undefined,
): Vector3[] | null {
  if (!canUseAnalyticBodyOrbit(path)) {
    return null;
  }
  const anchor = findBodyOrbitAnchor(
    path,
    bodies,
    rootBody,
    path.samples?.[0] ?? null,
  );
  const analytic = buildBodyOrbitTrailSegments(path, anchor).flat();
  return analytic.length >= 3 ? analytic : null;
}

/** True when the drawn trail uses Keplerian analytic geometry (no sample polyline). */
export function planetOrbitTrailUsesAnalyticSource(path: BodyOrbitPath): boolean {
  if (resolveTrailRenderMode(path) === "hidden") {
    return false;
  }
  if (samplePositionsFromPath(path).length >= 2) {
    return false;
  }
  return canUseAnalyticBodyOrbit(path);
}

/**
 * Match v2 `bodyOrbitSegmentsForPath`: telemetry samples first, analytic fallback only
 * when fewer than two sample points. Respects `validation.trailRenderMode` (hidden).
 */
export function resolvePlanetOrbitPointsFromPath(
  path: BodyOrbitPath,
  bodies: { body: { name?: string }; position: Vector3 }[],
  rootBody: string | null | undefined,
  fallbackPoints: Vector3[],
): Vector3[] {
  if (resolveTrailRenderMode(path) === "hidden") {
    return fallbackPoints;
  }

  const samples = samplePositionsFromPath(path);
  if (samples.length >= 2) {
    return samples;
  }

  return analyticOrbitPoints(path, bodies, rootBody) ?? fallbackPoints;
}

export function resolvePlanetOrbitSourcePoints(
  ctx: MapContext,
  bodyName: string | undefined,
  fallbackPoints: Vector3[],
): Vector3[] {
  if (!bodyName) {
    return fallbackPoints;
  }
  const path = (ctx.telemetry.bodyOrbitPaths ?? []).find(
    (p) => p.bodyName === bodyName,
  );
  if (!path) {
    return fallbackPoints;
  }
  const bodies = ctx.bodies.map((b) => ({
    body: { name: b.name },
    position: b.position,
  }));
  return resolvePlanetOrbitPointsFromPath(
    path,
    bodies,
    ctx.rootBody,
    fallbackPoints,
  );
}

/** Scene-space safety net when sparse trails slip through. */
export function densifyPlanetOrbitScenePoints(points: ScenePoint3[]): ScenePoint3[] {
  if (points.length >= PLANET_ORBIT_STYLE.trailVertices) {
    return points;
  }
  const asVec = points.map(
    (p): Vector3 => ({ x: p[0], y: p[1], z: p[2] }),
  );
  const dense = densifyPlanetOrbitRootPoints(asVec);
  return dense.map((p) => [p.x, p.y, p.z] as ScenePoint3);
}

/** @deprecated Use resolvePlanetOrbitSourcePoints */
export const ensurePlanetOrbitSourcePoints = resolvePlanetOrbitSourcePoints;
