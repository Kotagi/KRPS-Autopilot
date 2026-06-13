import { getKspBodyMapColor } from "../../../scene/bodyMapColors";

/** V3 planet-orbit line styling (matches v1/v2 DirectionalOrbitTrail / OrbitTrailV2). */
export const PLANET_ORBIT_STYLE = {
  retrogradeLineWidth: 1,
  progradeLineWidthFactor: 1,
  /** Arc-length resample target (telemetry ships ~128 samples per period). */
  trailVertices: 512,
} as const;

export function resolvePlanetOrbitColor(bodyName: string | undefined): string {
  return getKspBodyMapColor(bodyName);
}
