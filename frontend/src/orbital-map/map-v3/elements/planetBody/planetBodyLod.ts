/**
 * Map V3 planet mesh ↔ fixed-screen map dot (always on in PlanetBodyLayer).
 * V3-owned; tuned toward KSP tracking-map behavior (see v2 parity notes in tests).
 */

/** Point sprite diameter in pixels (`PointsMaterial.size`, `sizeAttenuation: false`). */
export const PLANET_BODY_DOT_PIXEL_SIZE = 7;

/** Default perspective FOV (deg) when camera.fov is unavailable (tests). */
export const PLANET_BODY_LOD_DEFAULT_FOV_DEG = 50;

/** Default viewport height (px) when size is unavailable (tests). */
export const PLANET_BODY_LOD_DEFAULT_VIEWPORT_HEIGHT = 800;

/** Sphere subdivisions for planet mesh mode. */
export const PLANET_BODY_MESH_SPHERE_SEGMENTS = 32;

export type PlanetBodyDrawMode = "mesh" | "icon";

/** Dev HUD override for Map V3 planet body LOD (auto = zoom-based). */
export type PlanetBodyLodDevOverride = "auto" | "icon" | "mesh";

export interface PlanetBodyLodInput {
  sceneMeshRadius: number;
  cameraDistance: number;
  cameraFovDeg?: number;
  viewportHeight?: number;
  devOverride?: PlanetBodyLodDevOverride;
}

/** How wide the body mesh would appear on screen (px), for a perspective camera. */
export function planetBodyMeshProjectedDiameterPx(
  sceneMeshRadius: number,
  cameraDistance: number,
  cameraFovDeg = PLANET_BODY_LOD_DEFAULT_FOV_DEG,
  viewportHeight = PLANET_BODY_LOD_DEFAULT_VIEWPORT_HEIGHT,
): number {
  const dist = Math.max(cameraDistance, 1e-6);
  const vFovRad = (cameraFovDeg * Math.PI) / 180;
  const diameterScene = sceneMeshRadius * 2;
  return (
    (diameterScene / dist) *
    (viewportHeight * 0.5) /
    Math.tan(vFovRad * 0.5)
  );
}

export function resolvePlanetBodyDrawMode(
  input: PlanetBodyLodInput,
): PlanetBodyDrawMode {
  if (input.devOverride === "icon") {
    return "icon";
  }
  if (input.devOverride === "mesh") {
    return "mesh";
  }
  const meshDiameterPx = planetBodyMeshProjectedDiameterPx(
    input.sceneMeshRadius,
    input.cameraDistance,
    input.cameraFovDeg,
    input.viewportHeight,
  );
  if (meshDiameterPx <= PLANET_BODY_DOT_PIXEL_SIZE) {
    return "icon";
  }
  return "mesh";
}
