import { resolveTrailRenderMode } from "../../../coords/buildBodyOrbitTrail";
import type { BodyOrbitPath } from "../../../telemetry/schema-v6";
import type { MapContext } from "../../MapContext";
import { isMoonBody, isPlanetBody } from "../../MapContext";

/**
 * Moon trails only — inverse of shouldIncludeHeliocentricPlanetOrbit.
 */
export function shouldIncludeMoonOrbit(
  ctx: MapContext,
  path: BodyOrbitPath,
): boolean {
  const name = path.bodyName;
  if (!name || name === ctx.rootBody) {
    return false;
  }
  if (!isMoonBody(ctx, name)) {
    return false;
  }
  if (isPlanetBody(ctx, name)) {
    return false;
  }
  if (resolveTrailRenderMode(path) === "hidden") {
    return false;
  }
  const ref = path.referenceBody ?? path.orbitElements?.referenceBody;
  return !!ref && ref !== ctx.rootBody;
}
