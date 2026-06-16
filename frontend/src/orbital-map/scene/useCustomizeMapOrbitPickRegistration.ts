import { useEffect } from "react";
import { registerCustomizeMapOrbitPickLines } from "../selection/customizeMapOrbitPickRegistry";
import type { OrbitPickLine } from "../selection/pickOrbitTrail";
import { useViewStore } from "../store/viewStore";

function buildOrbitPickLines(
  trails: { bodyName?: string; points: OrbitPickLine["points"] }[],
): OrbitPickLine[] {
  return trails
    .filter((t) => t.bodyName && t.points.length >= 2)
    .map((t) => ({
      bodyName: t.bodyName!,
      points: t.points,
    }));
}

/** Register orbit trail segments for Customize Map ray picking (per layer source). */
export function useCustomizeMapOrbitPickRegistration(
  sourceId: string,
  trails: { bodyName?: string; points: OrbitPickLine["points"] }[],
  layerActive: boolean,
): void {
  const customizeEnabled = useViewStore((s) => s.devCustomizeMapEnabled);

  useEffect(() => {
    if (!layerActive || !customizeEnabled) {
      registerCustomizeMapOrbitPickLines(sourceId, []);
      return () => registerCustomizeMapOrbitPickLines(sourceId, []);
    }

    registerCustomizeMapOrbitPickLines(sourceId, buildOrbitPickLines(trails));

    return () => registerCustomizeMapOrbitPickLines(sourceId, []);
  }, [layerActive, customizeEnabled, sourceId, trails]);
}
