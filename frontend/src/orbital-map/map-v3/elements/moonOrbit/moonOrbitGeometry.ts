import type { BodyOrbitPath, Vector3 } from "../../../telemetry/schema-v6";
import type { MapContext } from "../../MapContext";
import {
  resolveMoonOrbitSourcePoints,
  type MoonOrbitGeometrySource,
} from "./resolveMoonOrbitSource";

function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** Parent root position at sample UT from the parent's own `bodyOrbitPaths` ring. */
export function parentRootPositionAtUniversalTime(
  parentPath: BodyOrbitPath,
  universalTimeSeconds: number,
): Vector3 | null {
  const samples = parentPath.samples ?? [];
  if (samples.length === 0) {
    return null;
  }

  let best: Vector3 | null = null;
  let bestDt = Infinity;
  for (const s of samples) {
    const t = s.sampleUniversalTimeSeconds;
    const pos = s.positionRootRelativeMeters;
    if (t == null || !pos || !Number.isFinite(pos.x)) {
      continue;
    }
    const dt = Math.abs(t - universalTimeSeconds);
    if (dt < bestDt) {
      bestDt = dt;
      best = pos;
    }
  }
  return best;
}

function parentPathForMoon(
  ctx: MapContext,
  path: BodyOrbitPath,
): BodyOrbitPath | undefined {
  const parentName =
    path.referenceBody ?? path.orbitElements?.referenceBody ?? undefined;
  if (!parentName || parentName === ctx.rootBody) {
    return undefined;
  }
  return (ctx.telemetry.bodyOrbitPaths ?? []).find(
    (p) => p.bodyName === parentName,
  );
}

/** Per-sample moon position in solar root frame (telemetry; diagnostics only). */
export function sampleRootPositionsFromMoonPath(path: BodyOrbitPath): Vector3[] {
  const points: Vector3[] = [];
  for (const s of path.samples ?? []) {
    const position = s.positionRootRelativeMeters;
    if (
      position
      && Number.isFinite(position.x)
      && Number.isFinite(position.y)
      && Number.isFinite(position.z)
    ) {
      points.push({ ...position });
    }
  }
  return points;
}

export { moonOrbitTrailUsesAnalyticSource } from "./resolveMoonOrbitSource";

/**
 * Moon trail vertices in parent-centered frame (pos − parent at each UT, or Kepler ring).
 */
export function resolveMoonOrbitParentRelativePointsFromPath(
  path: BodyOrbitPath,
  ctx: MapContext,
): Vector3[] {
  return resolveMoonOrbitSourcePoints(path, ctx).points;
}

export type { MoonOrbitGeometrySource };

/** @deprecated Use resolveMoonOrbitParentRelativePointsFromPath for rendering. */
export function resolveMoonOrbitRootPointsFromPath(
  path: BodyOrbitPath,
  ctx: MapContext,
): Vector3[] {
  return resolveMoonOrbitParentRelativePointsFromPath(path, ctx);
}

/**
 * Parent-relative offset at each sample UT.
 * Uses embedded `parentPositionRootRelativeMeters` when present; otherwise looks up
 * the parent planet's orbit path at the same UT (all ~128 DLL samples).
 */
export function samplePositionsParentRelativeFromPath(
  path: BodyOrbitPath,
  ctx: MapContext | null,
): Vector3[] {
  const parentPath = ctx ? parentPathForMoon(ctx, path) : undefined;

  const points: Vector3[] = [];
  for (const s of path.samples ?? []) {
    const position = s.positionRootRelativeMeters;
    if (!position || !Number.isFinite(position.x)) {
      continue;
    }

    let parent = s.parentPositionRootRelativeMeters;
    if (
      (!parent || !Number.isFinite(parent.x))
      && parentPath
      && s.sampleUniversalTimeSeconds != null
    ) {
      parent =
        parentRootPositionAtUniversalTime(
          parentPath,
          s.sampleUniversalTimeSeconds,
        ) ?? undefined;
    }
    if (!parent || !Number.isFinite(parent.x)) {
      continue;
    }
    points.push(subtractVectors(position, parent));
  }
  return points;
}

/** Live moon position relative to its reference parent (root meters). */
export function liveMoonParentRelativePosition(
  ctx: MapContext,
  moonName: string,
  parentName: string,
): Vector3 | null {
  const moon = ctx.bodyByName.get(moonName);
  const parent = ctx.bodyByName.get(parentName);
  if (!moon || !parent) {
    return null;
  }
  return subtractVectors(moon.position, parent.position);
}
