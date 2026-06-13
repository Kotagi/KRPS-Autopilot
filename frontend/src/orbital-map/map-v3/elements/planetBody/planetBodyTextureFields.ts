import type { CelestialBody } from "../../../telemetry/schema-v6";

export interface PlanetBodyTextureFields {
  bodyTextureUrl?: string;
  bodyTextureRevision?: string;
  bodyTextureStatus?: string;
}

export function planetBodyTextureFields(
  body: CelestialBody | undefined,
): PlanetBodyTextureFields {
  if (!body) {
    return {};
  }
  return {
    bodyTextureUrl: body.bodyTextureUrl,
    bodyTextureRevision: body.bodyTextureRevision,
    bodyTextureStatus: body.bodyTextureStatus,
  };
}

export function isPlanetBodyTextureReady(
  fields: PlanetBodyTextureFields,
): boolean {
  return fields.bodyTextureStatus === "ready" && !!fields.bodyTextureUrl;
}
