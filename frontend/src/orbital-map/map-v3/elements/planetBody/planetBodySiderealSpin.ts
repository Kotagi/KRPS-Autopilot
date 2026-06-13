import type { PlanetBodyOrientationSnapshot } from "./planetBodyOrientationFields";

export type CelestialBodyWithOrientation = PlanetBodyOrientationSnapshot & {
  name?: string;
};

function planetBodyRotates(body: CelestialBodyWithOrientation | undefined): boolean {
  return body?.rotates !== false;
}

const TWO_PI = 2 * Math.PI;

/**
 * Stock KSP sidereal rate from `rotationPeriod` / `inverseRotation` (same as
 * d(rotationAngle)/dt). This is the authoritative spin sign — not ‖ω‖ alone.
 */
export function resolveStockSiderealSpinRateRadPerSec(
  body: CelestialBodyWithOrientation | undefined,
): number | undefined {
  const period = body?.rotationPeriodSeconds;
  if (!period || period <= 0 || !planetBodyRotates(body)) {
    return undefined;
  }
  const sign = body?.inverseRotation === true ? -1 : 1;
  return sign * (TWO_PI / period);
}

/** Unit spin axis from telemetry `spinAxisRootRelative` (DLL: R·north). */
export function resolveTelemetrySpinAxisRootRelative(
  body: CelestialBodyWithOrientation | undefined,
): { x: number; y: number; z: number } | undefined {
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

/**
 * Rate used only when scrub UT ≠ sample UT. Live telemetry keeps sample UT = game UT,
 * so production mesh uses snapshot `body.rotation` only (see resolvePlanetBodyOrientationAtUt).
 */
export function resolveSiderealSpinRateRadPerSec(
  body: CelestialBodyWithOrientation | undefined,
): number | undefined {
  return resolveStockSiderealSpinRateRadPerSec(body);
}

/** Diagnostics for verify-telemetry / dev (ω·n̂ vs stock rate). */
export function describeSiderealSpinAlignment(
  body: CelestialBodyWithOrientation | undefined,
): {
  stockRateRadPerSec?: number;
  resolvedRateRadPerSec?: number;
  omegaDotSpinAxis?: number;
  omegaAgreesWithStock?: boolean;
} {
  const stockRate = resolveStockSiderealSpinRateRadPerSec(body);
  const resolvedRate = resolveSiderealSpinRateRadPerSec(body);
  const av = body?.angularVelocityRootRelativeRadPerSec;
  const axis = resolveTelemetrySpinAxisRootRelative(body);
  if (!av || !axis) {
    return {
      stockRateRadPerSec: stockRate,
      resolvedRateRadPerSec: resolvedRate,
    };
  }
  const avSpeed = Math.hypot(av.x, av.y, av.z);
  const omegaDot =
    avSpeed > 1e-12
      ? (av.x * axis.x + av.y * axis.y + av.z * axis.z) / avSpeed
      : undefined;
  return {
    stockRateRadPerSec: stockRate,
    resolvedRateRadPerSec: resolvedRate,
    omegaDotSpinAxis: omegaDot,
    omegaAgreesWithStock:
      stockRate == null || omegaDot == null
        ? undefined
        : (stockRate >= 0 ? 1 : -1) === (omegaDot >= 0 ? 1 : -1),
  };
}
