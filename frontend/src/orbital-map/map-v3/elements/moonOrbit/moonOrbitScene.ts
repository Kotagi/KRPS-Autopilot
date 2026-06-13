import { findTrailAnchorIndex } from "../../../scene/orbitTrailDirectionStyle";
import { densifyPlanetOrbitScenePoints } from "../planetOrbit/densifyPlanetOrbitTrail";
import { toScenePoint } from "../../SceneFrame";
import { isFiniteRootPoint } from "../../rootPointSafety";
import type { BodyEntry, MapContext } from "../../MapContext";
import type { SceneFrameState, ScenePoint3 } from "../../types";
import type { Vector3 } from "../../../telemetry/schema-v6";
import { parentRelativeOffsetsAnchoredToParentNow } from "./moonOrbitPlacement";

/**
 * Parent-relative trail (DLL) → solar root at parent(now) → scene (focus shift only).
 */
export function moonOrbitPointsToScene(
  parentRelativePoints: Vector3[],
  parentEntry: BodyEntry,
  frame: SceneFrameState,
): ScenePoint3[] {
  const solarRoot = parentRelativeOffsetsAnchoredToParentNow(
    parentRelativePoints,
    parentEntry,
  );

  const scene: ScenePoint3[] = [];
  solarRoot.forEach((root) => {
    if (!isFiniteRootPoint(root)) {
      return;
    }
    const pt = toScenePoint(root, frame);
    if (
      Number.isFinite(pt[0])
      && Number.isFinite(pt[1])
      && Number.isFinite(pt[2])
    ) {
      scene.push(pt);
    }
  });

  return densifyPlanetOrbitScenePoints(scene);
}

/**
 * Motion-tail anchor: same scene frame as the drawn ring and propagated moon icon
 * (see {@link findTrailAnchorIndex} in orbit guide §3).
 */
export function resolveMoonOrbitAnchorIndex(
  scenePoints: ScenePoint3[],
  moonBodyName: string | undefined,
  ctx: MapContext,
  frame: SceneFrameState,
): number {
  if (!moonBodyName || scenePoints.length === 0) {
    return 0;
  }
  const moonEntry = ctx.bodyByName.get(moonBodyName);
  if (!moonEntry) {
    return 0;
  }
  const moonScene = toScenePoint(moonEntry.position, frame);
  return findTrailAnchorIndex(scenePoints, moonScene);
}
