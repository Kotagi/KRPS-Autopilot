import type {
  BodyOrbitPath,
  BodyOrbitPathSample,
  BodyOrbitPathValidation,
  Vector3,
} from "../telemetry/schema-v6";
import type { OrbitElements } from "../telemetry/schema-v6";
import {
  conicToInertialSegments,
  perifocalToInertial,
  shouldSplitConicAtBodySurface,
} from "../math/buildConicGeometry";
import { finiteOr } from "../math/util";
import { translateReferenceInertialToRoot } from "./referenceBodyFrames";
import { BODY_ORBIT_TRAIL_PERIOD_VERTICES } from "../scene/densifyOrbitTrail";

/** REQ-001 / WP4: analytic only when live↔analytic ≤ 50 km. */
export const ANALYTIC_DISPLAY_THRESHOLD_METERS = 5e4;

export type TrailRenderMode = "samples" | "analytic" | "hidden";

function elementsFromPath(path: BodyOrbitPath): OrbitElements | null {
  const el = path.orbitElements;
  if (!el || el.eccentricity == null || !el.semiLatusRectumMeters) {
    return null;
  }
  return {
    referenceBody: el.referenceBody ?? path.referenceBody,
    classification: el.classification ?? path.classification,
    referenceBodyRadiusMeters: el.referenceBodyRadiusMeters,
    sphereOfInfluenceMeters: el.sphereOfInfluenceMeters,
    semiMajorAxisMeters: el.semiMajorAxisMeters,
    semiLatusRectumMeters: el.semiLatusRectumMeters,
    eccentricity: el.eccentricity,
    inclinationDegrees: el.inclinationDegrees,
    longitudeOfAscendingNodeDegrees: el.longitudeOfAscendingNodeDegrees,
    argumentOfPeriapsisDegrees: el.argumentOfPeriapsisDegrees,
    epochUniversalTimeSeconds: el.epochUniversalTimeSeconds,
    periodSeconds: el.periodSeconds,
    trueAnomalyDegreesAtCapture: el.trueAnomalyDegreesAtCapture,
    meanAnomalyRadiansAtCapture: el.meanAnomalyRadiansAtCapture,
  };
}

function startTrueAnomalyRadians(path: BodyOrbitPath): number {
  const degrees = path.orbitElements?.trueAnomalyDegreesAtCapture;
  if (degrees == null || !Number.isFinite(degrees)) {
    return 0;
  }
  return (degrees * Math.PI) / 180;
}

/** Match analytic ring phase to telemetry sample 0 (icon at capture UT). */
function startTrueAnomalyFromSample(
  path: BodyOrbitPath,
  anchor: Vector3 | null,
): number | null {
  const sample = path.samples?.[0]?.positionRootRelativeMeters;
  const elements = path.orbitElements;
  if (!sample || !anchor || !elements) {
    return null;
  }

  const eccentricity = finiteOr(elements.eccentricity, NaN);
  let semiLatusRectum = finiteOr(elements.semiLatusRectumMeters, NaN);
  if (!Number.isFinite(semiLatusRectum) || semiLatusRectum <= 0) {
    return null;
  }
  if (!Number.isFinite(eccentricity)) {
    return null;
  }

  let bestNu = startTrueAnomalyRadians(path);
  let bestDistSq = Infinity;
  const orbit = elementsFromPath(path);
  if (!orbit) {
    return null;
  }

  for (let i = 0; i < 360; i++) {
    const nu = (i / 360) * Math.PI * 2;
    const radius = semiLatusRectum / (1 + eccentricity * Math.cos(nu));
    const perifocal = {
      x: radius * Math.cos(nu),
      y: radius * Math.sin(nu),
      z: 0,
    };
    const inertial = perifocalToInertial(perifocal, orbit);
    const root = {
      x: anchor.x + inertial.x,
      y: anchor.y + inertial.y,
      z: anchor.z + inertial.z,
    };
    const dx = root.x - sample.x;
    const dy = root.y - sample.y;
    const dz = root.z - sample.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestNu = nu;
    }
  }

  return bestNu;
}

/** Root-frame trail segments from phase-aware Keplerian elements. */
export function buildBodyOrbitTrailSegments(
  path: BodyOrbitPath,
  anchor: Vector3 | null,
): Vector3[][] {
  const elements = elementsFromPath(path);
  if (!elements) {
    return [];
  }
  const classification = elements.classification ?? path.classification;
  if (classification !== "Elliptic" && classification !== "HyperbolicEscape") {
    return [];
  }
  const bodyRadius = finiteOr(elements.referenceBodyRadiusMeters, 1000);
  const splitAtSurface = shouldSplitConicAtBodySurface(classification);
  const phaseFromSample = startTrueAnomalyFromSample(path, anchor);
  const segments = conicToInertialSegments(elements, bodyRadius, splitAtSurface, {
    startTrueAnomalyRadians:
      phaseFromSample ?? startTrueAnomalyRadians(path),
    sampleCount: BODY_ORBIT_TRAIL_PERIOD_VERTICES,
  });
  return segments
    .filter((segment) => segment.length >= 2)
    .map((segment) => translateReferenceInertialToRoot(segment, anchor, true));
}

