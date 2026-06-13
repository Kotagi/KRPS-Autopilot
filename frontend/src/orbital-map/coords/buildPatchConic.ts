import type { OrbitPatch, Vector3 } from "../telemetry/schema-v6";
import {
  conicToInertialSegments,
  inertialToPerifocal,
  perifocalToInertial,
  shouldSplitConicAtBodySurface,
} from "../math/buildConicGeometry";
import { findPatchRootAnchor } from "./patchAnchor";
import { distance3, maxConsecutiveLegMeters } from "../perf/pathSegments";
import { isRenderableVesselRootPath } from "../scene/vesselPathValidation";
import { finiteOr } from "../math/util";
import {
  rootRelativeToReferenceMathInertial,
  translateReferenceInertialToRoot,
} from "./referenceBodyFrames";
import type { BodyModel } from "../model/buildSolarSystemModel";

export type PatchConicDrawMode = "open" | "closed";

/** 3D map: math perifocal plane → KSP reference inertial (ecliptic in XZ). */
const PATCH_CONIC_KSP_AXIS_MAPPING = true;

const ELLIPTIC_RING_SAMPLES = 240;

function startTrueAnomalyRadians(patch: OrbitPatch): number {
  const degrees = patch.trueAnomalyDegrees;
  if (degrees == null || !Number.isFinite(degrees)) {
    return 0;
  }
  return (degrees * Math.PI) / 180;
}

export function trueAnomalyFromRootPosition(
  patch: OrbitPatch,
  anchor: Vector3 | null,
  targetRoot: Vector3,
): number | null {
  const mathInertial = rootRelativeToReferenceMathInertial(targetRoot, anchor);
  const perifocal = inertialToPerifocal(mathInertial, patch);
  if (!Number.isFinite(perifocal.x) || !Number.isFinite(perifocal.y)) {
    return null;
  }
  return Math.atan2(perifocal.y, perifocal.x);
}

function startTrueAnomalySearch(
  patch: OrbitPatch,
  anchor: Vector3 | null,
  targetRoot: Vector3,
): number | null {
  const eccentricity = finiteOr(patch.eccentricity, NaN);
  const semiLatusRectum = finiteOr(patch.semiLatusRectumMeters, NaN);
  if (
    !Number.isFinite(eccentricity) ||
    !Number.isFinite(semiLatusRectum) ||
    semiLatusRectum <= 0
  ) {
    return null;
  }

  const anchorVec = anchor ?? { x: 0, y: 0, z: 0 };
  let bestNu = startTrueAnomalyRadians(patch);
  let bestDistSq = Infinity;

  for (let i = 0; i < 720; i++) {
    const nu = (i / 720) * Math.PI * 2;
    const radius = semiLatusRectum / (1 + eccentricity * Math.cos(nu));
    const perifocal = {
      x: radius * Math.cos(nu),
      y: radius * Math.sin(nu),
      z: 0,
    };
    const inertial = perifocalToInertial(perifocal, patch);
    const root = translateReferenceInertialToRoot(
      [inertial],
      anchorVec,
      PATCH_CONIC_KSP_AXIS_MAPPING,
    )[0];
    const dx = root.x - targetRoot.x;
    const dy = root.y - targetRoot.y;
    const dz = root.z - targetRoot.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestNu = nu;
    }
  }

  return bestNu;
}

function resolveStartTrueAnomaly(
  patch: OrbitPatch,
  anchor: Vector3 | null,
  vesselRoot: Vector3,
): number {
  return (
    trueAnomalyFromRootPosition(patch, anchor, vesselRoot) ??
    startTrueAnomalySearch(patch, anchor, vesselRoot) ??
    startTrueAnomalyRadians(patch)
  );
}

function rootPointAtTrueAnomaly(
  patch: OrbitPatch,
  anchor: Vector3,
  nu: number,
): Vector3 {
  const eccentricity = finiteOr(patch.eccentricity, 0);
  const semiLatusRectum = finiteOr(patch.semiLatusRectumMeters, NaN);
  const radius = semiLatusRectum / (1 + eccentricity * Math.cos(nu));
  const perifocal = {
    x: radius * Math.cos(nu),
    y: radius * Math.sin(nu),
    z: 0,
  };
  const inertial = perifocalToInertial(perifocal, patch);
  return translateReferenceInertialToRoot(
    [inertial],
    anchor,
    PATCH_CONIC_KSP_AXIS_MAPPING,
  )[0];
}

