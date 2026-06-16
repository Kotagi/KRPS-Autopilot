import * as THREE from "three";
import type { Vector3 } from "../../../telemetry/schema-v6";
import type { KspRootQuaternion } from "../../../coords/kspBodyOrientation";
import {
  KSP_BODY_NORTH_LOCAL_THREE,
  kspMeshPoleOffsetQuaternion,
  kspNorthPoleRootDirection,
  kspRootQuaternionToThree,
  rotateKspRootVector,
} from "../../../coords/kspBodyOrientation";
import { resolveBodyTextureMirrorU } from "../../../assets/planetBodyTextures";
import type { CelestialBodyWithOrientation } from "./planetBodyOrientationFields";
import { readPlanetBodyOrientation } from "./planetBodyOrientationFields";

/** Body-fixed equator marker (prime meridian direction in KSP body frame). */
const MARKER_BODY_FIXED = { x: 1, y: 0, z: 0 };

export interface KerbinChiralitySample {
  gameUt: number;
  rotationAngleRadians: number;
  bodyOrientationRootRelative: KspRootQuaternion;
  spinAxisRootRelative?: Vector3;
  bodyTextureRevision?: string;
}

export type SpinChiralityVerdict =
  | "mesh-matches-ksp-rotation-angle"
  | "mesh-opposes-ksp-rotation-angle"
  | "telemetry-inconsistent"
  | "need-two-samples";

export interface SpinChiralityReport {
  uiVersion?: string;
  bodyName: string;
  earlierUt: number;
  laterUt: number;
  deltaUtSeconds: number;
  deltaRotationAngleRad: number;
  signRotationAngle: number;
  signQuaternionKspAboutNorth: number;
  telemetryQuaternionAgreesRotationAngle: boolean;
  /** Production mesh: pole −90° X, attitude, optional U-mirror. */
  production: {
    poleOffsetRadians: number;
    signEquatorCrossThree: number;
    agreesWithRotationAngle: boolean;
  };
  candidates: Array<{
    id: string;
    description: string;
    signEquatorCrossThree: number;
    agreesWithRotationAngle: boolean;
    /** If this matches what you see vs KSP map, apply this fix — not auto-applied. */
    suggestedExperiment: boolean;
  }>;
  textureExport: {
    bodyTextureMirrorU: boolean;
    revision?: string;
  };
  verdict: SpinChiralityVerdict;
  interpretation: string;
  userVerification: string[];
}

const MAX_SAMPLES = 12;
const kerbinSamples: KerbinChiralitySample[] = [];

function toKspQuat(q: KspRootQuaternion): THREE.Quaternion {
  return new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();
}

function normalizeRoot(v: Vector3): THREE.Vector3 {
  const vec = new THREE.Vector3(v.x, v.y, v.z);
  if (vec.lengthSq() < 1e-12) {
    return new THREE.Vector3(0, 1, 0);
  }
  return vec.normalize();
}

/**
 * Signed rotation angle (rad) from q0 → q1 about unit axis n (shortest path).
 */
export function signedSpinAboutAxis(
  q0: KspRootQuaternion,
  q1: KspRootQuaternion,
  axis: Vector3,
): number {
  const n = normalizeRoot(axis);
  const qa = toKspQuat(q0);
  const qb = toKspQuat(q1);
  const dq = qb.clone().multiply(qa.clone().invert());
  const angle = 2 * Math.acos(Math.max(-1, Math.min(1, dq.w)));
  const sinHalf = Math.sqrt(Math.max(0, 1 - dq.w * dq.w));
  if (sinHalf < 1e-9) {
    return 0;
  }
  const axisDq = new THREE.Vector3(dq.x / sinHalf, dq.y / sinHalf, dq.z / sinHalf);
  return angle * Math.sign(axisDq.dot(n));
}

function poleOffsetQuaternion(radians: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), radians);
}

/**
 * Sign of equator-marker motion in Three mesh space (production chain:
 * v' = Q_att · Q_pole · v_body).
 */
