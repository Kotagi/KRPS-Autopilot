import type { Vector3 } from "../telemetry/schema-v6";

/**
 * Standard perifocal→inertial math uses orbital plane in XY with normal +Z.
 * KSP referenceBodyCenteredInertial uses north +Y with equator in XZ.
 */
export function orbitalMathInertialToKspReferenceBody(inertial: Vector3): Vector3 {
  return {
    x: inertial.x,
    y: inertial.z,
    z: inertial.y,
  };
}

/** Inverse of {@link orbitalMathInertialToKspReferenceBody}. */
export function kspReferenceBodyToMathInertial(local: Vector3): Vector3 {
  return {
    x: local.x,
    y: local.z,
    z: local.y,
  };
}

/** Root-relative meters → reference-body math inertial (before perifocal rotation). */
export function rootRelativeToReferenceMathInertial(
  root: Vector3,
  anchorRootRelative: Vector3 | null,
): Vector3 {
  const local: Vector3 = anchorRootRelative
    ? {
        x: root.x - anchorRootRelative.x,
        y: root.y - anchorRootRelative.y,
        z: root.z - anchorRootRelative.z,
      }
    : root;
  return kspReferenceBodyToMathInertial(local);
}

/**
 * Place reference-body inertial conic points into the solar root frame.
 * Universe inertial axes are shared; only origin differs, so root = anchor + local.
 */
/**
 * @param kspAxisMapping When true (default), map math inertial (+Z normal) to KSP (+Y north).
 * Body orbit trails use KSP axis mapping (math +Z → KSP +Y) when placing analytic rings.
 */
export function translateReferenceInertialToRoot(
  inertialPoints: Vector3[],
  anchorRootRelative: Vector3 | null,
  kspAxisMapping = true,
): Vector3[] {
  return inertialPoints.map((point) => {
    const local = kspAxisMapping
      ? orbitalMathInertialToKspReferenceBody(point)
      : point;
    if (!anchorRootRelative) {
      return local;
    }
    return {
      x: anchorRootRelative.x + local.x,
      y: anchorRootRelative.y + local.y,
      z: anchorRootRelative.z + local.z,
    };
  });
}