/** Closed ellipse in root frame with index 0 at the vessel (smooth, no vertex snap). */
export function buildEllipticRingThroughVessel(
  patch: OrbitPatch,
  anchor: Vector3 | null,
  vesselRoot: Vector3,
): Vector3[] {
  const anchorVec = anchor ?? { x: 0, y: 0, z: 0 };
  const nu0 = resolveStartTrueAnomaly(patch, anchor, vesselRoot);
  const points: Vector3[] = [];

  for (let i = 0; i <= ELLIPTIC_RING_SAMPLES; i++) {
    const nu = nu0 + (2 * Math.PI * i) / ELLIPTIC_RING_SAMPLES;
    points.push(rootPointAtTrueAnomaly(patch, anchorVec, nu));
  }

  let nearest = 0;
  let nearestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = distance3(points[i], vesselRoot);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = i;
    }
  }

  return [...points.slice(nearest), ...points.slice(0, nearest)];
}

function isSupportedPatch(patch: OrbitPatch | null | undefined): boolean {
  return (
    patch?.classification === "Elliptic" ||
    patch?.classification === "HyperbolicEscape"
  );
}

const HELIOCENTRIC_ORBIT_RADIUS_METERS = 1e9;

/**
 * Patch used for the blue vessel orbit ring (not the yellow route overlay).
 * When the ship is heliocentric, prefer the Sun-centered elliptic leg in the chain
 * instead of patch 0 (often a SOI-local escape leg with a different anchor).
 */
export function resolveVesselOrbitDisplayPatch(
  patches: OrbitPatch[],
  vesselRoot: Vector3 | null,
): OrbitPatch | null {
  const supported = [...patches]
    .filter((p) => isSupportedPatch(p))
    .sort((a, b) => finiteOr(a.patchIndex, 0) - finiteOr(b.patchIndex, 0));
  if (supported.length === 0) {
    return null;
  }

  if (vesselRoot) {
    const radius = Math.hypot(vesselRoot.x, vesselRoot.y, vesselRoot.z);
    if (radius >= HELIOCENTRIC_ORBIT_RADIUS_METERS) {
      const sunElliptic = supported.find(
        (p) => p.referenceBody === "Sun" && p.classification === "Elliptic",
      );
      if (sunElliptic) {
        return sunElliptic;
      }
    }
  }

  const active = supported.find((p) => p.isActivePatch);
  return active ?? supported[0];
}

function placementPosition(
  patch: OrbitPatch,
  role: "patchStart" | "patchEnd" | "encounter",
): Vector3 | null {
  const sample = patch.placementSamples?.find((s) => s.sampleRole === role);
  return sample?.positionRootRelativeMeters ?? null;
}

function encounterPlacement(patch: OrbitPatch): Vector3 | null {
  return (
    placementPosition(patch, "encounter") ?? placementPosition(patch, "patchEnd")
  );
}

export interface ArcTimeContext {
  fromUniversalTimeSeconds?: number;
  toUniversalTimeSeconds?: number;
}

/** Prograde sweep from nu0 to nu1 when universal times are unavailable. */
function progradeTrueAnomalyDelta(nu0: number, nu1: number): number {
  let delta = nu1 - nu0;
  while (delta < 0) {
    delta += 2 * Math.PI;
  }
  while (delta >= 2 * Math.PI) {
    delta -= 2 * Math.PI;
  }
  if (Math.abs(delta) < 1e-6) {
    return Math.PI / 4;
  }
  return delta;
}

/** Forward-in-time sweep along the patch (matches KSP map prograde prediction). */
function forwardTrueAnomalyDelta(
  nu0: number,
  nu1: number,
  time: ArcTimeContext | undefined,
): number {
  const fromUt = time?.fromUniversalTimeSeconds;
  const toUt = time?.toUniversalTimeSeconds;
  if (
    fromUt == null ||
    toUt == null ||
    !Number.isFinite(fromUt) ||
    !Number.isFinite(toUt) ||
    toUt <= fromUt
  ) {
    return progradeTrueAnomalyDelta(nu0, nu1);
  }

  let delta = nu1 - nu0;
  while (delta < 0) {
    delta += 2 * Math.PI;
  }
  while (delta >= 2 * Math.PI) {
    delta -= 2 * Math.PI;
  }
  if (Math.abs(delta) < 1e-6) {
    return Math.PI / 4;
  }
  return delta;
}

/** If the placement search lands on the wrong branch, pick the shorter forward-time arc. */
function resolveArcTrueAnomalySweep(
  patch: OrbitPatch,
  anchor: Vector3,
  fromRoot: Vector3,
  toRoot: Vector3,
  time: ArcTimeContext | undefined,
): { nu0: number; delta: number } {
  const nu0 = resolveStartTrueAnomaly(patch, anchor, fromRoot);
  let nu1 = resolveStartTrueAnomaly(patch, anchor, toRoot);
  let delta = forwardTrueAnomalyDelta(nu0, nu1, time);

  if (delta > (3 * Math.PI) / 4) {
    const altNu1 = nu1 + Math.PI;
    const altDelta = forwardTrueAnomalyDelta(nu0, altNu1, time);
    if (altDelta < delta) {
      nu1 = altNu1;
      delta = altDelta;
    }
  }

  return { nu0, delta };
}