/** Sign of equator-marker motion about mesh north at t0 (production chain). */
export function meshEquatorCrossSignAboutMeshNorth(
  q0: KspRootQuaternion,
  q1: KspRootQuaternion,
  poleOffsetRadians: number,
): number {
  const pole = poleOffsetQuaternion(poleOffsetRadians);
  const t0 = kspRootQuaternionToThree(q0);
  const t1 = kspRootQuaternionToThree(q1);
  const m0 = new THREE.Vector3(1, 0, 0).applyQuaternion(pole).applyQuaternion(t0);
  const m1 = new THREE.Vector3(1, 0, 0).applyQuaternion(pole).applyQuaternion(t1);
  const north = KSP_BODY_NORTH_LOCAL_THREE.clone().applyQuaternion(t0);
  const cross = new THREE.Vector3().crossVectors(m0, m1);
  return Math.sign(cross.dot(north));
}

export function sampleFromKerbinBody(
  body: CelestialBodyWithOrientation | undefined,
  gameUt: number,
): KerbinChiralitySample | null {
  const q = readPlanetBodyOrientation(body);
  if (!q || body?.rotationAngleRadians == null) {
    return null;
  }
  return {
    gameUt,
    rotationAngleRadians: body.rotationAngleRadians,
    bodyOrientationRootRelative: q,
    spinAxisRootRelative: body.spinAxisRootRelative,
    bodyTextureRevision: body.bodyTextureRevision,
  };
}

export function recordKerbinChiralitySample(
  body: CelestialBodyWithOrientation | undefined,
  gameUt: number,
): KerbinChiralitySample | null {
  const sample = sampleFromKerbinBody(body, gameUt);
  if (!sample) {
    return null;
  }
  const last = kerbinSamples[kerbinSamples.length - 1];
  if (
    last &&
    last.gameUt === sample.gameUt &&
    last.rotationAngleRadians === sample.rotationAngleRadians
  ) {
    return sample;
  }
  kerbinSamples.push(sample);
  if (kerbinSamples.length > MAX_SAMPLES) {
    kerbinSamples.shift();
  }
  return sample;
}

export function getKerbinChiralitySampleCount(): number {
  return kerbinSamples.length;
}

export function clearKerbinChiralitySamples(): void {
  kerbinSamples.length = 0;
}

