import type { RouteAnchor } from "../model/buildSolarSystemModel";
import { finiteOr } from "../math/util";
import type { Vector3 } from "../telemetry/schema-v6";

const ROOT_REFERENCE_ANCHOR_MAX_RADIUS_METERS = 1e8;

function radiusMeters(p: Vector3): number {
  return Math.hypot(p.x, p.y, p.z);
}

/**
 * Patch boundary samples at the solar-system origin (Sun as root) are frame
 * placeholders, not physical route waypoints — connecting them draws rays from the Sun.
 */
export function isDegenerateRouteAnchor(
  anchor: RouteAnchor,
  rootBodyName: string | null | undefined,
): boolean {
  const role = anchor.role ?? anchor.sample?.sampleRole ?? "";
  if (role !== "patchStart" && role !== "patchEnd") {
    return false;
  }

  const refName = anchor.patch.referenceBody ?? anchor.targetBody;
  if (!refName || refName !== rootBodyName) {
    return false;
  }

  return radiusMeters(anchor.position) <= ROOT_REFERENCE_ANCHOR_MAX_RADIUS_METERS;
}

/** Per-patch polylines for approximate routes (no cross-patch chords). */
export function buildRouteChordSegments(
  routeAnchors: RouteAnchor[],
  rootBodyName: string | null | undefined,
): Vector3[][] {
  const byPatch = new Map<number, RouteAnchor[]>();

  routeAnchors.forEach((anchor) => {
    if (isDegenerateRouteAnchor(anchor, rootBodyName)) {
      return;
    }
    const patchIndex = finiteOr(anchor.patch.patchIndex, 0);
    const group = byPatch.get(patchIndex) ?? [];
    group.push(anchor);
    byPatch.set(patchIndex, group);
  });

  const segments: Vector3[][] = [];
  [...byPatch.values()].forEach((group) => {
    group.sort(
      (a, b) =>
        finiteOr(a.sampleUniversalTimeSeconds, 0) -
        finiteOr(b.sampleUniversalTimeSeconds, 0),
    );
    if (group.length >= 2) {
      segments.push(group.map((anchor) => anchor.position));
    }
  });

  return segments;
}
