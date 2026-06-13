import * as THREE from "three";
import { kspRootQuaternionToThree } from "../../../coords/kspBodyOrientation";
import type { KspRootQuaternion } from "../../../coords/kspBodyOrientation";
import {
  readPlanetBodyOrientation,
  resolvePlanetBodyOrientationAtUt,
  resolveSiderealSpinAngleRadians,
  resolveSiderealSpinAxisRootRelative,
  rotateBodyFixedPointAtUt,
  type CelestialBodyWithOrientation,
} from "./planetBodyOrientationFields";
import {
  describeSiderealSpinAlignment,
  resolveSiderealSpinRateRadPerSec,
  resolveStockSiderealSpinRateRadPerSec,
  resolveTelemetrySpinAxisRootRelative,
} from "./planetBodySiderealSpin";

const MARKER_BODY_FIXED = { x: 1, y: 0, z: 0 };
const LOG_THROTTLE_MS = 2000;
const lastLogByBody = new Map<string, number>();

export interface PlanetBodySpinDiagnosticReport {
  bodyName: string;
  gameUt: number;
  sampleUt: number | undefined;
  deltaUtSeconds: number;
  rotates: boolean;
  inverseRotation: boolean | undefined;
  rotationPeriodSeconds: number | undefined;
  rotationAngleRadians: number | undefined;
  stockRateRadPerSec: number | undefined;
  resolvedRateRadPerSec: number | undefined;
  extrapolationMode: "snapshot-only" | "scrub-extrapolate";
  omegaDotSpinAxis: number | undefined;
  omegaAgreesWithStock: boolean | undefined;
  spinAxisRootRelative: { x: number; y: number; z: number } | undefined;
  angularVelocityRootRelativeRadPerSec:
    | { x: number; y: number; z: number }
    | undefined;
  snapshotQuaternion: KspRootQuaternion | undefined;
  resolvedQuaternion: KspRootQuaternion | undefined;
  extrapolationAngleRad: number;
  markerRootAtGameUt: { x: number; y: number; z: number } | undefined;
  markerThreeAtGameUt: { x: number; y: number; z: number } | undefined;
  markerRootAfterPlus1h: { x: number; y: number; z: number } | undefined;
  uiVersion?: string;
}

export function buildPlanetBodySpinDiagnosticReport(
  bodyName: string,
  body: CelestialBodyWithOrientation | undefined,
  gameUniversalTimeSeconds: number,
): PlanetBodySpinDiagnosticReport | null {
  if (!body) {
    return null;
  }

  const sampleUt = body.bodyOrientationSampleUniversalTimeSeconds;
  const deltaUtSeconds =
    sampleUt != null && Number.isFinite(gameUniversalTimeSeconds)
      ? gameUniversalTimeSeconds - sampleUt
      : 0;

  const snapshotQ = readPlanetBodyOrientation(body);
  const resolvedQ =
    resolvePlanetBodyOrientationAtUt(body, gameUniversalTimeSeconds) ??
    snapshotQ;

  const plus1h =
    sampleUt != null
      ? resolvePlanetBodyOrientationAtUt(body, gameUniversalTimeSeconds + 3600)
      : undefined;

  const align = describeSiderealSpinAlignment(body);
  const markerRoot = resolvedQ
    ? rotateBodyFixedPointAtUt(body, MARKER_BODY_FIXED, gameUniversalTimeSeconds)
    : undefined;

  let markerThree: { x: number; y: number; z: number } | undefined;
  if (markerRoot && resolvedQ) {
    const v = new THREE.Vector3(markerRoot.x, markerRoot.y, markerRoot.z).applyQuaternion(
      kspRootQuaternionToThree(resolvedQ),
    );
    markerThree = { x: v.x, y: v.y, z: v.z };
  }

  const markerPlus1h =
    plus1h && sampleUt != null
      ? rotateBodyFixedPointAtUt(
          body,
          MARKER_BODY_FIXED,
          gameUniversalTimeSeconds + 3600,
        )
      : undefined;

  return {
    bodyName,
    gameUt: gameUniversalTimeSeconds,
    sampleUt,
    deltaUtSeconds,
    rotates: body.rotates !== false,
    inverseRotation: body.inverseRotation,
    rotationPeriodSeconds: body.rotationPeriodSeconds,
    rotationAngleRadians: body.rotationAngleRadians,
    stockRateRadPerSec: resolveStockSiderealSpinRateRadPerSec(body),
    resolvedRateRadPerSec: resolveSiderealSpinRateRadPerSec(body),
    extrapolationMode:
      Math.abs(deltaUtSeconds) > 0.05 ? "scrub-extrapolate" : "snapshot-only",
    omegaDotSpinAxis: align.omegaDotSpinAxis,
    omegaAgreesWithStock: align.omegaAgreesWithStock,
    spinAxisRootRelative: body.spinAxisRootRelative,
    angularVelocityRootRelativeRadPerSec:
      body.angularVelocityRootRelativeRadPerSec,
    snapshotQuaternion: snapshotQ,
    resolvedQuaternion: resolvedQ,
    extrapolationAngleRad: resolveSiderealSpinAngleRadians(body, deltaUtSeconds),
    markerRootAtGameUt: markerRoot,
    markerThreeAtGameUt: markerThree,
    markerRootAfterPlus1h: markerPlus1h,
    uiVersion:
      typeof window !== "undefined"
        ? window.KspSolarMapUiVersion
        : undefined,
  };
}