export function buildSpinChiralityReport(
  earlier: KerbinChiralitySample,
  later: KerbinChiralitySample,
  bodyName = "Earth",
): SpinChiralityReport {
  const deltaUtSeconds = later.gameUt - earlier.gameUt;
  const deltaRotationAngleRad =
    later.rotationAngleRadians - earlier.rotationAngleRadians;
  const signRotationAngle = Math.sign(deltaRotationAngleRad) || 0;

  const northKsp =
    earlier.spinAxisRootRelative ??
    kspNorthPoleRootDirection(earlier.bodyOrientationRootRelative);
  const signQuaternionKspAboutNorth = Math.sign(
    signedSpinAboutAxis(
      earlier.bodyOrientationRootRelative,
      later.bodyOrientationRootRelative,
      northKsp,
    ),
  );

  const telemetryQuaternionAgreesRotationAngle =
    signRotationAngle === 0 ||
    signQuaternionKspAboutNorth === 0 ||
    signRotationAngle === signQuaternionKspAboutNorth;

  const poleEuler = new THREE.Euler().setFromQuaternion(
    kspMeshPoleOffsetQuaternion(),
    "XYZ",
  );
  const poleProduction = poleEuler.x;
  const signProd = meshEquatorCrossSignAboutMeshNorth(
    earlier.bodyOrientationRootRelative,
    later.bodyOrientationRootRelative,
    poleProduction,
  );

  const signPolePlus90 = meshEquatorCrossSignAboutMeshNorth(
    earlier.bodyOrientationRootRelative,
    later.bodyOrientationRootRelative,
    Math.PI / 2,
  );

  const signNoPole = (() => {
    const t0 = kspRootQuaternionToThree(earlier.bodyOrientationRootRelative);
    const t1 = kspRootQuaternionToThree(later.bodyOrientationRootRelative);
    const m0 = new THREE.Vector3(1, 0, 0).applyQuaternion(t0);
    const m1 = new THREE.Vector3(1, 0, 0).applyQuaternion(t1);
    const north = KSP_BODY_NORTH_LOCAL_THREE.clone().applyQuaternion(t0);
    return Math.sign(new THREE.Vector3().crossVectors(m0, m1).dot(north));
  })();

  const textureMirrorU = resolveBodyTextureMirrorU(bodyName);

  const candidates = [
    {
      id: "production-v135",
      description: "Current mesh (Q_three, pole −90° X)",
      signEquatorCrossThree: signProd,
      agreesWithRotationAngle: signProd === signRotationAngle,
      suggestedExperiment: false,
    },
    {
      id: "pole-plus-90",
      description: "Same Q, pole +90° X instead of −90°",
      signEquatorCrossThree: signPolePlus90,
      agreesWithRotationAngle: signPolePlus90 === signRotationAngle,
      suggestedExperiment: signPolePlus90 === signRotationAngle && signProd !== signRotationAngle,
    },
    {
      id: "texture-mirror-u",
      description:
        "If production matches KSP math but map looks backward: flip apparent spin via BODY_TEXTURE_MIRROR_U (longitude may shift)",
      signEquatorCrossThree: textureMirrorU ? signProd : -signProd,
      agreesWithRotationAngle: textureMirrorU
        ? signProd === signRotationAngle
        : -signProd === signRotationAngle,
      suggestedExperiment:
        signProd === signRotationAngle && !textureMirrorU,
    },
    {
      id: "no-pole-offset",
      description: "Q_three only (no pole frame) — axis/UV diagnostic",
      signEquatorCrossThree: signNoPole,
      agreesWithRotationAngle: signNoPole === signRotationAngle,
      suggestedExperiment: false,
    },
  ];

  let verdict: SpinChiralityVerdict;
  let interpretation: string;

  if (!telemetryQuaternionAgreesRotationAngle) {
    verdict = "telemetry-inconsistent";
    interpretation =
      "DLL quaternion delta and rotationAngle disagree over this interval — fix telemetry before mesh spin sign.";
  } else if (signProd === signRotationAngle) {
    verdict = "mesh-matches-ksp-rotation-angle";
    interpretation =
      "Production mesh math spins the same way as KSP rotationAngle over this sample. If the tracking map still looks backward, the mismatch is likely texture/export chirality (try texture-mirror-u candidate), not the attitude quaternion.";
  } else {
    verdict = "mesh-opposes-ksp-rotation-angle";
    interpretation =
      "Production mesh equator motion opposes KSP rotationAngle over this sample — fix mesh/basis/pole pipeline (see pole-plus-90 candidate).";
  }

  const userVerification = [
    "1. Pick one obvious Kerbin surface feature (crater/coast) visible on BOTH the in-game tracking map and the web mesh.",
    "2. At 1× time warp off, watch that feature for ~30–60 s game time.",
    "3. Note: feature moves east/west on KSP map vs on web mesh (same direction or opposite?).",
    `4. Compare to this report: KSP rotationAngle sign=${signRotationAngle > 0 ? "+" : signRotationAngle < 0 ? "−" : "0"}, mesh production sign=${signProd > 0 ? "+" : signProd < 0 ? "−" : "0"}.`,
    verdict === "mesh-matches-ksp-rotation-angle"
      ? "5. If step 3 is OPPOSITE step 4, answer is texture chirality — run experiment texture-mirror-u."
      : "5. If step 3 matches step 4 but map differs, report back (unexpected).",
    "6. Paste this full console group or run KspSolarMap.runSpinChiralityDiagnostic() again after 2+ samples.",
  ];

  return {
    uiVersion:
      typeof window !== "undefined" ? window.KspSolarMapUiVersion : undefined,
    bodyName,
    earlierUt: earlier.gameUt,
    laterUt: later.gameUt,
    deltaUtSeconds,
    deltaRotationAngleRad,
    signRotationAngle,
    signQuaternionKspAboutNorth,
    telemetryQuaternionAgreesRotationAngle,
    production: {
      poleOffsetRadians: poleProduction,
      signEquatorCrossThree: signProd,
      agreesWithRotationAngle: signProd === signRotationAngle,
    },
    candidates,
    textureExport: {
      bodyTextureMirrorU: textureMirrorU,
      revision: later.bodyTextureRevision ?? earlier.bodyTextureRevision,
    },
    verdict,
    interpretation,
    userVerification,
  };
}

