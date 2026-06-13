import type { BodyOrbitPath, Vector3 } from "../telemetry/schema-v6";
import {
  buildBodyOrbitTrailSegments,
  canUseAnalyticBodyOrbit,
  findBodyOrbitAnchor,
  resolveTrailRenderMode,
} from "../coords/buildBodyOrbitTrail";
import {
  buildActivePatchDisplaySegments,
  buildFutureRoutePreviewSegments,
  resolveVesselOrbitDisplayPatch,
} from "../coords/buildPatchConic";
import { findPatchRootAnchor } from "../coords/patchAnchor";
import type { BodyModel } from "../model/buildSolarSystemModel";
import { getKspBodyMapColor } from "../scene/bodyMapColors";
import type { MapContext } from "./MapContext";
import { isMoonBody as ctxIsMoon, isPlanetBody, starBody } from "./MapContext";
import { decimateRootTrail, sanitizeRootPoints } from "./trailSafety";
import type { TrajectoryRole, TrajectorySegment } from "./types";

export interface PlannerFilter {
  /** When set, only paths for these body names. */
  bodyNames?: Set<string>;
  planetOnly?: boolean;
  moonOnly?: boolean;
}

function toBodyModels(ctx: MapContext): BodyModel[] {
  return ctx.bodies.map((b) => ({
    body: b.body,
    position: b.position,
    projected: { x: b.position.x, y: b.position.z },
    isScrubPreview: false,
  }));
}

