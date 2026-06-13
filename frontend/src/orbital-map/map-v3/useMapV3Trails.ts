import { useMemo } from "react";
import { buildSegments } from "./planner/buildSegments";
import { toScenePoints } from "./SceneFrame";
import type { MapContext } from "./MapContext";
import type { MapElementKind, SceneFrameState, TrajectorySegment } from "./types";

function sceneFrameKey(frame: SceneFrameState): string {
  const f = frame.focus;
  return [
    frame.focusMode,
    frame.focusBodyName ?? "",
    frame.displayScale,
    f?.x ?? "n",
    f?.y ?? "n",
    f?.z ?? "n",
  ].join("|");
}

/** Root-frame segments — recompute when telemetry/context changes. */
export function useV3RootSegments(
  mapContext: MapContext | null,
  kind: MapElementKind,
  enabled = true,
): TrajectorySegment[] {
  return useMemo(() => {
    if (!enabled || !mapContext) {
      return [];
    }
    return buildSegments(mapContext, kind);
  }, [enabled, mapContext, kind]);
}

export interface SceneTrail {
  key: string;
  bodyName?: string;
  points: ReturnType<typeof toScenePoints>;
  anchorIndex: number;
  sampleUniversalTimes?: number[];
  closed: boolean;
  closedWithDuplicateEndpoint?: boolean;
  lineWidth?: number;
  geometrySource?: "samples" | "analytic";
}

/** Apply world shift to root segments; cheap when only focus/scale changes. */
export function useV3SceneTrails(
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
        sampleUniversalTimes: seg.sampleUniversalTimes,
        closed: seg.closed ?? false,
        closedWithDuplicateEndpoint: seg.closedWithDuplicateEndpoint,
        lineWidth: seg.lineWidth,
      })),
    [rootSegments, frameKey],
  );
}
