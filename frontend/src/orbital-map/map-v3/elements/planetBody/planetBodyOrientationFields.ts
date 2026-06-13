import type { CelestialBody, Vector3 } from "../../../telemetry/schema-v6";
import type { KspRootQuaternion } from "../../../coords/kspBodyOrientation";
import {
  kspNorthPoleRootDirection,
  kspRootQuaternionFromAxisAngle,
  multiplyKspRootQuaternions,
  normalizeKspRootQuaternion,
  rotateKspRootVector,
} from "../../../coords/kspBodyOrientation";
import {
  resolveSiderealSpinRateRadPerSec,
  resolveTelemetrySpinAxisRootRelative,
} from "./planetBodySiderealSpin";

export {
  describeSiderealSpinAlignment,
  resolveSiderealSpinRateRadPerSec,
  resolveStockSiderealSpinRateRadPerSec,
  resolveTelemetrySpinAxisRootRelative,
} from "./planetBodySiderealSpin";

/** Telemetry orientation block (schema v10 — Phase 3.4). */
export interface PlanetBodyOrientationSnapshot {
  bodyOrientationReferenceFrame?: string;
  bodyOrientationSampleUniversalTimeSeconds?: number;
  rotates?: boolean;
  inverseRotation?: boolean;
  tidallyLocked?: boolean;
  rotationPeriodSeconds?: number;
  bodyOrientationRootRelative?: KspRootQuaternion;
  spinAxisRootRelative?: { x: number; y: number; z: number };
  angularVelocityRootRelativeRadPerSec?: { x: number; y: number; z: number };
  rotationAngleRadians?: number;
}

export type CelestialBodyWithOrientation = CelestialBody & PlanetBodyOrientationSnapshot;

export function isPlanetBodyOrientationReady(
  body: PlanetBodyOrientationSnapshot | undefined,
): body is PlanetBodyOrientationSnapshot & {
  bodyOrientationRootRelative: KspRootQuaternion;
} {
  const q = body?.bodyOrientationRootRelative;
  if (!q) {
    return false;
  }
  const len = Math.hypot(q.x, q.y, q.z, q.w);
  return Number.isFinite(len) && len > 0.01;
}

export function readPlanetBodyOrientation(
  body: CelestialBodyWithOrientation | undefined,
): KspRootQuaternion | undefined {
  if (!isPlanetBodyOrientationReady(body)) {
    return undefined;
  }
  return normalizeKspRootQuaternion(body.bodyOrientationRootRelative);
}

export function planetBodyAngularVelocity(
  body: CelestialBodyWithOrientation | undefined,
): Vector3 | undefined {
  return body?.angularVelocityRootRelativeRadPerSec;
}

export function planetBodyRotates(
  body: CelestialBodyWithOrientation | undefined,
): boolean {
  return body?.rotates !== false;
}

