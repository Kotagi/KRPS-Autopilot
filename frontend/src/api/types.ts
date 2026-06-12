export type PhaseState =
  | "idle"
  | "configuring"
  | "running"
  | "completed"
  | "aborted"
  | "error";

export type AscentPath = "classic" | "gt" | "pvg";

export type NavballSource = "krpc" | "krps";

export interface NavballSourceStatus {
  source: NavballSource;
  krps_connected: boolean;
  krpc_connected: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  api_ready: boolean;
  vessel_name: string | null;
  situation: string | null;
  scene: string;
}

export interface VesselControlsState {
  sas: boolean;
  rcs: boolean;
  lights: boolean;
  throttle: number;
  current_stage: number;
}

export interface VesselTelemetry {
  vessel_name: string;
  situation: string;
  orbit_body?: string | null;
  altitude_m: number;
  surface_altitude_m?: number;
  apoapsis_m: number;
  periapsis_m: number;
  inclination_deg?: number;
  eccentricity?: number;
  orbital_speed_ms?: number;
  surface_speed_ms?: number;
  vertical_speed_ms?: number;
  pitch_deg?: number;
  heading_deg?: number;
  roll_deg?: number;
  surface_rotation?: [number, number, number, number];
  angle_of_attack_deg?: number;
  sideslip_angle_deg?: number;
  dynamic_pressure_pa?: number;
  mach?: number;
  g_force?: number;
  time_to_apoapsis_s?: number | null;
  time_to_periapsis_s?: number | null;
  time_to_soi_s?: number | null;
  prograde?: [number, number, number];
  maneuver_node_count?: number;
  next_node_time_to_s?: number | null;
  /** Unix seconds from server; used for client latency debug. */
  server_ts?: number;
  /** Unix milliseconds from server; preferred for latency debug. */
  server_ts_ms?: number;
  /** Monotonic telemetry sequence from server. */
  server_seq?: number;
  navball_source?: NavballSource;
}

export interface VesselDeltaV {
  current_stage: number;
  stage_vac_ms: number;
  total_vac_ms: number;
  surface_twr: number;
}

export interface StageFuel {
  stage_number: number;
  label: string;
  percent: number;
  fuel_remaining: number;
  fuel_capacity: number;
  is_active: boolean;
  has_engine: boolean;
}

export interface StageFuelSnapshot {
  vessel_name: string;
  current_stage: number;
  stages: StageFuel[];
}

export interface ClassicPathConfig {
  turn_start_altitude_km: number;
  turn_start_velocity_ms: number;
  turn_end_altitude_km: number;
  turn_end_angle_deg: number;
  turn_shape_exponent: number;
  auto_path: boolean;
  auto_turn_percent: number;
  auto_turn_speed_factor: number;
}

export interface GTPathConfig {
  turn_start_altitude_km: number;
  turn_start_velocity_ms: number;
  turn_start_pitch_deg: number;
  intermediate_altitude_km: number;
  hold_ap_time_s: number;
}

export interface PVGPathConfig {
  target_periapsis_km: number;
  target_apoapsis_km: number;
  attach_altitude_km: number;
  attach_alt_enabled: boolean;
  pitch_start_velocity_ms: number;
  pitch_rate_deg_per_s: number;
  q_trigger_kpa: number;
  pvg_after_stage: number;
  pvg_after_stage_enabled: boolean;
  fixed_coast: boolean;
  fixed_coast_length_s: number;
}

export interface AscentConfig {
  desired_orbit_altitude_km: number;
  desired_inclination_deg: number;
  launch_lan_difference_deg: number;
  ascent_path: AscentPath;
  autostage: boolean;
  force_roll: boolean;
  vertical_roll: number;
  turn_roll: number;
  classic: ClassicPathConfig;
  gt: GTPathConfig;
  pvg: PVGPathConfig;
}

export interface AscentStatus {
  state: PhaseState;
  enabled: boolean;
  mj_status: string;
  launch_mode: string;
  configured: boolean;
  last_error: string | null;
  ascent_path: AscentPath | null;
  desired_orbit_altitude_km: number | null;
  desired_inclination_deg: number | null;
}

export type TargetKind = "star" | "planet" | "moon" | "asteroid" | "vessel";
export type TargetType = "none" | "body" | "vessel";

export interface TargetNode {
  id: string;
  name: string;
  kind: TargetKind;
  parent_id: string | null;
  selectable: boolean;
  orbit_body: string | null;
  children: TargetNode[];
}

export interface TargetTree {
  roots: TargetNode[];
  active_vessel_name: string | null;
}

export interface TargetStatus {
  target_type: TargetType;
  id: string | null;
  name: string | null;
  kind: TargetKind | null;
  orbit_body: string | null;
  distance_m: number | null;
  mechjeb_locked: boolean;
}

export type ManeuverOperationId =
  | "circularize"
  | "apoapsis"
  | "periapsis"
  | "ellipticize"
  | "semi_major"
  | "inclination"
  | "longitude"
  | "lan"
  | "plane"
  | "transfer"
  | "interplanetary_transfer"
  | "kill_rel_vel"
  | "lambert"
  | "course_correction"
  | "moon_return"
  | "resonant_orbit";

export type TimeReferenceId =
  | "computed"
  | "x_from_now"
  | "apoapsis"
  | "periapsis"
  | "altitude"
  | "eq_ascending"
  | "eq_descending"
  | "rel_ascending"
  | "rel_descending"
  | "closest_approach"
  | "eq_highest_ad"
  | "eq_nearest_ad"
  | "rel_highest_ad"
  | "rel_nearest_ad";

