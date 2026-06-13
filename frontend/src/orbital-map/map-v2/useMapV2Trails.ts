import { useMemo } from "react";
import { buildSegments } from "./TrajectoryPlanner";
import type { PlannerFilter } from "./TrajectoryPlanner";
import { toScenePoints } from "./SceneFrame";
import type { SceneFrameState } from "./types";
import type { MapContext } from "./MapContext";
import type { TrajectoryRole, TrajectorySegment } from "./types";

function sceneFrameKey(frame: SceneFrameState): string {
  const f = frame.focus;
  return [
    frame.displayScale,
    f?.x ?? "n",
    f?.y ?? "n",
    f?.z ?? "n",
  ].join("|");
}

function filterKey(filter?: PlannerFilter): string {
  if (!filter) {
    return "";
  }
  const names = filter.bodyNames
    ? [...filter.bodyNames].sort().join(",")
    : "";
  return [
    filter.planetOnly ? "p" : "",
    filter.moonOnly ? "m" : "",
    names,
  ].join("|");
}

/** Root-frame segments — only recompute when telemetry/context changes. */
export function useV2RootSegments(
  mapContext: MapContext | null,
  role: TrajectoryRole,
  filter?: PlannerFilter,
  enabled = true,
): TrajectorySegment[] {
  const fKey = filterKey(filter);
  return useMemo(() => {
    if (!enabled || !mapContext) {
      return [];
    }
    return buildSegments(mapContext, role, filter);
  }, [enabled, mapContext, role, fKey]);
}

export interface SceneTrail {
  key: string;
  bodyName?: string;
  points: ReturnType<typeof toScenePoints>;
  anchorIndex: number;
  closed: boolean;
  color?: string;
  lineWidth?: number;
  opacity?: number;
  dashed?: boolean;
}

/** Apply world shift to root segments; cheap when only focus/scale changes. */
export function useV2SceneTrails(
  rootSegments: TrajectorySegment[],
  sceneFrame: SceneFrameState,
): SceneTrail[] {
  const frameKey = sceneFrameKey(sceneFrame);
  return useMemo(
    () =>
      rootSegments.map((seg) => ({
        key: seg.key,
        bodyName: seg.bodyName,
        points: toScenePoints(seg.points, sceneFrame),
        anchorIndex: seg.anchorIndex ?? 0,
        closed: seg.closed ?? false,
        color: seg.color,
        lineWidth: seg.lineWidth,
        opacity: seg.opacity,
        dashed: seg.dashed,
      })),
    [rootSegments, frameKey],
  );
}
