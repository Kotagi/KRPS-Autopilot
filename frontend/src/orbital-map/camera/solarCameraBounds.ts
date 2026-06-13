import type { TelemetrySnapshot, Vector3 } from "../telemetry/schema-v6";
import type { CameraMode } from "../store/viewStore";
import type { SolarSystemModel } from "../model/buildSolarSystemModel";
import { moonsOf } from "../model/bodyHierarchy";
import { applyWorldShift, getFocusPosition } from "../coords/worldShift";

export interface Bounds3 {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  valid: boolean;
}

function createBounds(): Bounds3 {
  return {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    valid: false,
  };
}

function includePoint(bounds: Bounds3, x: number, y: number, z: number) {
  bounds.minX = Math.min(bounds.minX, x);
  bounds.maxX = Math.max(bounds.maxX, x);
  bounds.minY = Math.min(bounds.minY, y);
  bounds.maxY = Math.max(bounds.maxY, y);
  bounds.minZ = Math.min(bounds.minZ, z);
  bounds.maxZ = Math.max(bounds.maxZ, z);
  bounds.valid = true;
}

function includeSphere(bounds: Bounds3, x: number, y: number, z: number, radius: number) {
  includePoint(bounds, x - radius, y - radius, z - radius);
  includePoint(bounds, x + radius, y + radius, z + radius);
}

function toScene(
  position: Vector3,
  focus: Vector3 | null,
  displayScale: number,
): [number, number, number] {
  return applyWorldShift(position, focus, displayScale);
}

/** Collect scene-space AABB for camera framing (mirrors index.html getSolarCameraBounds). */
export function getSolarCameraBounds3D(
  model: SolarSystemModel,
  telemetry: TelemetrySnapshot | null | undefined,
  cameraMode: CameraMode,
  displayScale: number,
  focusBodyName: string | null,
  displayFocus: Vector3 | null = null,
): Bounds3 {
  const bounds = createBounds();
  if (!model.canDraw) {
    return bounds;
  }

  const focus =
    displayFocus ??
    (focusBodyName != null && cameraMode === "bodyFocus"
      ? getFocusPosition(model.bodies, focusBodyName)
      : getFocusPosition(model.bodies, telemetry?.rootBody ?? null));

  function includeBodyByName(name: string) {
    model.bodies.forEach((entry) => {
      if (entry.body.name !== name) {
        return;
      }
      const [x, y, z] = toScene(entry.position, focus, displayScale);
      includePoint(bounds, x, y, z);
      const soi = entry.body.sphereOfInfluenceMeters ?? 0;
      if (soi > 0) {
        includeSphere(bounds, x, y, z, soi * displayScale * 0.15);
      }
    });
  }

  if (cameraMode === "activeVessel" && model.vesselPosition) {
    const [x, y, z] = toScene(model.vesselPosition, focus, displayScale);
    includePoint(bounds, x, y, z);
    includeSphere(bounds, x, y, z, 2.5);
    if (model.referenceBody) {
      includeBodyByName(model.referenceBody);
    }
  } else if (cameraMode === "currentReferenceBody" && model.referenceBody) {
    includeBodyByName(model.referenceBody);
    if (model.vesselPosition) {
      const [x, y, z] = toScene(model.vesselPosition, focus, displayScale);
      includePoint(bounds, x, y, z);
    }
  } else if (cameraMode === "encounterBody" && model.encounterBody) {
    includeBodyByName(model.encounterBody);
    if (model.vesselPosition) {
      const [x, y, z] = toScene(model.vesselPosition, focus, displayScale);
      includePoint(bounds, x, y, z);
    }
  } else if (cameraMode === "route") {
    model.routeAnchors.forEach((anchor) => {
      const [x, y, z] = toScene(anchor.position, focus, displayScale);
      includePoint(bounds, x, y, z);
    });
    if (model.vesselPosition) {
      const [x, y, z] = toScene(model.vesselPosition, focus, displayScale);
      includePoint(bounds, x, y, z);
    }
  } else if (cameraMode === "bodyFocus" && focusBodyName) {
    const entry = model.bodies.find((b) => b.body.name === focusBodyName);
    const soi = entry?.body.sphereOfInfluenceMeters ?? 0;
    const bodyRadius = Math.max(entry?.body.radiusMeters ?? 1000, 1000);
    const frameRadius = Math.max(
      soi > 0 ? soi * displayScale * 0.45 : bodyRadius * displayScale * 80,
      bodyRadius * displayScale * 4,
      focusBodyName === "Sun" ? 8 : 0.02,
    );
    includeSphere(bounds, 0, 0, 0, frameRadius);

    const host = model.hierarchy?.planetForBody[focusBodyName];
    if (host && model.hierarchy) {
      includeBodyByName(host);
      moonsOf(model.hierarchy, host).forEach((moon) => includeBodyByName(moon));
    }

    if (model.vesselPosition) {
      const [x, y, z] = toScene(model.vesselPosition, focus, displayScale);
      includePoint(bounds, x, y, z);
      includeSphere(bounds, x, y, z, 1.2);
    }
  } else {
    model.bodies.forEach((entry) => {
      const [x, y, z] = toScene(entry.position, focus, displayScale);
      includePoint(bounds, x, y, z);
    });
    model.routeAnchors.forEach((anchor) => {
      const [x, y, z] = toScene(anchor.position, focus, displayScale);
      includePoint(bounds, x, y, z);
    });
    if (model.vesselPosition) {
      const [x, y, z] = toScene(model.vesselPosition, focus, displayScale);
      includePoint(bounds, x, y, z);
    }
  }

  if (!bounds.valid) {
    includeSphere(bounds, 0, 0, 0, 1);
  }

  return bounds;
}

export function getBoundsCenterAndRadius(bounds: Bounds3): {
  center: [number, number, number];
  radius: number;
} {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const dx = bounds.maxX - bounds.minX;
  const dy = bounds.maxY - bounds.minY;
  const dz = bounds.maxZ - bounds.minZ;
  const radius = Math.max(dx, dy, dz) / 2;
  return { center: [cx, cy, cz], radius: Math.max(radius, 1) };
}

/** Face-on solar ecliptic view (ecliptic in XY, camera along −Z). */
export function getEclipticLevelCameraPose(
  center: [number, number, number],
  radius: number,
): {
  position: [number, number, number];
  up: [number, number, number];
} {
  const dist = Math.max(radius * 2.8, 4);
  return {
    position: [center[0], center[1], center[2] + dist],
    up: [0, 1, 0],
  };
}
