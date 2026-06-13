import type { TelemetrySnapshot, Vector3 } from "../telemetry/schema-v6";
import { isSupportedSchemaVersion } from "../telemetry/constants";
import { finiteOr, valueOrNA } from "../math/util";
import { resolveVesselPathPoints } from "./resolveVesselPathPoints";
import { buildBodyHierarchy, type BodyHierarchy } from "./bodyHierarchy";

export type ProjectionMode = "rootXZ" | "rootXY";

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface BodyModel {
  body: NonNullable<TelemetrySnapshot["bodies"]>[number];
  position: Vector3;
  projected: ProjectedPoint;
  isScrubPreview: boolean;
}

export interface RouteAnchor {
  patch: NonNullable<TelemetrySnapshot["orbitPatches"]>[number];
  sample?: NonNullable<NonNullable<TelemetrySnapshot["orbitPatches"]>[number]["placementSamples"]>[number];
  projected: ProjectedPoint;
  position: Vector3;
  role: string;
  targetBody?: string;
  sampleUniversalTimeSeconds?: number;
}

export interface PatchAnchor {
  patch: NonNullable<TelemetrySnapshot["orbitPatches"]>[number];
  projected: ProjectedPoint;
  position: Vector3;
  role: string;
}

export type { BodyHierarchy } from "./bodyHierarchy";

export interface SolarSystemModel {
  telemetry: TelemetrySnapshot | null;
  hierarchy: BodyHierarchy | null;
  bodies: BodyModel[];
  patches: PatchAnchor[];
  placementMarkers: RouteAnchor[];
  routeAnchors: RouteAnchor[];
  vesselPathPoints: Vector3[];
  vesselPosition: Vector3 | null;
  referenceBody: string | null;
  encounterBody: string | null;
  projectionMode: ProjectionMode;
  placementMode: string;
  routeOverlayMode: string;
  ephemerisStatus: string;
  scrubUniversalTime: number | null;
  canDraw: boolean;
  reason: string;
  patchChainStatus: string;
  ephemerisValidationResidualMeters: number | null;
  iconTrailSample0ResidualMeters: number | null;
  ephemerisLivePropagationResidualMeters: number | null;
  bodyOrbitPropagationResidualMeters: number | null;
  bodyOrbitFlipPropagationResidualMeters: number | null;
  positionValidation: TelemetrySnapshot["positionValidation"] | null;
  bodyOrbitPaths: NonNullable<TelemetrySnapshot["bodyOrbitPaths"]>;
}

export function projectRootPoint(
  point: Vector3 | null | undefined,
  projectionMode: ProjectionMode,
): ProjectedPoint | null {
  if (!point) {
    return null;
  }
  if (projectionMode === "rootXY") {
    return { x: point.x, y: -point.y };
  }
  return { x: point.x, y: -point.z };
}

function resolveBodyPositionForScrub(
  body: NonNullable<TelemetrySnapshot["bodies"]>[number],
  telemetry: TelemetrySnapshot | null,
  scrubUniversalTime: number | null,
): Vector3 | null {
  if (!body?.positionRootRelativeMeters) {
    return null;
  }
  if (scrubUniversalTime === null || !telemetry?.ephemerisSamples) {
    return body.positionRootRelativeMeters;
  }
  let nearest: Vector3 | null = null;
  let nearestDelta = Infinity;
  telemetry.ephemerisSamples.forEach((sample) => {
    if (
      !sample ||
      sample.targetBody !== body.name ||
      !sample.positionRootRelativeMeters
    ) {
      return;
    }
    const delta = Math.abs(
      finiteOr(sample.sampleUniversalTimeSeconds, 0) - scrubUniversalTime,
    );
    if (delta < nearestDelta) {
      nearestDelta = delta;
      nearest = sample.positionRootRelativeMeters;
    }
  });
  return nearest ?? body.positionRootRelativeMeters;
}

export interface BuildSolarModelOptions {
  scrubUniversalTime?: number | null;
  scrubEnabled?: boolean;
}