function normalizeRootVector(v: Vector3): Vector3 | undefined {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) {
    return undefined;
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Inertial spin axis ω̂ — telemetry angular velocity first (P3R-FR-05), then
 * published spin axis, then geographic north from the snapshot attitude.
 */
export function resolveSiderealSpinAxisRootRelative(
  body: CelestialBodyWithOrientation | undefined,
  orientationAtSample?: KspRootQuaternion,
): Vector3 | undefined {
  const av = body?.angularVelocityRootRelativeRadPerSec;
  if (av) {
    const axis = normalizeRootVector(av);
    if (axis) {
      return axis;
    }
  }

  const spinAxis = body?.spinAxisRootRelative;
  if (spinAxis) {
    const axis = normalizeRootVector(spinAxis);
    if (axis) {
      return axis;
    }
  }

  const q = orientationAtSample ?? readPlanetBodyOrientation(body);
  if (q) {
    return kspNorthPoleRootDirection(q);
  }

  return undefined;
}

/**
 * Signed sidereal angle for ΔUT from stock period sign (and ‖ω‖ when aligned).
 */
export function resolveSiderealSpinAngleRadians(
  body: CelestialBodyWithOrientation | undefined,
  deltaUtSeconds: number,
): number {
  const rate = resolveSiderealSpinRateRadPerSec(body);
  if (rate == null || !Number.isFinite(deltaUtSeconds)) {
    return 0;
  }
  return rate * deltaUtSeconds;
}

/**
 * Spin step about geographic north at the sample attitude (KSP local integration).
 * q(UT) = q_sample ⊗ q_delta(n̂, rate·ΔUT).
 */
export function resolveInertialNorthSpinDeltaQuaternion(
  body: CelestialBodyWithOrientation | undefined,
  orientationAtSample: KspRootQuaternion,
  deltaUtSeconds: number,
): KspRootQuaternion | undefined {
  if (!planetBodyRotates(body)) {
    return undefined;
  }

  const angle = resolveSiderealSpinAngleRadians(body, deltaUtSeconds);
  if (Math.abs(angle) < 1e-12) {
    return undefined;
  }

  const axis =
    resolveTelemetrySpinAxisRootRelative(body) ??
    kspNorthPoleRootDirection(orientationAtSample);
  const axisLen = Math.hypot(axis.x, axis.y, axis.z);
  if (axisLen < 1e-12) {
    return undefined;
  }

  return kspRootQuaternionFromAxisAngle(axis, angle);
}

/** @deprecated Use {@link resolveInertialNorthSpinDeltaQuaternion}. */
export function resolveBodyFixedSpinDeltaQuaternion(
  body: CelestialBodyWithOrientation | undefined,
  orientationAtSample: KspRootQuaternion,
  deltaUtSeconds: number,
): KspRootQuaternion | undefined {
  return resolveInertialNorthSpinDeltaQuaternion(
    body,
    orientationAtSample,
    deltaUtSeconds,
  );
}

/** @deprecated Use {@link resolveBodyFixedSpinDeltaQuaternion} — inertial ω̂ step kept for tests. */
export function resolveInertialSpinDeltaQuaternion(
  body: CelestialBodyWithOrientation | undefined,
  orientationAtSample: KspRootQuaternion,
  deltaUtSeconds: number,
): KspRootQuaternion | undefined {
  const axis = resolveSiderealSpinAxisRootRelative(body, orientationAtSample);
  if (!axis) {
    return undefined;
  }

  const angle = resolveSiderealSpinAngleRadians(body, deltaUtSeconds);
  if (Math.abs(angle) < 1e-12) {
    return undefined;
  }

  return kspRootQuaternionFromAxisAngle(axis, angle);
}

/** Max |ΔUT| (s) before applying rotationAngle extrapolation (scrub / time scrubber). */
const EXTRAPOLATE_SPIN_MAX_DELTA_UT_SECONDS = 0.05;

/**
 * Attitude at game UT. Live flight: sample UT = game UT → use DLL snapshot only (same as
 * texture lab `extrapolateSpin: false`). Scrub only: small extrapolation about north using
 * stock rotationPeriod sign.
 */
export function resolvePlanetBodyOrientationAtUt(
  body: CelestialBodyWithOrientation | undefined,
  gameUniversalTimeSeconds: number,
): KspRootQuaternion | undefined {
  const base = readPlanetBodyOrientation(body);
  if (!base) {
    return undefined;
  }
  if (!planetBodyRotates(body)) {
    return base;
  }

  const sampleUt = body?.bodyOrientationSampleUniversalTimeSeconds;
  if (
    sampleUt == null ||
    !Number.isFinite(gameUniversalTimeSeconds) ||
    !Number.isFinite(sampleUt)
  ) {
    return base;
  }

  const dt = gameUniversalTimeSeconds - sampleUt;
  if (Math.abs(dt) <= EXTRAPOLATE_SPIN_MAX_DELTA_UT_SECONDS) {
    return base;
  }

  const deltaQ = resolveInertialNorthSpinDeltaQuaternion(body, base, dt);
  if (!deltaQ) {
    return base;
  }

  return multiplyKspRootQuaternions(base, deltaQ);
}

/**
 * Rotate a body-fixed point to root inertial at resolved game UT (spin sign tests).
 */
export function rotateBodyFixedPointAtUt(
  body: CelestialBodyWithOrientation | undefined,
  bodyFixedPoint: Vector3,
  gameUniversalTimeSeconds: number,
): Vector3 | undefined {
  const q = resolvePlanetBodyOrientationAtUt(body, gameUniversalTimeSeconds);
  if (!q) {
    return undefined;
  }
  return rotateKspRootVector(q, bodyFixedPoint);
}

/** Geographic spin axis from attitude (R · north), preferred over raw ω for display. */
export function planetBodySpinAxis(
  body: CelestialBodyWithOrientation | undefined,
  orientationKsp?: KspRootQuaternion,
): Vector3 | undefined {
  if (orientationKsp) {
    const north = kspNorthPoleRootDirection(orientationKsp);
    const len = Math.hypot(north.x, north.y, north.z);
    if (len > 1e-12) {
      return { x: north.x / len, y: north.y / len, z: north.z / len };
    }
  }
  const axis = body?.spinAxisRootRelative;
  if (!axis) {
    return undefined;
  }
  const len = Math.hypot(axis.x, axis.y, axis.z);
  if (len < 1e-12) {
    return undefined;
  }
  return { x: axis.x / len, y: axis.y / len, z: axis.z / len };
}