function formatRate(r: number | undefined): string {
  if (r == null || !Number.isFinite(r)) {
    return "n/a";
  }
  return `${(r * 1e6).toFixed(3)} µrad/s (${(r * 86400).toFixed(4)} rad/day)`;
}

export function logPlanetBodySpinDiagnosticReport(
  report: PlanetBodySpinDiagnosticReport,
  options?: { force?: boolean },
): void {
  const key = report.bodyName;
  const now = Date.now();
  if (!options?.force) {
    const last = lastLogByBody.get(key) ?? 0;
    if (now - last < LOG_THROTTLE_MS) {
      return;
    }
  }
  lastLogByBody.set(key, now);

  console.group(
    `[KspWebMap] spin diag ${report.bodyName} (UI ${report.uiVersion ?? "?"})`,
  );
  console.log("UT", {
    game: report.gameUt,
    sample: report.sampleUt,
    deltaSeconds: report.deltaUtSeconds,
  });
  console.log("KSP stock", {
    rotationAngleRad: report.rotationAngleRadians,
    periodSec: report.rotationPeriodSeconds,
    inverseRotation: report.inverseRotation,
    stockRate: formatRate(report.stockRateRadPerSec),
  });
  console.log("Telemetry ω & n̂", {
    angularVelocity: report.angularVelocityRootRelativeRadPerSec,
    spinAxis: report.spinAxisRootRelative,
    omegaDotN: report.omegaDotSpinAxis,
    omegaAgreesWithPeriodSign: report.omegaAgreesWithStock,
  });
  console.log("Web attitude", {
    mode: report.extrapolationMode,
    resolvedRate: formatRate(report.resolvedRateRadPerSec),
    angleForDeltaUt: report.extrapolationAngleRad,
    scrubCompose: "q_sample ⊗ q_delta(n̂, stockRate·ΔUT)",
  });
  if (report.omegaAgreesWithStock === false) {
    console.warn(
      `${report.bodyName}: ω·n̂ sign ≠ rotationPeriod sign — live flight uses DLL snapshot only; scrub uses stock period sign`,
    );
  }
  console.log("Quaternions (root-relative)", {
    snapshot: report.snapshotQuaternion,
    resolved: report.resolvedQuaternion,
  });
  console.log("Equator marker (1,0,0) body-fixed", {
    rootAtGameUt: report.markerRootAtGameUt,
    threeAtGameUt: report.markerThreeAtGameUt,
    rootAtGameUtPlus1h: report.markerRootAfterPlus1h,
  });
  console.groupEnd();
}

/** Console helper: `KspSolarMap.logKerbinSpin()` while in flight. */
export function logKerbinSpinFromTelemetry(
  bodies: CelestialBodyWithOrientation[] | undefined,
  gameUniversalTimeSeconds: number,
): PlanetBodySpinDiagnosticReport | null {
  const kerbin = bodies?.find((b) => b.name === "Kerbin");
  const report = buildPlanetBodySpinDiagnosticReport(
    "Kerbin",
    kerbin,
    gameUniversalTimeSeconds,
  );
  if (report) {
    logPlanetBodySpinDiagnosticReport(report, { force: true });
  } else {
    console.warn("[KspWebMap] Kerbin not in telemetry bodies[]");
  }
  return report;
}

export function resolveSiderealSpinAxisForDiagnostics(
  body: CelestialBodyWithOrientation | undefined,
  orientationAtSample?: KspRootQuaternion,
): { x: number; y: number; z: number } | undefined {
  return (
    resolveTelemetrySpinAxisRootRelative(body) ??
    resolveSiderealSpinAxisRootRelative(body, orientationAtSample)
  );
}