export function findBodyOrbitAnchor(
  path: BodyOrbitPath,
  bodies: { body: { name?: string }; position: Vector3 }[],
  rootBodyName: string | null | undefined,
  sample?: BodyOrbitPathSample | null,
): Vector3 | null {
  if (sample?.parentPositionRootRelativeMeters) {
    return sample.parentPositionRootRelativeMeters;
  }

  const refName = path.orbitElements?.referenceBody ?? path.referenceBody;
  if (!refName) {
    return null;
  }
  if (refName === rootBodyName) {
    return { x: 0, y: 0, z: 0 };
  }
  const entry = bodies.find((b) => b.body.name === refName);
  return entry?.position ?? null;
}

/** Max point distance between sampled and analytic trails (meters). */
export function maxTrailDeviationMeters(
  sampled: Vector3[],
  analytic: Vector3[],
): number {
  if (sampled.length === 0 || analytic.length === 0) {
    return 0;
  }
  let max = 0;
  sampled.forEach((p) => {
    analytic.forEach((q) => {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const dz = p.z - q.z;
      max = Math.max(max, Math.sqrt(dx * dx + dy * dy + dz * dz));
    });
  });
  return max;
}

export function canUseAnalyticBodyOrbit(path: BodyOrbitPath): boolean {
  const c = path.classification ?? path.orbitElements?.classification;
  return (
    !!path.orbitElements &&
    (c === "Elliptic" || c === "HyperbolicEscape")
  );
}

/** Prefer telemetry validation; fall back to client thresholds. */
export function resolveTrailRenderMode(
  path: BodyOrbitPath,
): TrailRenderMode {
  const mode = path.validation?.trailRenderMode;
  if (mode === "samples" || mode === "analytic" || mode === "hidden") {
    if (
      mode === "hidden" &&
      (path.samples?.length ?? 0) >= 2 &&
      path.validation?.liveToSample0Meters != null &&
      path.validation.liveToSample0Meters <= 1e3 &&
      (path.validation.maxSampleToTrailFrameMeters ??
        path.validation.maxSampleToTrueMeters ??
        0) <= 1e6
    ) {
      return "samples";
    }
    return mode;
  }

  const v = path.validation;
  if (
    v?.liveToAnalyticMeters != null &&
    v.liveToAnalyticMeters <= ANALYTIC_DISPLAY_THRESHOLD_METERS &&
    canUseAnalyticBodyOrbit(path)
  ) {
    return "analytic";
  }

  const sampleTrailResidual =
    v?.maxSampleToTrailFrameMeters ?? v?.maxSampleToTrueMeters;
  if (
    sampleTrailResidual != null &&
    sampleTrailResidual <= 1e6 &&
    v?.maxSampleToRecomputedMeters != null &&
    v.maxSampleToRecomputedMeters <= 1e6 &&
    v?.periodClosureMeters != null &&
    v.periodClosureMeters <= ANALYTIC_DISPLAY_THRESHOLD_METERS
  ) {
    return "samples";
  }

  if ((path.samples?.length ?? 0) >= 2 && path.validation?.trailRenderMode == null) {
    return "samples";
  }

  return "hidden";
}

export function formatTrailValidation(
  validation: BodyOrbitPathValidation | undefined,
): string {
  if (!validation) {
    return "—";
  }
  const parts: string[] = [];
  if (validation.liveToSample0Meters != null) {
    parts.push(`live↔s0 ${validation.liveToSample0Meters.toExponential(2)} m`);
  }
  if (validation.liveToAnalyticMeters != null) {
    parts.push(`live↔ana ${validation.liveToAnalyticMeters.toExponential(2)} m`);
  }
  if (validation.planeAngleToAnalyticDegrees != null) {
    parts.push(`plane ${validation.planeAngleToAnalyticDegrees.toFixed(2)}°`);
  }
  const sampleTrail =
    validation.maxSampleToTrailFrameMeters ?? validation.maxSampleToTrueMeters;
  if (sampleTrail != null) {
    parts.push(`sample↔trail ${sampleTrail.toExponential(2)} m`);
  }
  return parts.join("; ") || "—";
}