/** Partial ellipse arc between two root points (transfer leg, not a full period). */
export function buildEllipticArcBetweenRootPoints(
  patch: OrbitPatch,
  anchor: Vector3,
  fromRoot: Vector3,
  toRoot: Vector3,
  sampleCount = 120,
  time?: ArcTimeContext,
): Vector3[] {
  const { nu0, delta } = resolveArcTrueAnomalySweep(
    patch,
    anchor,
    fromRoot,
    toRoot,
    time,
  );

  const points: Vector3[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const nu = nu0 + (delta * i) / sampleCount;
    points.push(rootPointAtTrueAnomaly(patch, anchor, nu));
  }
  return points;
}

/** Patches to draw for KSP-style trajectory preview (current leg + post-encounter SOI). */
export function patchesForTrajectoryPreview(
  patches: OrbitPatch[],
): OrbitPatch[] {
  const supported = [...patches]
    .filter((p) => isSupportedPatch(p))
    .sort((a, b) => finiteOr(a.patchIndex, 0) - finiteOr(b.patchIndex, 0));
  if (supported.length === 0) {
    return [];
  }
  const first = supported[0];
  if (!first.encounterBody) {
    return supported.slice(0, 1);
  }
  return supported.slice(0, Math.min(2, supported.length));
}

function arcTimeContextForPatch(
  patch: OrbitPatch,
  gameUniversalTimeSeconds: number | undefined,
  toRole: "encounter" | "patchEnd" | "patchStart",
): ArcTimeContext | undefined {
  const fromUt =
    gameUniversalTimeSeconds ?? patch.patchStartUniversalTimeSeconds;
  let toUt: number | undefined;
  if (toRole === "encounter") {
    toUt = patch.closestEncounterUniversalTimeSeconds;
  } else if (toRole === "patchEnd") {
    toUt = patch.patchEndUniversalTimeSeconds;
  } else {
    toUt = patch.patchStartUniversalTimeSeconds;
  }
  if (fromUt == null || toUt == null) {
    return undefined;
  }
  return { fromUniversalTimeSeconds: fromUt, toUniversalTimeSeconds: toUt };
}

/**
 * Active-vessel orbit overlay (cyan): KSP stops at encounter on the current leg;
 * only draw a full period when there is no predicted encounter.
 */
export function buildActivePatchDisplaySegments(
  patch: OrbitPatch,
  anchor: Vector3 | null,
  vesselRoot: Vector3 | null,
  vesselPathPoints: Vector3[],
  gameUniversalTimeSeconds?: number,
): Vector3[][] {
  const anchorVec = anchor ?? { x: 0, y: 0, z: 0 };
  const encounter = patch.encounterBody ? encounterPlacement(patch) : null;

  if (
    patch.classification === "Elliptic" &&
    vesselRoot &&
    encounter &&
    patch.encounterBody
  ) {
    const arc = buildEllipticArcBetweenRootPoints(
      patch,
      anchorVec,
      vesselRoot,
      encounter,
      240,
      arcTimeContextForPatch(patch, gameUniversalTimeSeconds, "encounter"),
    );
    return [arc];
  }

  if (patch.classification === "Elliptic" && vesselRoot && !patch.encounterBody) {
    return [buildEllipticRingThroughVessel(patch, anchor, vesselRoot)];
  }

  if (
    vesselPathPoints.length >= 2 &&
    isRenderableVesselRootPath(vesselPathPoints)
  ) {
    return [vesselPathPoints];
  }

  if (!vesselRoot) {
    return buildActivePatchConicRootSegments(patch, anchor, null, "open");
  }

  return buildActivePatchConicRootSegments(patch, anchor, vesselRoot, "open");
}

/**
 * Yellow route overlay: only legs AFTER the displayed vessel patch.
 * Avoids Kerbin SOI arcs and full-period Sun ellipses on the current leg.
 */