export function buildSolarSystemModel(
  telemetry: TelemetrySnapshot | null,
  options: BuildSolarModelOptions = {},
): SolarSystemModel {
  const bodies = telemetry?.bodies ?? [];
  const vessel = telemetry?.activeVessel;
  const patches = telemetry?.orbitPatches ?? [];
  const projectionMode: ProjectionMode = "rootXZ";
  const scrubUniversalTime =
    options.scrubEnabled && options.scrubUniversalTime != null
      ? options.scrubUniversalTime
      : null;

  const bodyModels: BodyModel[] = [];
  const patchAnchors: PatchAnchor[] = [];
  const routeAnchors: RouteAnchor[] = [];
  const placementMarkers: RouteAnchor[] = [];

  let placementMode = "currentReferenceBodyPosition";
  let routeOverlayMode = "none";
  const ephemerisStatus = telemetry ? valueOrNA(telemetry.ephemerisCaptureStatus) : "N/A";

  bodies.forEach((body) => {
    if (!body) {
      return;
    }
    const position = resolveBodyPositionForScrub(body, telemetry, scrubUniversalTime);
    if (!position) {
      return;
    }
    const projected = projectRootPoint(position, projectionMode);
    if (!projected) {
      return;
    }
    bodyModels.push({
      body,
      position,
      projected,
      isScrubPreview: scrubUniversalTime !== null,
    });
  });

  patches.forEach((patch) => {
    if (!patch) {
      return;
    }
    if (patch.patchPlacementMode) {
      placementMode = patch.patchPlacementMode;
    }
    const samples = patch.placementSamples ?? [];
    if (samples.length > 0) {
      samples.forEach((sample) => {
        if (!sample?.positionRootRelativeMeters) {
          return;
        }
        const position = sample.positionRootRelativeMeters;
        const projected = projectRootPoint(position, projectionMode);
        if (!projected) {
          return;
        }
        const marker: RouteAnchor = {
          patch,
          sample,
          projected,
          position,
          role: sample.sampleRole ?? "sample",
          targetBody: sample.targetBody,
          sampleUniversalTimeSeconds: sample.sampleUniversalTimeSeconds,
        };
        placementMarkers.push(marker);
        routeAnchors.push(marker);
        if (sample.sampleRole === "patchStart") {
          patchAnchors.push({
            patch,
            projected,
            position,
            role: "patch start",
          });
        }
      });
    } else if (patch.referenceBodyPositionRootRelativeMeters) {
      const position = patch.referenceBodyPositionRootRelativeMeters;
      const projected = projectRootPoint(position, projectionMode);
      if (projected) {
        patchAnchors.push({ patch, projected, position, role: "current frame" });
        routeAnchors.push({
          patch,
          projected,
          position,
          role: "current frame",
          targetBody: patch.referenceBody,
          sampleUniversalTimeSeconds: patch.referenceBodyPositionSampleUniversalTimeSeconds,
        });
      }
    }
  });

  routeAnchors.sort(
    (a, b) =>
      finiteOr(a.sampleUniversalTimeSeconds, 0) - finiteOr(b.sampleUniversalTimeSeconds, 0),
  );

  if (
    routeAnchors.length >= 2 &&
    (placementMode === "multiSampleEphemeris" ||
      placementMode === "multiSampleEphemerisPartial")
  ) {
    routeOverlayMode = "patched-conic route (KSP prediction)";
  } else if (routeAnchors.length >= 2) {
    routeOverlayMode = "current-frame approximate route";
  }

  const vesselPathPoints = resolveVesselPathPoints(telemetry, vessel, bodyModels);

  let reason = "ok";
  let canDraw = false;
  if (!telemetry || !isSupportedSchemaVersion(telemetry.schemaVersion)) {
    reason = "Schema v6+ telemetry is required for solar-system rendering.";
  } else if (!telemetry.rootFrameName || !telemetry.rootBody) {
    reason = "Root-frame metadata is unavailable.";
  } else if (bodyModels.length === 0) {
    reason = "No root-frame body positions are available.";
  } else {
    canDraw = true;
  }

  let encounterBody: string | null = null;
  patches.forEach((patch) => {
    if (!encounterBody && patch?.encounterBody) {
      encounterBody = patch.encounterBody;
    }
  });

  const rootBody = telemetry?.rootBody ?? "Sun";
  const hierarchy =
    telemetry && bodyModels.length > 0
      ? buildBodyHierarchy(
          bodyModels.map((m) => m.body),
          rootBody,
        )
      : null;

  return {
    telemetry,
    hierarchy,
    bodies: bodyModels,
    patches: patchAnchors,
    placementMarkers,
    routeAnchors,
    vesselPathPoints,
    vesselPosition: vessel?.positionRootRelativeMeters ?? null,
    referenceBody: telemetry?.orbit?.referenceBody ?? vessel?.mainBody ?? null,
    encounterBody,
    projectionMode,
    placementMode,
    routeOverlayMode,
    ephemerisStatus,
    scrubUniversalTime,
    canDraw,
    reason,
    patchChainStatus: valueOrNA(telemetry?.patchChainStatus),
    ephemerisValidationResidualMeters: telemetry?.ephemerisValidationResidualMeters ?? null,
    iconTrailSample0ResidualMeters: telemetry?.iconTrailSample0ResidualMeters ?? null,
    ephemerisLivePropagationResidualMeters:
      telemetry?.ephemerisLivePropagationResidualMeters ?? null,
    bodyOrbitPropagationResidualMeters:
      telemetry?.bodyOrbitPropagationResidualMeters ?? null,
    bodyOrbitFlipPropagationResidualMeters:
      telemetry?.bodyOrbitFlipPropagationResidualMeters ?? null,
    positionValidation: telemetry?.positionValidation ?? null,
    bodyOrbitPaths: telemetry?.bodyOrbitPaths ?? [],
  };
}
