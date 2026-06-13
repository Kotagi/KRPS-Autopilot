import type { OrbitPatch, Vector3 } from "../telemetry/schema-v6";
import type { BodyModel } from "../model/buildSolarSystemModel";

function distance3(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Root-frame origin for a patch conic: reference-body center at the patch epoch.
 * Conic points are in reference-body inertial frame; root = anchor + inertial.
 */
export function findPatchRootAnchor(
  patch: OrbitPatch,
  bodies: BodyModel[],
  rootBodyName: string | null | undefined,
): Vector3 | null {
  const refName = patch.referenceBody;
  const refEntry = refName ? bodies.find((b) => b.body.name === refName) : undefined;
  const refCurrent = refEntry?.position ?? null;

  const sampled = patch.referenceBodyPositionRootRelativeMeters;
  if (sampled) {
    if (
      refName &&
      refName === rootBodyName &&
      refCurrent &&
      distance3(sampled, refCurrent) > 5e10
    ) {
      return refCurrent;
    }
    return sampled;
  }

  if (refCurrent) {
    return refCurrent;
  }

  const samples = patch.placementSamples ?? [];
  for (const sample of samples) {
    if (
      sample.sampleRole === "patchStart" &&
      sample.targetBody === refName &&
      sample.positionRootRelativeMeters
    ) {
      return sample.positionRootRelativeMeters;
    }
  }

  return null;
}
