import type { MapContext } from "../MapContext";
import type { Bounds3 } from "../../camera/solarCameraBounds";
import { toScenePoint } from "../SceneFrame";
import type { SceneFrameState } from "../types";
import { buildStarMarkerSegments } from "../elements/starMarker/buildStarMarkerSegments";

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

function includeSphere(bounds: Bounds3, x: number, y: number, z: number, radius: number) {
  bounds.minX = Math.min(bounds.minX, x - radius);
  bounds.maxX = Math.max(bounds.maxX, x + radius);
  bounds.minY = Math.min(bounds.minY, y - radius);
  bounds.maxY = Math.max(bounds.maxY, y + radius);
  bounds.minZ = Math.min(bounds.minZ, z - radius);
  bounds.maxZ = Math.max(bounds.maxZ, z + radius);
  bounds.valid = true;
}

/** Scene frame for system anchors — never world-shift by moon LOD focus. */
export function starMarkerSceneFrame(
  frame: SceneFrameState,
): SceneFrameState {
  return {
    ...frame,
    focusMode: "system",
    focusBodyName: null,
    focus: null,
  };
}

/**
 * Frame for drawing the star mesh. Full-system view keeps the star unshifted (Phase 1).
 * When a planet is focused, apply the same world shift as orbits/bodies so the Sun
 * stays at heliocentric origin relative to the view (not stacked on the focused planet).
 */
export function starMarkerDrawFrame(frame: SceneFrameState): SceneFrameState {
  if (frame.focus == null) {
    return starMarkerSceneFrame(frame);
  }
  return frame;
}

/** Camera bounds for Map V3 when only the primary star is drawn (Phase 1). */
export function getStarMarkerCameraBounds(
  ctx: MapContext | null,
  displayScale: number,
): Bounds3 {
  const bounds = createBounds();
  if (!ctx?.canDraw) {
    includeSphere(bounds, 0, 0, 0, 8);
    return bounds;
  }

  const frame = starMarkerSceneFrame({
    focusMode: "system",
    focusBodyName: null,
    focus: null,
    displayScale: displayScale > 0 ? displayScale : 1e-9,
  });

  const segments = buildStarMarkerSegments(ctx);
  if (segments.length === 0) {
    includeSphere(bounds, 0, 0, 0, 8);
    return bounds;
  }

  const [x, y, z] = toScenePoint(segments[0].points[0], frame);
  includeSphere(bounds, x, y, z, 8);
  return bounds;
}
