import { resolveTrailRenderMode } from "../../../coords/buildBodyOrbitTrail";
import type { BodyOrbitPath } from "../../../telemetry/schema-v6";
import type { MapContext } from "../../MapContext";
import { isPlanetBody } from "../../MapContext";

/**
 * Same inclusion rules as v2 `buildBodyOrbits(ctx, { planetOnly: true })`
 * before geometry is built (v3 uses densifyPlanetOrbitTrail, not v2 decimate).
 */
export function shouldIncludeHeliocentricPlanetOrbit(
  ctx: MapContext,
  path: BodyOrbitPath,
): boolean {
  const name = path.bodyName;
  if (!name || name === ctx.rootBody) {
    return false;
  }
  if (!isPlanetBody(ctx, name)) {
    return false;
  }
  if (resolveTrailRenderMode(path) === "hidden") {
    return false;
  }
  const ref = path.referenceBody ?? path.orbitElements?.referenceBody;
  return ref === ctx.rootBody;
}