function nearestIndex(points: Vector3[], target: Vector3): number {
  let best = 0;
  let bestDist = Infinity;
  points.forEach((p, i) => {
    const dx = p.x - target.x;
    const dy = p.y - target.y;
    const dz = p.z - target.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

function pathMatchesFilter(
  ctx: MapContext,
  path: BodyOrbitPath,
  filter?: PlannerFilter,
): boolean {
  const name = path.bodyName;
  if (!name) {
    return false;
  }
  if (filter?.bodyNames && !filter.bodyNames.has(name)) {
    return false;
  }
  if (filter?.planetOnly && !isPlanetBody(ctx, name)) {
    return false;
  }
  if (filter?.moonOnly && !ctxIsMoon(ctx, name)) {
    return false;
  }
  return true;
}

function bodyOrbitSegmentsForPath(
  ctx: MapContext,
  path: BodyOrbitPath,
): { points: Vector3[]; closed: boolean; anchorIndex: number } | null {
  try {
    if (resolveTrailRenderMode(path) === "hidden") {
      return null;
    }

    const bodies = ctx.bodies.map((b) => ({
      body: { name: b.name },
      position: b.position,
    }));
    const sample0 = path.samples?.[0] ?? null;
    const anchor = findBodyOrbitAnchor(
      path,
      bodies,
      ctx.rootBody,
      sample0,
    );

    // Match v1 BodyOrbitsLayer: prefer telemetry samples; analytic only as fallback.
    let points = sanitizeRootPoints(
      (path.samples ?? [])
        .map((s) => s.positionRootRelativeMeters)
        .filter((p): p is Vector3 => p != null),
    );

    if (points.length < 2 && canUseAnalyticBodyOrbit(path)) {
      const segs = buildBodyOrbitTrailSegments(path, anchor);
      points = sanitizeRootPoints(segs.flat());
    }

    if (points.length < 2) {
      return null;
    }

    points = decimateRootTrail(points);

    const bodyEntry = path.bodyName ? ctx.bodyByName.get(path.bodyName) : null;
    const anchorIndex = bodyEntry
      ? nearestIndex(points, bodyEntry.position)
      : 0;

    const closed =
      points.length > 2 &&
      Math.hypot(
        points[0].x - points[points.length - 1].x,
        points[0].y - points[points.length - 1].y,
        points[0].z - points[points.length - 1].z,
      ) < 1e3;

    return {
      points,
      closed,
      anchorIndex,
    };
  } catch {
    return null;
  }
}

export function buildSegments(
  ctx: MapContext,
  role: TrajectoryRole,
  filter?: PlannerFilter,
): TrajectorySegment[] {
  switch (role) {
    case "StarMarker":
      return buildStarMarker(ctx);
    case "BodyOrbit":
      return buildBodyOrbits(ctx, filter);
    case "BodyPosition":
      return buildBodyPositions(ctx, filter);
    case "VesselPosition":
      return buildVesselPosition(ctx);
    case "ActiveVesselLeg":
      return buildActiveVesselLeg(ctx);
    case "FutureRouteLeg":
      return buildFutureRoute(ctx);
    case "SoiRing":
      return buildSoiRings(ctx, filter);
    case "BodyLabel":
      return buildBodyLabels(ctx, filter);
    default:
      return [];
  }
}

function buildStarMarker(ctx: MapContext): TrajectorySegment[] {
  const star = starBody(ctx);
  if (!star) {
    return [];
  }
  return [
    {
      role: "StarMarker",
      key: `star-${star.name}`,
      points: [star.position],
      bodyName: star.name,
    },
  ];
}

function buildBodyOrbits(
  ctx: MapContext,
  filter?: PlannerFilter,
): TrajectorySegment[] {
  const paths = ctx.telemetry.bodyOrbitPaths ?? [];
  const segments: TrajectorySegment[] = [];

  paths.forEach((path, index) => {
    if (!pathMatchesFilter(ctx, path, filter)) {
      return;
    }
    const ref = path.referenceBody ?? path.orbitElements?.referenceBody;
    if (filter?.planetOnly && ref !== ctx.rootBody) {
      return;
    }
    if (filter?.moonOnly && ref === ctx.rootBody) {
      return;
    }

    const trail = bodyOrbitSegmentsForPath(ctx, path);
    if (!trail) {
      return;
    }

    const parentBody =
      ref && ref !== ctx.rootBody ? ref : undefined;

    segments.push({
      role: "BodyOrbit",
      key: `orbit-${path.bodyName ?? index}`,
      points: trail.points,
      bodyName: path.bodyName,
      referenceBody: ref ?? undefined,
      parentBody,
      closed: trail.closed,
      anchorIndex: trail.anchorIndex,
      closedWithDuplicateEndpoint: false,
    });
  });

  return segments;
}

function buildBodyPositions(
  ctx: MapContext,
  filter?: PlannerFilter,
): TrajectorySegment[] {
  return ctx.bodies
    .filter((b) => {
      if (b.name === ctx.rootBody) {
        return false;
      }
      if (filter?.planetOnly && !isPlanetBody(ctx, b.name)) {
        return false;
      }
      if (filter?.moonOnly && !ctxIsMoon(ctx, b.name)) {
        return false;
      }
      if (filter?.bodyNames && !filter.bodyNames.has(b.name)) {
        return false;
      }
      return true;
    })
    .map((b) => ({
      role: "BodyPosition" as const,
      key: `body-pos-${b.name}`,
      points: [b.position],
      bodyName: b.name,
      parentBody: ctx.hierarchy.planetForBody[b.name],
    }));
}

function buildVesselPosition(ctx: MapContext): TrajectorySegment[] {
  const vessel = ctx.telemetry.activeVessel;
  const pos = vessel?.positionRootRelativeMeters;
  if (!pos || !vessel?.id) {
    return [];
  }
  return [
    {
      role: "VesselPosition",
      key: `vessel-${vessel.id}`,
      points: [pos],
      bodyName: vessel.name,
      color: "#00e5ff",
    },
  ];
}

function buildActiveVesselLeg(ctx: MapContext): TrajectorySegment[] {
  try {
    const patches = ctx.telemetry.orbitPatches ?? [];
    const vessel = ctx.telemetry.activeVessel;
    const vesselRoot = vessel?.positionRootRelativeMeters ?? null;
    const displayPatch = resolveVesselOrbitDisplayPatch(patches, vesselRoot);
    if (!displayPatch) {
      return [];
    }

    const bodyModels = toBodyModels(ctx);
    const anchor = findPatchRootAnchor(
      displayPatch,
      bodyModels,
      ctx.rootBody,
    );
    const vesselPath = (ctx.telemetry.activeVessel?.rootPathSamples ?? [])
      .map((s) => s.positionRootRelativeMeters)
      .filter((p): p is Vector3 => p != null);

    const legSegments = buildActivePatchDisplaySegments(
      displayPatch,
      anchor,
      vesselRoot,
      vesselPath,
      ctx.gameUniversalTimeSeconds,
    );

    return legSegments
      .filter((pts) => pts.length >= 2)
      .map((pts, i) => ({
        role: "ActiveVesselLeg" as const,
        key: `vessel-leg-${displayPatch.patchIndex ?? i}`,
        points: decimateRootTrail(sanitizeRootPoints(pts)),
        referenceBody: displayPatch.referenceBody,
        color: "#00e5ff",
        lineWidth: 2,
      }));
  } catch {
    return [];
  }
}

function buildFutureRoute(ctx: MapContext): TrajectorySegment[] {
  try {
    const patches = ctx.telemetry.orbitPatches ?? [];
    const vessel = ctx.telemetry.activeVessel;
    const vesselRoot = vessel?.positionRootRelativeMeters ?? null;
    const displayPatch = resolveVesselOrbitDisplayPatch(patches, vesselRoot);
    const bodyModels = toBodyModels(ctx);
    const segments = buildFutureRoutePreviewSegments(
      displayPatch,
      patches,
      bodyModels,
      ctx.rootBody,
    );

    return segments
      .filter((pts) => pts.length >= 2)
      .map((pts, i) => ({
        role: "FutureRouteLeg" as const,
        key: `future-route-${i}`,
        points: decimateRootTrail(sanitizeRootPoints(pts)),
        color: "#ffeb3b",
        opacity: 0.85,
        dashed: true,
        lineWidth: 1.5,
      }));
  } catch {
    return [];
  }
}

function buildSoiRings(
  ctx: MapContext,
  filter?: PlannerFilter,
): TrajectorySegment[] {
  return ctx.bodies
    .filter((b) => {
      if (b.soiMeters <= 0) {
        return false;
      }
      if (filter?.bodyNames && !filter.bodyNames.has(b.name)) {
        return false;
      }
      if (filter?.moonOnly && !ctxIsMoon(ctx, b.name)) {
        return false;
      }
      return true;
    })
    .map((b) => ({
      role: "SoiRing" as const,
      key: `soi-${b.name}`,
      points: [b.position],
      bodyName: b.name,
      referenceBody: String(b.soiMeters),
    }));
}

function buildBodyLabels(
  ctx: MapContext,
  filter?: PlannerFilter,
): TrajectorySegment[] {
  return buildBodyPositions(ctx, filter).map((seg) => ({
    ...seg,
    role: "BodyLabel" as const,
    key: `label-${seg.bodyName}`,
    color: getKspBodyMapColor(seg.bodyName),
  }));
}

/** All roles for a frame (used by tests). */
export function buildAllSegments(
  ctx: MapContext,
  visibleMoonNames?: Set<string>,
): TrajectorySegment[] {
  const moonFilter: PlannerFilter | undefined = visibleMoonNames
    ? { moonOnly: true, bodyNames: visibleMoonNames }
    : { moonOnly: true };

  return [
    ...buildSegments(ctx, "StarMarker"),
    ...buildSegments(ctx, "BodyOrbit", { planetOnly: true }),
    ...buildSegments(ctx, "BodyOrbit", moonFilter),
    ...buildSegments(ctx, "BodyPosition", { planetOnly: true }),
    ...buildSegments(ctx, "BodyPosition", moonFilter),
    ...buildSegments(ctx, "VesselPosition"),
    ...buildSegments(ctx, "ActiveVesselLeg"),
    ...buildSegments(ctx, "FutureRouteLeg"),
  ];
}
