import type { BodyHierarchy } from "../model/bodyHierarchy";
import { isMoon } from "../model/bodyHierarchy";

const SUN_MIN_MESH_RADIUS = 2;
const PLANET_SOLAR_MIN_MESH_RADIUS = 0.05;
const MIN_PICK_RADIUS = 0.08;
const MOON_PICK_RADIUS = 0.06;

export interface BodyVisualScaleInput {
  bodyName: string;
  radiusMeters: number;
  displayScale: number;
  hierarchy: BodyHierarchy;
  hostPlanetOpen: boolean;
}

export function bodyMeshRadius(input: BodyVisualScaleInput): number {
  const { bodyName, radiusMeters, displayScale, hierarchy, hostPlanetOpen } =
    input;
  const physical = Math.max(radiusMeters, 1000) * displayScale;

  if (bodyName === hierarchy.rootBody || bodyName === "Sun") {
    return Math.max(physical, SUN_MIN_MESH_RADIUS);
  }

  if (isMoon(hierarchy, bodyName)) {
    return physical;
  }

  if (!hostPlanetOpen) {
    return Math.max(physical, PLANET_SOLAR_MIN_MESH_RADIUS);
  }

  return physical;
}

export function bodyPickRadius(input: BodyVisualScaleInput): number {
  const mesh = bodyMeshRadius(input);
  if (isMoon(input.hierarchy, input.bodyName)) {
    return Math.max(mesh, MOON_PICK_RADIUS);
  }
  return Math.max(mesh, MIN_PICK_RADIUS);
}

export function moonLabelOffset(
  moonPos: [number, number, number],
  parentPos: [number, number, number],
  meshRadius: number,
  labelPad = 0.35,
): [number, number, number] {
  const dx = moonPos[0] - parentPos[0];
  const dy = moonPos[1] - parentPos[1];
  const dz = moonPos[2] - parentPos[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) {
    return [moonPos[0], moonPos[1] + meshRadius + labelPad, moonPos[2]];
  }
  const s = (meshRadius + labelPad) / len;
  return [moonPos[0] + dx * s, moonPos[1] + dy * s, moonPos[2] + dz * s];
}
