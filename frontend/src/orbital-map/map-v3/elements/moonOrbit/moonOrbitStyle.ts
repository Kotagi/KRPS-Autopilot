import { PLANET_ORBIT_STYLE } from "../planetOrbit/planetOrbitStyle";

/** Moon orbit styling matches heliocentric planet rings (Phase 2). */
export const MOON_ORBIT_STYLE = {
  retrogradeLineWidth: PLANET_ORBIT_STYLE.retrogradeLineWidth,
  progradeLineWidthFactor: PLANET_ORBIT_STYLE.progradeLineWidthFactor,
  trailVertices: PLANET_ORBIT_STYLE.trailVertices,
} as const;
