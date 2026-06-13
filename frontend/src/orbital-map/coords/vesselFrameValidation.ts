import type { TelemetrySnapshot, Vector3 } from "../telemetry/schema-v6";
import {
  angleBetweenNormalsDegrees,
  planeNormalFromPolyline,
} from "./orbitPlaneValidation";

function distance3(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export interface VesselFrameValidationResult {
  ok: boolean;
  liveToPath0Meters: number | null;
  planeAngleDegrees: number | null;
  referenceBody: string | null;
  reasons: string[];
}

/** Mirrors scripts/verify-vessel-frame.ps1 for unit tests and offline checks. */
export function validateVesselFrameAlignment(
  telemetry: TelemetrySnapshot,
  options?: {
    maxLiveToPath0Meters?: number;
    maxPlaneAngleDegrees?: number;
  },
): VesselFrameValidationResult {
  const maxLiveToPath0Meters = options?.maxLiveToPath0Meters ?? 1;
  const maxPlaneAngleDegrees = options?.maxPlaneAngleDegrees ?? 5;
  const reasons: string[] = [];

  const vessel = telemetry.activeVessel;
  const refName = telemetry.orbit?.referenceBody ?? null;
  if (!vessel?.rootPathSamples || vessel.rootPathSamples.length < 2) {
    return {
      ok: true,
      liveToPath0Meters: null,
      planeAngleDegrees: null,
      referenceBody: refName,
      reasons: ["no vessel root path samples"],
    };
  }

  const refPath = telemetry.bodyOrbitPaths?.find((p) => p.bodyName === refName);
  if (!refPath?.samples || refPath.samples.length < 2) {
    return {
      ok: true,
      liveToPath0Meters: null,
      planeAngleDegrees: null,
      referenceBody: refName,
      reasons: ["no reference body orbit path"],
    };
  }

  const live = vessel.positionRootRelativeMeters;
  const path0 = vessel.rootPathSamples[0]?.positionRootRelativeMeters;
  const liveToPath0Meters =
    live && path0 ? distance3(live, path0) : null;

  const vesselPoints = vessel.rootPathSamples
    .map((s) => s.positionRootRelativeMeters)
    .filter((p): p is Vector3 => !!p);
  const refPoints = refPath.samples
    .map((s) => s.positionRootRelativeMeters)
    .filter((p): p is Vector3 => !!p);

  const vesselNormal = planeNormalFromPolyline(vesselPoints);
  const refNormal = planeNormalFromPolyline(refPoints);
  const planeAngleDegrees =
    vesselNormal && refNormal
      ? angleBetweenNormalsDegrees(vesselNormal, refNormal)
      : null;

  if (
    liveToPath0Meters != null &&
    liveToPath0Meters > maxLiveToPath0Meters
  ) {
    reasons.push(`liveToPath0=${liveToPath0Meters} m`);
  }
  if (
    planeAngleDegrees != null &&
    planeAngleDegrees > maxPlaneAngleDegrees
  ) {
    reasons.push(`planeAngle=${planeAngleDegrees} deg`);
  }

  return {
    ok: reasons.length === 0,
    liveToPath0Meters,
    planeAngleDegrees,
    referenceBody: refName,
    reasons,
  };
}
