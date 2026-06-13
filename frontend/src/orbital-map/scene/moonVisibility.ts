import type { BodyHierarchy } from "../model/bodyHierarchy";
import { moonsOf } from "../model/bodyHierarchy";
import type { Vector3 } from "../telemetry/schema-v6";
import { applyWorldShift } from "../coords/worldShift";

export type MoonVisibilityReason =
  | "solar"
  | "soiZoom"
  | "bodyFocus"
  | "vesselSoi"
  | "selection";

export interface MoonVisibilityInput {
  hierarchy: BodyHierarchy;
  bodies: { body: { name?: string }; position: Vector3 }[];
  bodySoiMeters: Record<string, number>;
  displayScale: number;
  focus: Vector3 | null;
  cameraPosition: [number, number, number];
  cameraMode: string;
  focusBodyName: string | null;
  vesselReferenceBody: string | null;
  hoverBodyName: string | null;
  selectedBodyName: string | null;
  /** Previous host for hysteresis */
  previousHostPlanet: string | null;
}

export interface MoonVisibilityResult {
  visibleBodyNames: Set<string>;
  activeHostPlanet: string | null;
  reason: MoonVisibilityReason;
}

const SOI_ENTER_RATIO = 0.42;
const SOI_EXIT_RATIO = 0.52;

function scenePosition(
  position: Vector3,
  focus: Vector3 | null,
  displayScale: number,
): [number, number, number] {
  return applyWorldShift(position, focus, displayScale);
}

function distance3(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function hostFromBodyFocus(
  hierarchy: BodyHierarchy,
  focusBodyName: string | null,
): string | null {
  if (!focusBodyName) {
    return null;
  }
  return hierarchy.planetForBody[focusBodyName] ?? null;
}

function hostFromVessel(
  hierarchy: BodyHierarchy,
  vesselReferenceBody: string | null,
): string | null {
  if (!vesselReferenceBody) {
    return null;
  }
  return hierarchy.planetForBody[vesselReferenceBody] ?? null;
}

function hostFromSoiZoom(
  input: MoonVisibilityInput,
  enterRatio: number,
): string | null {
  const { hierarchy, bodies, bodySoiMeters, displayScale, focus, cameraPosition } =
    input;
  let best: { name: string; margin: number } | null = null;

  for (const planet of hierarchy.planetNames) {
    const soi = bodySoiMeters[planet];
    if (!soi || soi <= 0) {
      continue;
    }
    const entry = bodies.find((b) => b.body.name === planet);
    if (!entry) {
      continue;
    }
    const center = scenePosition(entry.position, focus, displayScale);
    const visualSoi = soi * displayScale;
    const dist = distance3(cameraPosition, center);
    const threshold = visualSoi * enterRatio;
    if (dist < threshold) {
      const margin = threshold - dist;
      if (!best || margin > best.margin) {
        best = { name: planet, margin };
      }
    }
  }

  return best?.name ?? null;
}

function stillInsideSoi(
  input: MoonVisibilityInput,
  hostPlanet: string,
  exitRatio: number,
): boolean {
  const soi = input.bodySoiMeters[hostPlanet];
  if (!soi || soi <= 0) {
    return false;
  }
  const entry = input.bodies.find((b) => b.body.name === hostPlanet);
  if (!entry) {
    return false;
  }
  const center = scenePosition(entry.position, input.focus, input.displayScale);
  const visualSoi = soi * input.displayScale;
  const dist = distance3(input.cameraPosition, center);
  return dist < visualSoi * exitRatio;
}

function hostFromSelection(
  hierarchy: BodyHierarchy,
  hoverBodyName: string | null,
  selectedBodyName: string | null,
): string | null {
  const name = selectedBodyName ?? hoverBodyName;
  if (!name) {
    return null;
  }
  return hierarchy.planetForBody[name] ?? null;
}

function buildVisibleSet(
  hierarchy: BodyHierarchy,
  hostPlanet: string | null,
): Set<string> {
  const visible = new Set<string>([hierarchy.rootBody]);
  hierarchy.planetNames.forEach((p) => visible.add(p));

  if (hostPlanet) {
    moonsOf(hierarchy, hostPlanet).forEach((m) => visible.add(m));
  }

  return visible;
}

export function resolveMoonVisibility(
  input: MoonVisibilityInput,
): MoonVisibilityResult {
  const { hierarchy, cameraMode, previousHostPlanet } = input;

  let host: string | null = null;
  let reason: MoonVisibilityReason = "solar";

  if (cameraMode === "bodyFocus") {
    host = hostFromBodyFocus(hierarchy, input.focusBodyName);
    if (host) {
      reason = "bodyFocus";
    }
  }

  if (!host) {
    const vesselHost = hostFromVessel(hierarchy, input.vesselReferenceBody);
    if (vesselHost) {
      host = vesselHost;
      reason = "vesselSoi";
    }
  }

  if (!host) {
    const selectionHost = hostFromSelection(
      hierarchy,
      input.hoverBodyName,
      input.selectedBodyName,
    );
    if (selectionHost) {
      host = selectionHost;
      reason = "selection";
    }
  }

  if (!host && previousHostPlanet && stillInsideSoi(input, previousHostPlanet, SOI_EXIT_RATIO)) {
    host = previousHostPlanet;
    reason = "soiZoom";
  }

  if (!host) {
    const zoomHost = hostFromSoiZoom(input, SOI_ENTER_RATIO);
    if (zoomHost) {
      host = zoomHost;
      reason = "soiZoom";
    }
  }

  const visibleBodyNames = buildVisibleSet(hierarchy, host);

  return {
    visibleBodyNames,
    activeHostPlanet: host,
    reason: host ? reason : "solar",
  };
}

export function formatMoonVisibilityDebug(result: MoonVisibilityResult): string {
  const host = result.activeHostPlanet ?? "—";
  const count = result.visibleBodyNames.size;
  return `Moon LOD: ${result.reason} | host=${host} | visible=${count}`;
}
