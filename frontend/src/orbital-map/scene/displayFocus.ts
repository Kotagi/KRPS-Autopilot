import type { SolarSystemModel } from "../model/buildSolarSystemModel";
import type { CameraMode } from "../store/viewStore";
import { getFocusPosition } from "../coords/worldShift";
import type { Vector3 } from "../telemetry/schema-v6";
import type { MoonVisibilityReason } from "./moonVisibility";

/** Focus for SOI / visibility detection (heliocentric; no host-planet shift). */
export function resolveSoiDetectionFocus(
  model: SolarSystemModel | null,
  focusBodyName: string | null,
  cameraMode: CameraMode,
): Vector3 | null {
  if (!model) {
    return null;
  }
  if (focusBodyName && cameraMode === "bodyFocus") {
    return getFocusPosition(model.bodies, focusBodyName);
  }
  if (cameraMode === "currentReferenceBody" && model.referenceBody) {
    return getFocusPosition(model.bodies, model.referenceBody);
  }
  if (cameraMode === "encounterBody" && model.encounterBody) {
    return getFocusPosition(model.bodies, model.encounterBody);
  }
  return null;
}

/**
 * World-shift for bodies/labels/moon trails: body focus or camera SOI zoom only.
 */
export function resolveDisplayFocus(
  model: SolarSystemModel | null,
  focusBodyName: string | null,
  cameraMode: CameraMode,
  activeHostPlanet: string | null,
  moonLodReason: MoonVisibilityReason,
): Vector3 | null {
  if (!model) {
    return null;
  }
  if (focusBodyName && cameraMode === "bodyFocus") {
    return getFocusPosition(model.bodies, focusBodyName);
  }
  const root = model.hierarchy?.rootBody ?? model.telemetry?.rootBody ?? "Sun";
  if (
    moonLodReason === "soiZoom" &&
    activeHostPlanet &&
    activeHostPlanet !== root
  ) {
    return getFocusPosition(model.bodies, activeHostPlanet);
  }
  return resolveSoiDetectionFocus(model, focusBodyName, cameraMode);
}

/** Patched-conic / vessel paths: shift only for explicit body focus or ref-camera modes. */
export function resolveTrajectoryFocus(
  model: SolarSystemModel | null,
  focusBodyName: string | null,
  cameraMode: CameraMode,
): Vector3 | null {
  if (!model) {
    return null;
  }
  if (focusBodyName && cameraMode === "bodyFocus") {
    return getFocusPosition(model.bodies, focusBodyName);
  }
  return resolveSoiDetectionFocus(model, focusBodyName, cameraMode);
}

export function moonParentSeparationMeters(
  model: SolarSystemModel | null,
  moonName: string,
  parentName: string,
): number | null {
  if (!model) {
    return null;
  }
  const moon = model.bodies.find((b) => b.body.name === moonName);
  const parent = model.bodies.find((b) => b.body.name === parentName);
  if (!moon || !parent) {
    return null;
  }
  const dx = moon.position.x - parent.position.x;
  const dy = moon.position.y - parent.position.y;
  const dz = moon.position.z - parent.position.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