export type ExecuteMode = "one" | "all";

export interface ManeuverParamSpec {
  name: string;
  label: string;
  kind: "altitude_km" | "degrees" | "seconds" | "meters" | "bool" | "int" | "float";
  default?: number | boolean | null;
  min?: number | null;
  max?: number | null;
}

export interface ManeuverOperationSpec {
  id: ManeuverOperationId;
  label: string;
  description: string;
  timed: boolean;
  needs_target: boolean;
  params: ManeuverParamSpec[];
}

export interface ManeuverPlanRequest {
  operation: ManeuverOperationId;
  clear_existing: boolean;
  time_reference: TimeReferenceId;
  lead_time_s?: number | null;
  circularize_altitude_km?: number | null;
  params: Record<string, number | boolean>;
}

export interface ManeuverNodeSummary {
  ut: number;
  delta_v_ms: number;
  remaining_delta_v_ms: number;
  time_to_s: number;
  tolerance_ms: number;
}

export interface ManeuverPlanResult {
  operation: ManeuverOperationId;
  nodes_created: number;
  warning: string | null;
  nodes: ManeuverNodeSummary[];
}

export interface ManeuverExecuteRequest {
  mode: ExecuteMode;
  tolerance?: number | null;
  autowarp: boolean;
  lead_time_s: number;
}

export interface ManeuverNodeToleranceRequest {
  tolerance_ms: number;
}

export interface ManeuverStatus {
  state: PhaseState;
  executor_enabled: boolean;
  node_count: number;
  next_node_ut: number | null;
  next_node_time_to_s: number | null;
  last_operation: ManeuverOperationId | null;
  last_error: string | null;
  last_warning: string | null;
}

export interface ManeuverEncounterSummary {
  body_name: string;
  pe_km: number;
  pe_m: number;
}

export type TuneMode = "intercept_pe" | "closest_approach";

export interface ManeuverFineTunePreview {
  node_index: number;
  node_count: number;
  orbit_body: string | null;
  time_to_soi_s: number | null;
  next_soi_body: string | null;
  resolved_target: string | null;
  encounters: ManeuverEncounterSummary[];
  orbit_description: string | null;
  tune_mode: TuneMode | null;
  approach_altitude_km: number | null;
  approach_altitude_m: number | null;
  miss_distance_km: number | null;
  can_tune: boolean;
}

export interface ManeuverFineTuneRequest {
  desired_pe_km: number;
  node_index: number;
  target_body_name?: string | null;
  tolerance_km: number;
  max_iterations: number;
  max_prograde_delta_ms: number;
}

export interface ManeuverFineTuneResult {
  success: boolean;
  target_body_name: string | null;
  initial_pe_km: number | null;
  final_pe_km: number | null;
  initial_pe_m: number | null;
  final_pe_m: number | null;
  desired_pe_km: number;
  iterations: number;
  initial_prograde_ms: number | null;
  final_prograde_ms: number | null;
  delta_prograde_ms: number | null;
  initial_normal_ms: number | null;
  final_normal_ms: number | null;
  delta_normal_ms: number | null;
  initial_radial_ms: number | null;
  final_radial_ms: number | null;
  delta_radial_ms: number | null;
  axes_adjusted: string[];
  tune_mode: TuneMode | null;
  message: string | null;
  nodes: ManeuverNodeSummary[];
}

export interface WsEvent<T = Record<string, unknown>> {
  type: string;
  payload: T;
}

export const defaultClassicConfig = (): ClassicPathConfig => ({
  turn_start_altitude_km: 0.5,
  turn_start_velocity_ms: 100,
  turn_end_altitude_km: 60,
  turn_end_angle_deg: 0,
  turn_shape_exponent: 40,
  auto_path: true,
  auto_turn_percent: 0.05,
  auto_turn_speed_factor: 18.5,
});

export const defaultGTConfig = (): GTPathConfig => ({
  turn_start_altitude_km: 0.5,
  turn_start_velocity_ms: 50,
  turn_start_pitch_deg: 25,
  intermediate_altitude_km: 45,
  hold_ap_time_s: 1,
});

export const defaultPVGConfig = (): PVGPathConfig => ({
  target_periapsis_km: 250,
  target_apoapsis_km: 250,
  attach_altitude_km: 0,
  attach_alt_enabled: false,
  pitch_start_velocity_ms: 50,
  pitch_rate_deg_per_s: 0.5,
  q_trigger_kpa: 10,
  pvg_after_stage: 1,
  pvg_after_stage_enabled: false,
  fixed_coast: false,
  fixed_coast_length_s: 0,
});

export const defaultAscentConfig = (): AscentConfig => ({
  desired_orbit_altitude_km: 100,
  desired_inclination_deg: 0,
  launch_lan_difference_deg: 0,
  ascent_path: "pvg",
  autostage: true,
  force_roll: true,
  vertical_roll: 90,
  turn_roll: 90,
  classic: defaultClassicConfig(),
  gt: defaultGTConfig(),
  pvg: defaultPVGConfig(),
});

export interface CameraSummary {
  id: number;
  name: string;
  streaming: boolean;
  viewer_count: number;
  snapshot_url: string | null;
  stream_url: string | null;
}

export interface CameraListResponse {
  available: boolean;
  source: string;
  cameras: CameraSummary[];
  error: string | null;
}
