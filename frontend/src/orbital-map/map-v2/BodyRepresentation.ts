import type { BodyHierarchy } from "../model/bodyHierarchy";
import { isMoon } from "../model/bodyHierarchy";
import { bodyMeshRadius } from "../scene/bodyVisualScale";

/** Screen-space threshold: below this projected radius, draw map icon instead of mesh. */
export const ICON_LOD_SCREEN_RADIUS = 0.12;

export type BodyDrawMode = "mesh" | "icon";

export interface BodyRepresentationInput {
  bodyName: string;
  radiusMeters: number;
  displayScale: number;
  hierarchy: BodyHierarchy;
  hostPlanetOpen: boolean;
  cameraDistance: number;
  sceneMeshRadius: number;
}

export function sceneMeshRadius(input: Omit<BodyRepresentationInput, "cameraDistance" | "sceneMeshRadius">): number {
  return bodyMeshRadius({
    bodyName: input.bodyName,
    radiusMeters: input.radiusMeters,
    displayScale: input.displayScale,
    hierarchy: input.hierarchy,
    hostPlanetOpen: input.hostPlanetOpen,
  });
}

export function resolveBodyDrawMode(input: BodyRepresentationInput): BodyDrawMode {
  const ratio = input.sceneMeshRadius / Math.max(input.cameraDistance, 0.01);
  if (ratio <= ICON_LOD_SCREEN_RADIUS && !isMoon(input.hierarchy, input.bodyName)) {
    return "icon";
  }
  if (isMoon(input.hierarchy, input.bodyName) && ratio <= ICON_LOD_SCREEN_RADIUS * 0.5) {
    return "icon";
  }
  return "mesh";
}

export function iconDotRadius(bodyName: string, hierarchy: BodyHierarchy): number {
  if (bodyName === hierarchy.rootBody) {
    return 0.08;
  }
  if (isMoon(hierarchy, bodyName)) {
    return 0.04;
  }
  return 0.06;
}
