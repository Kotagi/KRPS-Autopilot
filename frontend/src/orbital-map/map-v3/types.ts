import type { Vector3 } from "../telemetry/schema-v6";

/** One visual object type on the modular v3 map — maps 1:1 to a layer file. */
export type MapElementKind =
  | "starMarker"
  | "planetOrbit"
  | "planetBody"
  | "moonOrbit"
  | "moonBody"
  | "vesselMarker"
  | "bodyLod"
  | "vesselOrbit"
  | "bodyLabel"
  | "futureRoute"
  | "soiRing"
  | "selection";

export type ScenePoint3 = [number, number, number];

/** Primary or companion star anchoring a solar-system subtree (multi-star ready). */
export interface SystemAnchor {
  id: string;
  bodyName: string;
  position: Vector3;
  radiusMeters: number;
}

export interface TrajectorySegment {
  kind: MapElementKind;
  key: string;
  /** Root-relative meters before SceneFrame (moonOrbit: parent-relative). */
  points: Vector3[];
  bodyName?: string;
  referenceBody?: string;
  parentBody?: string;
  closed?: boolean;
  anchorIndex?: number;
  /** Per-vertex UT when trail uses telemetry samples (omitted for analytic rings). */
  sampleUniversalTimes?: number[];
  closedWithDuplicateEndpoint?: boolean;
  lineWidth?: number;
  color?: string;
  opacity?: number;
  dashed?: boolean;
  iconScenePosition?: ScenePoint3 | null;
  /** Moon orbit: telemetry samples vs analytic fallback. */
  geometrySource?: "samples" | "analytic";
}

export type SceneFrameFocusMode = "system" | "body";

export interface SceneFrameState {
  focusMode: SceneFrameFocusMode;
  focusBodyName: string | null;
  focus: Vector3 | null;
  displayScale: number;
}
