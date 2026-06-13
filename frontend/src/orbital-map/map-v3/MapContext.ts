import type { TelemetrySnapshot, Vector3 } from "../telemetry/schema-v6";
import {
  buildBodyHierarchy,
  isMoon,
  type BodyHierarchy,
} from "../model/bodyHierarchy";
import { isSupportedSchemaVersion } from "../telemetry/constants";

export interface BodyEntry {
  name: string;
  body: NonNullable<TelemetrySnapshot["bodies"]>[number];
  position: Vector3;
  radiusMeters: number;
  soiMeters: number;
}

/** Telemetry → bodies, hierarchy, and draw gate for Map V3 (canonical). */
export interface MapContext {
  telemetry: TelemetrySnapshot;
  rootBody: string;
  rootFrameName: string;
  gameUniversalTimeSeconds: number;
  hierarchy: BodyHierarchy;
  bodies: BodyEntry[];
  bodyByName: Map<string, BodyEntry>;
  canDraw: boolean;
  reason: string;
}

export function buildMapContext(
  telemetry: TelemetrySnapshot | null,
): MapContext | null {
  if (!telemetry || !isSupportedSchemaVersion(telemetry.schemaVersion)) {
    return null;
  }

  const rootBody = telemetry.rootBody ?? "Sun";
  const rawBodies = telemetry.bodies ?? [];
  const bodies: BodyEntry[] = [];

  rawBodies.forEach((body) => {
    if (!body?.name || !body.positionRootRelativeMeters) {
      return;
    }
    bodies.push({
      name: body.name,
      body,
      position: body.positionRootRelativeMeters,
      radiusMeters: Math.max(body.radiusMeters ?? 1000, 1000),
      soiMeters: Math.max(body.sphereOfInfluenceMeters ?? 0, 0),
    });
  });

  if (bodies.length === 0) {
    return null;
  }

  const hierarchy = buildBodyHierarchy(
    bodies.map((b) => b.body),
    rootBody,
  );

  const bodyByName = new Map(bodies.map((b) => [b.name, b]));

  return {
    telemetry,
    rootBody,
    rootFrameName:
      telemetry.rootFrameName ?? "solarSystemRootCenteredInertial",
    gameUniversalTimeSeconds: telemetry.gameUniversalTimeSeconds ?? 0,
    hierarchy,
    bodies,
    bodyByName,
    canDraw: true,
    reason: "ok",
  };
}

export function isPlanetBody(ctx: MapContext, bodyName: string): boolean {
  return ctx.hierarchy.planetNames.includes(bodyName);
}

export function isMoonBody(ctx: MapContext, bodyName: string): boolean {
  return isMoon(ctx.hierarchy, bodyName);
}

export function starBody(ctx: MapContext): BodyEntry | null {
  return ctx.bodyByName.get(ctx.rootBody) ?? null;
}
