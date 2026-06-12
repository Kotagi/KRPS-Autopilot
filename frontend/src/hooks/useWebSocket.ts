import { useEffect } from "react";

import type {
  AscentStatus,
  ConnectionStatus,
  ManeuverStatus,
  StageFuelSnapshot,
  TargetStatus,
  VesselControlsState,
  VesselDeltaV,
  VesselTelemetry,
  NavballSourceStatus,
  WsEvent,
} from "../api/types";
import { telemetryClientDebug } from "../debug/telemetryClientDebug";
import { navballTelemetryUnchanged } from "../debug/telemetryCompare";
import { useAppStore } from "../store/appStore";

function wsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
}

export function useWebSocket() {
  const setConnection = useAppStore((s) => s.setConnection);
  const setControls = useAppStore((s) => s.setControls);
  const setTelemetry = useAppStore((s) => s.setTelemetry);
  const setDeltaV = useAppStore((s) => s.setDeltaV);
  const setStageResources = useAppStore((s) => s.setStageResources);
  const setManeuver = useAppStore((s) => s.setManeuver);
  const setAscent = useAppStore((s) => s.setAscent);
  const setTarget = useAppStore((s) => s.setTarget);
  const setNavballSource = useAppStore((s) => s.setNavballSource);
  const setWsConnected = useAppStore((s) => s.setWsConnected);
  const setLastError = useAppStore((s) => s.setLastError);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let closedByUser = false;

    const connect = () => {
      socket = new WebSocket(wsUrl());

      socket.onopen = () => {
        setWsConnected(true);
      };

      socket.onclose = () => {
        setWsConnected(false);
        if (!closedByUser) {
          reconnectTimer = window.setTimeout(connect, 2000);
        }
      };

      socket.onmessage = (event) => {
        let data: WsEvent;
        try {
          data = JSON.parse(event.data) as WsEvent;
        } catch {
          return;
        }
        switch (data.type) {
          case "connection":
            setConnection(data.payload as unknown as ConnectionStatus);
            break;
          case "vessel_controls":
            setControls(data.payload as unknown as VesselControlsState);
            break;
          case "telemetry": {
            const telemetry = data.payload as unknown as VesselTelemetry;
            const storeSkipped = navballTelemetryUnchanged(
              useAppStore.getState().telemetry,
              telemetry
            );
            telemetryClientDebug.recordTelemetryMessage(telemetry, { storeSkipped });
            setTelemetry(telemetry);
            break;
          }
          case "delta_v":
            setDeltaV(data.payload as unknown as VesselDeltaV);
            break;
          case "stage_resources":
            setStageResources(data.payload as unknown as StageFuelSnapshot);
            break;
          case "maneuver":
            setManeuver(data.payload as unknown as ManeuverStatus);
            break;
          case "ascent":
            setAscent(data.payload as unknown as AscentStatus);
            break;
          case "target":
            setTarget(data.payload as unknown as TargetStatus);
            break;
          case "navball_source":
            setNavballSource(data.payload as unknown as NavballSourceStatus);
            break;
          case "error":
            setLastError(
              String((data.payload as { message?: string }).message ?? "Error")
            );
            break;
        }
      };
    };

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [
    setAscent,
    setTarget,
    setNavballSource,
    setConnection,
    setControls,
    setDeltaV,
    setLastError,
    setStageResources,
    setManeuver,
    setTelemetry,
    setWsConnected,
  ]);
}
