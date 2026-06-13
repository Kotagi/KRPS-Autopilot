import {
  conicToInertialSegments,
  shouldSplitConicAtBodySurface,
} from "../math/buildConicGeometry";
import { findPatchRootAnchor } from "../coords/patchAnchor";
import { translateReferenceInertialToRoot } from "../coords/referenceBodyFrames";
import { distance3 } from "../perf/pathSegments";
import { isRenderableVesselRootPath } from "../scene/vesselPathValidation";
import { finiteOr } from "../math/util";
import type {
  ActiveVessel,
  BodyOrbitPath,
  TelemetrySnapshot,
  Vector3,
  VesselRootPathSample,
} from "../telemetry/schema-v6";
import type { BodyModel } from "./buildSolarSystemModel";

const HELIOCENTRIC_RADIUS_METERS = 1e9;
const SOI_SCALE_RADIUS_METERS = 1e8;

function radiusMeters(p: Vector3): number {
  return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
}

function referenceRootAtUniversalTime(
  bodyOrbitPaths: BodyOrbitPath[] | undefined,
  refName: string,
  universalTime: number,
): Vector3 | null {
  const path = bodyOrbitPaths?.find((p) => p.bodyName === refName);
  const samples = path?.samples;
  if (!samples?.length) {
    return null;
  }

  let before = samples[0];
  let after = samples[samples.length - 1];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const ut = sample.sampleUniversalTimeSeconds;
    const pos = sample.positionRootRelativeMeters;
    if (ut == null || !pos) {
      continue;
    }
    if (ut <= universalTime) {
      before = sample;
    }
    if (ut >= universalTime) {
      after = sample;
      break;
    }
  }

  const p0 = before.positionRootRelativeMeters;
  const p1 = after.positionRootRelativeMeters;
  const t0 = before.sampleUniversalTimeSeconds;
  const t1 = after.sampleUniversalTimeSeconds;

  if (!p0) {
    return p1 ?? null;
  }
  if (!p1 || t0 == null || t1 == null || t0 === t1) {
    return p0;
  }

  const alpha = Math.max(0, Math.min(1, (universalTime - t0) / (t1 - t0)));
  return {
    x: p0.x + (p1.x - p0.x) * alpha,
    y: p0.y + (p1.y - p0.y) * alpha,
    z: p0.z + (p1.z - p0.z) * alpha,
  };
}

/** Add reference-body heliocentric position when samples are still in SOI-local frame. */
export function repairVesselRootPathSamples(
  telemetry: TelemetrySnapshot | null,
  samples: VesselRootPathSample[],
): Vector3[] {
  const activePatch = telemetry?.orbitPatches?.find((p) => p?.isActivePatch);
  const refName =
    activePatch?.referenceBody ??
    telemetry?.orbit?.referenceBody ??
    telemetry?.activeVessel?.mainBody ??
    null;

  const repaired: Vector3[] = [];

  for (const sample of samples) {
    const position = sample.positionRootRelativeMeters;
    if (!position) {
      continue;
    }

    if (radiusMeters(position) >= HELIOCENTRIC_RADIUS_METERS) {
      repaired.push(position);
      continue;
    }

    if (radiusMeters(position) > SOI_SCALE_RADIUS_METERS) {
      repaired.push(position);
      continue;
    }

    const ut = sample.sampleUniversalTimeSeconds;
    const refRoot =
      refName && ut != null
        ? referenceRootAtUniversalTime(telemetry?.bodyOrbitPaths, refName, ut)
        : null;

    if (!refRoot) {
      continue;
    }

    repaired.push({
      x: position.x + refRoot.x,
      y: position.y + refRoot.y,
      z: position.z + refRoot.z,
    });
  }

  return repaired;
}

export function buildVesselPathFromActivePatch(
  telemetry: TelemetrySnapshot | null,
  bodyModels: BodyModel[],
): Vector3[] {
  const patch = telemetry?.orbitPatches?.find((p) => p?.isActivePatch);
  if (!patch || !telemetry) {
    return [];
  }

  const refBody = telemetry.bodies?.find((b) => b.name === patch.referenceBody);
  const bodyRadius = finiteOr(
    patch.referenceBodyRadiusMeters ?? refBody?.radiusMeters,
    1000,
  );
  const segments = conicToInertialSegments(
    patch,
    bodyRadius,
    shouldSplitConicAtBodySurface(patch.classification),
  );
  const anchor = findPatchRootAnchor(patch, bodyModels, telemetry.rootBody ?? null);
  if (!anchor || segments.length === 0) {
    return [];
  }

  const points: Vector3[] = [];
  segments.forEach((segment) => {
    const rootPath = translateReferenceInertialToRoot(segment, anchor);
    rootPath.forEach((p, index) => {
      if (
        index === 0 &&
        points.length > 0 &&
        distance3(points[points.length - 1], p) < 1
      ) {
        return;
      }
      points.push(p);
    });
  });

  return points;
}

function appendLiveVesselPosition(
  points: Vector3[],
  vesselLive: Vector3 | undefined,
): Vector3[] {
  if (!vesselLive) {
    return points;
  }
  if (points.length === 0) {
    return [vesselLive];
  }

  const nearest = points.reduce(
    (best, p, i) => {
      const d = distance3(p, vesselLive);
      return d < best.d ? { d, i } : best;
    },
    { d: Infinity, i: 0 },
  );

  if (nearest.d > 1000) {
    const next = [...points];
    next.splice(nearest.i + 1, 0, vesselLive);
    return next;
  }

  return points;
}

/**
 * Prefer repaired telemetry samples; fall back to active-patch conic in root frame.
 */
export function resolveVesselPathPoints(
  telemetry: TelemetrySnapshot | null,
  vessel: ActiveVessel | undefined,
  bodyModels: BodyModel[],
): Vector3[] {
  const samples = vessel?.rootPathSamples ?? [];
  const raw: Vector3[] = [];
  samples.forEach((sample) => {
    if (sample?.positionRootRelativeMeters) {
      raw.push(sample.positionRootRelativeMeters);
    }
  });

  const repaired = repairVesselRootPathSamples(telemetry, samples);
  const vesselLive = vessel?.positionRootRelativeMeters;

  if (isRenderableVesselRootPath(repaired)) {
    return appendLiveVesselPosition(repaired, vesselLive);
  }

  const heliocentricOnly = repaired.filter(
    (p) => radiusMeters(p) >= HELIOCENTRIC_RADIUS_METERS,
  );
  if (isRenderableVesselRootPath(heliocentricOnly)) {
    return appendLiveVesselPosition(heliocentricOnly, vesselLive);
  }

  const fromPatch = buildVesselPathFromActivePatch(telemetry, bodyModels);
  if (fromPatch.length >= 2) {
    return appendLiveVesselPosition(fromPatch, vesselLive);
  }

  if (isRenderableVesselRootPath(raw)) {
    return appendLiveVesselPosition(raw, vesselLive);
  }

  return [];
}
