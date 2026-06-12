import type {
  AscentConfig,
  AscentStatus,
  CameraListResponse,
  ConnectionStatus,
  ManeuverExecuteRequest,
  ManeuverFineTunePreview,
  ManeuverFineTuneRequest,
  ManeuverFineTuneResult,
  ManeuverNodeSummary,
  ManeuverOperationSpec,
  ManeuverPlanRequest,
  ManeuverPlanResult,
  ManeuverStatus,
  NavballSource,
  NavballSourceStatus,
  TargetStatus,
  TargetTree,
  VesselControlsState,
} from "./types";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : `Request failed (${response.status})`;
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  connect: () =>
    request<ConnectionStatus>("/api/connection/connect", { method: "POST" }),
  disconnect: () =>
    request<ConnectionStatus>("/api/connection/disconnect", {
      method: "POST",
    }),
  connectionStatus: () =>
    request<ConnectionStatus>("/api/connection/status"),
  navballSourceStatus: () =>
    request<NavballSourceStatus>("/api/telemetry/navball-source"),
  setNavballSource: (source: NavballSource) =>
    request<NavballSourceStatus>("/api/telemetry/navball-source", {
      method: "PUT",
      body: JSON.stringify({ source }),
    }),
  krpsDebug: () => request<Record<string, unknown>>("/api/telemetry/krps-debug"),
  vesselControls: () => request<VesselControlsState>("/api/vessel/controls"),
  stage: () =>
    request<VesselControlsState>("/api/vessel/stage", { method: "POST" }),
  setSas: (enabled: boolean) =>
    request<VesselControlsState>("/api/vessel/sas", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  setRcs: (enabled: boolean) =>
    request<VesselControlsState>("/api/vessel/rcs", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  setLights: (enabled: boolean) =>
    request<VesselControlsState>("/api/vessel/lights", {
      method: "POST",
      body: JSON.stringify({ enabled }),
    }),
  configureAscent: (config: AscentConfig) =>
    request<AscentStatus>("/api/ascent/configure", {
      method: "POST",
      body: JSON.stringify(config),
    }),
  startAscent: (config: AscentConfig) =>
    request<AscentStatus>("/api/ascent/start", {
      method: "POST",
      body: JSON.stringify(config),
    }),
  launchToTargetPlane: (config: AscentConfig) =>
    request<AscentStatus>("/api/ascent/launch-to-target-plane", {
      method: "POST",
      body: JSON.stringify({ config }),
    }),
  abortAscent: () =>
    request<AscentStatus>("/api/ascent/abort", { method: "POST" }),
  ascentStatus: () => request<AscentStatus>("/api/ascent/status"),
  ascentLive: () => request<AscentConfig>("/api/ascent/live"),
  targetTree: () => request<TargetTree>("/api/targets/tree"),
  targetCurrent: () => request<TargetStatus>("/api/targets/current"),
  selectTarget: (id: string) =>
    request<TargetStatus>("/api/targets/select", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  clearTarget: () =>
    request<TargetStatus>("/api/targets/clear", { method: "POST" }),
  maneuverOperations: () =>
    request<ManeuverOperationSpec[]>("/api/maneuver/operations"),
  maneuverNodes: () => request<ManeuverNodeSummary[]>("/api/maneuver/nodes"),
  setNodeTolerance: (nodeIndex: number, tolerance_ms: number) =>
    request<ManeuverNodeSummary>(`/api/maneuver/nodes/${nodeIndex}/tolerance`, {
      method: "PATCH",
      body: JSON.stringify({ tolerance_ms }),
    }),
  setDefaultNodeTolerance: (tolerance_ms: number) =>
    request<{ default_tolerance_ms: number }>("/api/maneuver/nodes/default-tolerance", {
      method: "PUT",
      body: JSON.stringify({ tolerance_ms }),
    }),
  planManeuver: (body: ManeuverPlanRequest) =>
    request<ManeuverPlanResult>("/api/maneuver/plan", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  fineTunePreview: (nodeIndex = 0) =>
    request<ManeuverFineTunePreview>(
      `/api/maneuver/fine-tune/preview?node_index=${nodeIndex}`
    ),
  fineTuneManeuver: (body: ManeuverFineTuneRequest) =>
    request<ManeuverFineTuneResult>("/api/maneuver/fine-tune", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  clearManeuverNodes: () =>
    request<{ removed: number }>("/api/maneuver/nodes", { method: "DELETE" }),
  executeManeuver: (body?: ManeuverExecuteRequest) =>
    request<ManeuverStatus>("/api/maneuver/execute", {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    }),
  abortManeuver: () =>
    request<ManeuverStatus>("/api/maneuver/abort", { method: "POST" }),
  maneuverStatus: () => request<ManeuverStatus>("/api/maneuver/status"),
  cameras: () => request<CameraListResponse>("/api/cameras"),
};
