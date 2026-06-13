import type { Vector3 } from "../telemetry/schema-v6";

/** Extensible trajectory roles — one role per visual element type. */
export type TrajectoryRole =
  | "StarMarker"
  | "BodyOrbit"
  | "BodyPosition"
  | "VesselPosition"
  | "ActiveVesselLeg"
  | "FutureRouteLeg"
  | "SoiRing"
  | "BodyLabel";

export type ScenePoint3 = [number, number, number];

export interface TrajectorySegment {
  role: TrajectoryRole;
  key: string;
  /** Root-relative meters (before SceneFrame). */
  points: Vector3[];
  bodyName?: string;
  referenceBody?: string;
  parentBody?: string;
  closed?: boolean;
  /** Index on polyline nearest orbital phase (for KSP retro/prograde split). */
  anchorIndex?: number;
  closedWithDuplicateEndpoint?: boolean;
  lineWidth?: number;
  color?: string;
  opacity?: number;
  dashed?: boolean;
  /** Scene-space icon for trail split (after SceneFrame). */
  iconScenePosition?: ScenePoint3 | null;
}

export type SceneFrameFocusMode = "system" | "body";

export interface SceneFrameState {
  focusMode: SceneFrameFocusMode;
  focusBodyName: string | null;
  focus: Vector3 | null;
  displayScale: number;
}
