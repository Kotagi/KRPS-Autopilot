import type { Vector3 } from "../telemetry/schema-v6";
import { applyWorldShift, getFocusPosition } from "../coords/worldShift";
import type { MapContext } from "./MapContext";
import { isFiniteRootPoint } from "./rootPointSafety";
import type {
  SceneFrameFocusMode,
  SceneFrameState,
  ScenePoint3,
} from "./types";

export type { SceneFrameFocusMode, SceneFrameState, ScenePoint3 };

export function resolveSceneFrameFocus(
  ctx: MapContext,
  focusMode: SceneFrameFocusMode,
  focusBodyName: string | null,
): Vector3 | null {
  if (focusMode === "system" || !focusBodyName) {
    return null;
  }
  const entry = ctx.bodyByName.get(focusBodyName);
  return entry?.position ?? null;
}

export function createSceneFrame(
  ctx: MapContext,
  displayScale: number,
  focusMode: SceneFrameFocusMode = "system",
  focusBodyName: string | null = null,
): SceneFrameState {
  const focus = resolveSceneFrameFocus(ctx, focusMode, focusBodyName);
  return {
    focusMode,
    focusBodyName,
    focus,
    displayScale: displayScale > 0 ? displayScale : 1e-9,
  };
}

function finiteSceneShift(
  rootPoint: Vector3,
  frame: SceneFrameState,
): ScenePoint3 | null {
  if (!isFiniteRootPoint(rootPoint)) {
    return null;
  }
  const [x, y, z] = applyWorldShift(rootPoint, frame.focus, frame.displayScale);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return [x, y, z];
}

/** Root-relative meters → scene units (world shift + scale). */
export function toScenePoint(
  rootPoint: Vector3,
  frame: SceneFrameState,
): ScenePoint3 {
  return finiteSceneShift(rootPoint, frame) ?? [0, 0, 0];
}

export function toScenePoints(
  rootPoints: Vector3[],
  frame: SceneFrameState,
): ScenePoint3[] {
  const out: ScenePoint3[] = [];
  rootPoints.forEach((p) => {
    const pt = finiteSceneShift(p, frame);
    if (pt) {
      out.push(pt);
    }
  });
  return out;
}

/** Focus body list for getFocusPosition compatibility. */
export function bodyEntriesForFocus(
  ctx: MapContext,
): { body: { name?: string }; position: Vector3 }[] {
  return ctx.bodies.map((b) => ({ body: { name: b.name }, position: b.position }));
}

export function getFocusPositionV2(
  ctx: MapContext,
  focusBodyName: string | null,
): Vector3 | null {
  return getFocusPosition(bodyEntriesForFocus(ctx), focusBodyName);
}
