import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useViewStore } from "../store/viewStore";
import { useMoonVisibilityContext } from "../scene/MoonVisibilityContext";
import { buildMapContext, type MapContext } from "./MapContext";
import type { SceneFrameState } from "./types";
import type { MapV2LayerFlags } from "./layerFlags";
import { MAP_V2_LAYERS_ALL } from "./layerFlags";

export interface MapV2ContextValue {
  mapContext: MapContext | null;
  sceneFrame: SceneFrameState;
  layers: MapV2LayerFlags;
  visibleMoonNames: Set<string>;
  /** Stable key so orbit layers do not rebuild every camera frame. */
  visibleMoonKey: string;
  moonLodReason: string;
  activeHostPlanet: string | null;
  hostPlanetOpen: boolean;
}

const MapV2Ctx = createContext<MapV2ContextValue | null>(null);

export function MapV2Provider({
  children,
  layerFlags = MAP_V2_LAYERS_ALL,
}: {
  children: ReactNode;
  layerFlags?: MapV2LayerFlags;
}) {
  const telemetry = useViewStore((s) => s.telemetry);
  const displayScale = useViewStore((s) => s.displayScale);
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const cameraMode = useViewStore((s) => s.cameraMode);

  const moonCtx = useMoonVisibilityContext();

  const mapContext = useMemo(
    () => buildMapContext(telemetry),
    [telemetry],
  );

  const focusMode =
    cameraMode === "bodyFocus" && focusBodyName ? "body" : "system";

  const focusX = moonCtx.displayFocus?.x;
  const focusY = moonCtx.displayFocus?.y;
  const focusZ = moonCtx.displayFocus?.z;

  const sceneFrame = useMemo((): SceneFrameState => {
    return {
      focusMode,
      focusBodyName,
      focus: moonCtx.displayFocus,
      displayScale: displayScale > 0 ? displayScale : 1e-9,
    };
  }, [focusMode, focusBodyName, focusX, focusY, focusZ, displayScale]);

  const visibleMoonKey = [...moonCtx.visibleBodyNames].sort().join("|");

  const visibleMoonNames = useMemo(() => {
    if (!mapContext) {
      return new Set<string>();
    }
    const moons = new Set<string>();
    mapContext.hierarchy.planetNames.forEach((planet) => {
      const children = mapContext.hierarchy.moonsByPlanet[planet] ?? [];
      children.forEach((name) => {
        if (moonCtx.visibleBodyNames.has(name)) {
          moons.add(name);
        }
      });
    });
    return moons;
  }, [mapContext, visibleMoonKey]);

  const value = useMemo<MapV2ContextValue>(
    () => ({
      mapContext,
      sceneFrame,
      layers: layerFlags,
      visibleMoonNames,
      visibleMoonKey,
      moonLodReason: moonCtx.reason,
      activeHostPlanet: moonCtx.activeHostPlanet,
      hostPlanetOpen: moonCtx.hostPlanetOpen,
    }),
    [
      mapContext,
      sceneFrame,
      layerFlags,
      visibleMoonNames,
      visibleMoonKey,
      moonCtx.reason,
      moonCtx.activeHostPlanet,
      moonCtx.hostPlanetOpen,
    ],
  );

  return <MapV2Ctx.Provider value={value}>{children}</MapV2Ctx.Provider>;
}

export function useMapV2(): MapV2ContextValue {
  const ctx = useContext(MapV2Ctx);
  if (!ctx) {
    throw new Error("useMapV2 must be used within MapV2Provider");
  }
  return ctx;
}
