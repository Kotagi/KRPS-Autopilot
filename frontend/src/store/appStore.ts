import { create } from "zustand";

import type {
  AscentStatus,
  ConnectionStatus,
  ManeuverStatus,
  NavballSourceStatus,
  StageFuelSnapshot,
  TargetStatus,
  VesselControlsState,
  VesselDeltaV,
  VesselTelemetry,
} from "../api/types";
import { navballTelemetryUnchanged } from "../debug/telemetryCompare";

interface AppState {
  connection: ConnectionStatus;
  controls: VesselControlsState | null;
  telemetry: VesselTelemetry | null;
  deltaV: VesselDeltaV | null;
  stageResources: StageFuelSnapshot | null;
  maneuver: ManeuverStatus | null;
  ascent: AscentStatus | null;
  target: TargetStatus | null;
  navballSource: NavballSourceStatus;
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
  setNavballSource: (status: NavballSourceStatus) => void;
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

const defaultNavballSource: NavballSourceStatus = {
  source: "krpc",
  krps_connected: false,
  krpc_connected: false,
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
  navballSource: defaultNavballSource,
  wsConnected: false,
  lastError: null,
  setConnection: (connection) => set({ connection }),
  setControls: (controls) => set({ controls }),
  setTelemetry: (telemetry) =>
    set((state) => {
      if (navballTelemetryUnchanged(state.telemetry, telemetry)) {
        return state;
      }
      return { telemetry };
    }),
  setDeltaV: (deltaV) => set({ deltaV }),
  setStageResources: (stageResources) => set({ stageResources }),
  setManeuver: (maneuver) => set({ maneuver }),
  setAscent: (ascent) => set({ ascent }),
  setTarget: (target) => set({ target }),
  setNavballSource: (navballSource) => set({ navballSource }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setLastError: (lastError) => set({ lastError }),
}));
