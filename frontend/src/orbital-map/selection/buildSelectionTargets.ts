import type { SolarSystemModel } from "../model/buildSolarSystemModel";
import type { SelectionDetail } from "./types";

export interface SelectableTarget {
  id: string;
  label: string;
  type: SelectionDetail["type"];
  detail: string;
  position: [number, number, number];
  radius: number;
}

export function buildSelectionTargets(model: SolarSystemModel): SelectableTarget[] {
  if (!model.canDraw) {
    return [];
  }
  const targets: SelectableTarget[] = [];

  model.bodies.forEach((entry) => {
    const name = entry.body.name ?? "body";
    targets.push({
      id: `body:${name}`,
      label: name,
      type: "body",
      detail: `Body ${name}`,
      position: [entry.position.x, entry.position.y, entry.position.z],
      radius: Math.max(entry.body.radiusMeters ?? 1000, 1000),
    });
  });

  if (model.vesselPosition) {
    const vesselName = model.telemetry?.activeVessel?.name ?? "Vessel";
    targets.push({
      id: "vessel:active",
      label: vesselName,
      type: "vessel",
      detail: `Active vessel ${vesselName}`,
      position: [
        model.vesselPosition.x,
        model.vesselPosition.y,
        model.vesselPosition.z,
      ],
      radius: 5000,
    });
  }

  model.placementMarkers.forEach((marker, index) => {
    const role = marker.role ?? "sample";
    const body = marker.targetBody ?? marker.patch.referenceBody ?? "body";
    targets.push({
      id: `sample:${index}`,
      label: `${body} ${role}`,
      type: "sample",
      detail: `${body} | ${role} | UT ${marker.sampleUniversalTimeSeconds ?? "N/A"}`,
      position: [marker.position.x, marker.position.y, marker.position.z],
      radius: 8000,
    });
  });

  model.routeAnchors.forEach((anchor, index) => {
    const role = anchor.role ?? "route";
    targets.push({
      id: `route:${index}`,
      label: `${anchor.targetBody ?? "route"} ${role}`,
      type: "patch",
      detail: `Route anchor ${role}`,
      position: [anchor.position.x, anchor.position.y, anchor.position.z],
      radius: 12000,
    });
  });

  return targets;
}

export function findSelectionDetail(
  targets: SelectableTarget[],
  id: string | null,
): SelectionDetail | null {
  if (!id) {
    return null;
  }
  const hit = targets.find((t) => t.id === id);
  if (!hit) {
    return null;
  }
  return {
    id: hit.id,
    label: hit.label,
    type: hit.type,
    detail: hit.detail,
  };
}
