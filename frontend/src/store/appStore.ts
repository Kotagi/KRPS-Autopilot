import { create } from "zustand";

import type {
  AscentStatus,
  ConnectionStatus,
  ManeuverStatus,
  StageFuelSnapshot,
  TargetStatus,
  VesselControlsState,
  VesselDeltaV,
  VesselTelemetry,
} from "../api/types";

interface AppState {
  connection: ConnectionStatus;
  controls: VesselControlsState | null;
  telemetry: VesselTelemetry | null;
  deltaV: VesselDeltaV | null;
  stageResources: StageFuelSnapshot | null;
  maneuver: ManeuverStatus | null;
  ascent: AscentStatus | null;
  target: TargetStatus | null;
  wsConnected: boolean;
  lastError: string | null;
  setConnection: (status: ConnectionStatus) => void;
  setControls: (controls: VesselControlsState) => void;
  setTelemetry: (telemetry: VesselTelemetry) => void;
  setDeltaV: (deltaV: VesselDeltaV) => void;
  setStageResources: (snapshot: StageFuelSnapshot) => void;
  setManeuver: (status: ManeuverStatus) => void;
  setAscent: (ascent: AscentStatus) => void;
  setTarget: (target: TargetStatus) => void;
  setWsConnected: (connected: boolean) => void;
  setLastError: (message: string | null) => void;
}

const defaultConnection: ConnectionStatus = {
  connected: false,
  api_ready: false,
  vessel_name: null,
  situation: null,
  scene: "unknown",
};

export const useAppStore = create<AppState>((set) => ({
  connection: defaultConnection,
  controls: null,
  telemetry: null,
  deltaV: null,
  stageResources: null,
  maneuver: null,
  ascent: null,
  target: null,
  wsConnected: false,
  lastError: null,
  setConnection: (connection) => set({ connection }),
  setControls: (controls) => set({ controls }),
  setTelemetry: (telemetry) => set({ telemetry }),
  setDeltaV: (deltaV) => set({ deltaV }),
  setStageResources: (stageResources) => set({ stageResources }),
  setManeuver: (maneuver) => set({ maneuver }),
  setAscent: (ascent) => set({ ascent }),
  setTarget: (target) => set({ target }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setLastError: (lastError) => set({ lastError }),
}));
