import {
  buildBodyOrbitTrailSegments,
  canUseAnalyticBodyOrbit,
  findBodyOrbitAnchor,
  resolveTrailRenderMode,
} from "../../../coords/buildBodyOrbitTrail";
import type { BodyOrbitPath, Vector3 } from "../../../telemetry/schema-v6";
import type { MapContext } from "../../MapContext";
import {
  samplePositionsParentRelativeFromPath,
} from "./moonOrbitGeometry";

export type MoonOrbitGeometrySource = "analytic" | "samples";

export interface MoonOrbitSourceResult {
  points: Vector3[];
  source: MoonOrbitGeometrySource;
}

function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** Kepler ring in parent frame — fallback only when telemetry has fewer than 2 samples. */
export function analyticMoonOrbitParentRelativePoints(
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
  if (!anchor) {
    return null;
  }
  const analytic = buildBodyOrbitTrailSegments(path, anchor).flat();
  if (analytic.length < 3) {
    return null;
  }
  return analytic.map((p) => subtractVectors(p, anchor));
}

function bodyEntries(ctx: MapContext) {
  return ctx.bodies.map((b) => ({
    body: { name: b.name },
    position: b.position,
  }));
}

/**
 * Moon ring geometry — samples-first (same contract as heliocentric planets).
 * DLL: parent-relative at each sample UT via propagated getRelativePositionAtUT chain.
 */
export function resolveMoonOrbitSourcePoints(
  path: BodyOrbitPath,
  ctx: MapContext,
): MoonOrbitSourceResult {
  if (resolveTrailRenderMode(path) === "hidden") {
    return { points: [], source: "samples" };
  }

  const samples = samplePositionsParentRelativeFromPath(path, ctx);
  if (samples.length >= 2) {
    return { points: samples, source: "samples" };
  }

  const bodies = bodyEntries(ctx);
  const analytic = analyticMoonOrbitParentRelativePoints(
    path,
    bodies,
    ctx.rootBody,
  );
  if (analytic && analytic.length >= 2) {
    return { points: analytic, source: "analytic" };
  }

  return { points: [], source: "samples" };
}

/** True when the drawn trail uses Kepler analytic geometry (no sample polyline). */
export function moonOrbitTrailUsesAnalyticSource(
  path: BodyOrbitPath,
  ctx: MapContext,
): boolean {
  if (resolveTrailRenderMode(path) === "hidden") {
    return false;
  }
  if (samplePositionsParentRelativeFromPath(path, ctx).length >= 2) {
    return false;
  }
  return canUseAnalyticBodyOrbit(path);
}