export function buildSpinChiralityReportFromBuffer(): SpinChiralityReport | null {
  if (kerbinSamples.length < 2) {
    return null;
  }
  const later = kerbinSamples[kerbinSamples.length - 1]!;
  const earlier = kerbinSamples[kerbinSamples.length - 2]!;
  return buildSpinChiralityReport(earlier, later);
}

export async function captureKerbinSamplesFromTelemetry(
  delayMs: number,
): Promise<KerbinChiralitySample[]> {
  const read = async (): Promise<KerbinChiralitySample | null> => {
    const res = await fetch("/api/map/telemetry");
    if (!res.ok) {
      throw new Error(`telemetry HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      bodies?: CelestialBodyWithOrientation[];
      gameUniversalTimeSeconds?: number;
    };
    const kerbin = data.bodies?.find((b) => b.name === "Kerbin");
    const ut = data.gameUniversalTimeSeconds ?? 0;
    return sampleFromKerbinBody(kerbin, ut);
  };

  const first = await read();
  if (!first) {
    throw new Error("Kerbin orientation not in telemetry");
  }
  await new Promise((r) => setTimeout(r, delayMs));
  const second = await read();
  if (!second) {
    throw new Error("Kerbin orientation not in telemetry (second sample)");
  }
  return [first, second];
}

export function logSpinChiralityReport(report: SpinChiralityReport): void {
  console.group(
    `[KspWebMap] spin chirality diagnostic Kerbin (UI ${report.uiVersion ?? "?"})`,
  );
  console.log("Interval", {
    earlierUt: report.earlierUt,
    laterUt: report.laterUt,
    deltaUtSeconds: report.deltaUtSeconds,
    deltaRotationAngleRad: report.deltaRotationAngleRad,
  });
  console.log("KSP telemetry signs", {
    rotationAngle: report.signRotationAngle,
    quaternionAboutNorth: report.signQuaternionKspAboutNorth,
    agree: report.telemetryQuaternionAgreesRotationAngle,
  });
  console.log("Production mesh (v135)", report.production);
  console.table(report.candidates);
  console.log("Texture", report.textureExport);
  console.log("Verdict", report.verdict);
  console.log("Interpretation", report.interpretation);
  console.log("Your verification checklist:");
  report.userVerification.forEach((line) => console.log(line));
  console.groupEnd();
}

export async function runSpinChiralityDiagnostic(options?: {
  /** Use buffered samples from “Collect” instead of fetching live. */
  useBuffer?: boolean;
  /** Wait between live samples (ms). Default 3000. */
  captureDelayMs?: number;
}): Promise<SpinChiralityReport | null> {
  let report: SpinChiralityReport | null = null;

  if (options?.useBuffer !== false && kerbinSamples.length >= 2) {
    report = buildSpinChiralityReportFromBuffer();
  }

  if (!report) {
    try {
      const [earlier, later] = await captureKerbinSamplesFromTelemetry(
        options?.captureDelayMs ?? 3000,
      );
      report = buildSpinChiralityReport(earlier, later);
    } catch (e) {
      console.warn(
        "[KspWebMap] spin chirality: need 2 Kerbin samples — enable Collect, wait ~1 s, or keep KSP running:",
        e instanceof Error ? e.message : e,
      );
      return null;
    }
  }

  if (report) {
    logSpinChiralityReport(report);
  }
  return report;
}

/** KSP root marker at sample (no Three) for cross-check. */
export function rootEquatorMarkerDirection(
  q: KspRootQuaternion,
): Vector3 {
  return rotateKspRootVector(q, MARKER_BODY_FIXED);
}

/** Expose production pole quat for tests. */
export function productionMeshPoleOffsetRadians(): number {
  const q = kspMeshPoleOffsetQuaternion();
  const e = new THREE.Euler().setFromQuaternion(q);
  return e.x;
}