export function buildFutureRoutePreviewSegments(
  displayPatch: OrbitPatch | null,
  patches: OrbitPatch[],
  bodyModels: BodyModel[],
  rootBodyName: string | null,
): Vector3[][] {
  if (!displayPatch) {
    return [];
  }

  const displayIndex = finiteOr(displayPatch.patchIndex, 0);
  const segments: Vector3[][] = [];

  [...patches]
    .filter((p) => isSupportedPatch(p))
    .filter((p) => finiteOr(p.patchIndex, 0) > displayIndex)
    .sort((a, b) => finiteOr(a.patchIndex, 0) - finiteOr(b.patchIndex, 0))
    .forEach((patch) => {
      const anchor = findPatchRootAnchor(patch, bodyModels, rootBodyName);
      if (!anchor) {
        return;
      }

      const patchStart = placementPosition(patch, "patchStart");
      const patchEnd = placementPosition(patch, "patchEnd");
      const time = arcTimeContextForPatch(patch, patch.patchStartUniversalTimeSeconds, "patchEnd");

      if (
        patch.classification === "Elliptic" &&
        patchStart &&
        patchEnd
      ) {
        segments.push(
          buildEllipticArcBetweenRootPoints(
            patch,
            anchor,
            patchStart,
            patchEnd,
            120,
            time,
          ),
        );
        return;
      }

      if (patchStart && patch.classification === "HyperbolicEscape") {
        const hyperbola = buildActivePatchConicRootSegments(
          patch,
          anchor,
          patchStart,
          "open",
        );
        segments.push(...hyperbola);
      }
    });

  return segments.filter((segment) => segment.length >= 2);
}

/** @deprecated Use buildActivePatchDisplaySegments + buildFutureRoutePreviewSegments */
export function buildTrajectoryPreviewSegments(
  patches: OrbitPatch[],
  bodyModels: BodyModel[],
  rootBodyName: string | null,
  vesselRoot: Vector3 | null,
  _vesselPathPoints: Vector3[],
): Vector3[][] {
  const displayPatch = resolveVesselOrbitDisplayPatch(patches, vesselRoot);
  const current = displayPatch
    ? buildActivePatchDisplaySegments(displayPatch, findPatchRootAnchor(displayPatch, bodyModels, rootBodyName), vesselRoot, [])
    : [];
  const future = buildFutureRoutePreviewSegments(
    displayPatch,
    patches,
    bodyModels,
    rootBodyName,
  );
  return [...current, ...future];
}

/** Hyperbolic / fallback analytic segments. */
export function buildActivePatchConicRootSegments(
  patch: OrbitPatch,
  anchor: Vector3 | null,
  alignToRoot: Vector3 | null = null,
  mode: PatchConicDrawMode = "open",
): Vector3[][] {
  const classification = patch.classification;
  if (classification !== "Elliptic" && classification !== "HyperbolicEscape") {
    return [];
  }

  if (classification === "Elliptic" && alignToRoot && mode === "closed") {
    return [buildEllipticRingThroughVessel(patch, anchor, alignToRoot)];
  }

  const bodyRadius = finiteOr(patch.referenceBodyRadiusMeters, 1000);
  const splitAtSurface = shouldSplitConicAtBodySurface(classification);
  const anchorVec = anchor ?? { x: 0, y: 0, z: 0 };

  let startNu = startTrueAnomalyRadians(patch);
  if (alignToRoot) {
    startNu = resolveStartTrueAnomaly(patch, anchor, alignToRoot);
  }

  const segments = conicToInertialSegments(patch, bodyRadius, splitAtSurface, {
    startTrueAnomalyRadians: startNu,
    sampleCount: ELLIPTIC_RING_SAMPLES,
  });

  return segments
    .filter((segment) => segment.length >= 2)
    .map((segment) =>
      translateReferenceInertialToRoot(
        segment,
        anchorVec,
        PATCH_CONIC_KSP_AXIS_MAPPING,
      ),
    );
}

/** Keep the vessel path leg that actually contains the ship (drops wedge chords). */
export function selectVesselPathLegContainingShip(
  points: Vector3[],
  vesselRoot: Vector3 | null,
  maxGapMeters = 5e10,
): Vector3[][] {
  if (points.length < 2) {
    return [];
  }
  if (!vesselRoot) {
    return [points];
  }

  const legs: Vector3[][] = [];
  let current: Vector3[] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const next = points[i];
    if (distance3(prev, next) > maxGapMeters) {
      if (current.length >= 2) {
        legs.push(current);
      }
      current = [next];
    } else {
      current.push(next);
    }
  }
  if (current.length >= 2) {
    legs.push(current);
  }

  const nearVessel = (leg: Vector3[]) =>
    leg.some((p) => distance3(p, vesselRoot) < 5e8);

  const viable = legs.filter((leg) => {
    if (!nearVessel(leg) || leg.length < 2) {
      return false;
    }
    const radii = leg.map((p) => Math.hypot(p.x, p.y, p.z));
    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    if (minR > 0 && maxR / minR > 200) {
      return false;
    }
    const maxLeg = maxConsecutiveLegMeters(leg);
    return maxLeg < maxR * 1.5;
  });

  if (viable.length === 0) {
    return [];
  }

  viable.sort((a, b) => b.length - a.length);
  return [viable[0]];
}
