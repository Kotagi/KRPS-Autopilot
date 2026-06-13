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
import type { MapV3LayerFlags } from "./layerFlags";
import { MAP_V3_LAYERS_PHASE0 } from "./layerFlags";
import { composeMapV3Layers } from "./MapComposer";

export interface MapV3ContextValue {
  mapContext: MapContext | null;
  sceneFrame: SceneFrameState;
  layers: MapV3LayerFlags;
  /** Active layer component ids for current flags. */
  activeLayerIds: string[];
  visibleMoonNames: Set<string>;
  visibleMoonKey: string;
  moonLodReason: string;
  activeHostPlanet: string | null;
  hostPlanetOpen: boolean;
}

const MapV3Ctx = createContext<MapV3ContextValue | null>(null);

export function MapV3Provider({
  children,
  layerFlags = MAP_V3_LAYERS_PHASE0,
}: {
  children: ReactNode;
  layerFlags?: MapV3LayerFlags;
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

  const activeLayerIds = useMemo(
    () => composeMapV3Layers(layerFlags),
    [layerFlags],
  );

  const value = useMemo<MapV3ContextValue>(
    () => ({
      mapContext,
      sceneFrame,
      layers: layerFlags,
      activeLayerIds,
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
      activeLayerIds,
      visibleMoonNames,
      visibleMoonKey,
      moonCtx.reason,
      moonCtx.activeHostPlanet,
      moonCtx.hostPlanetOpen,
    ],
  );

  return <MapV3Ctx.Provider value={value}>{children}</MapV3Ctx.Provider>;
}

export function useMapV3(): MapV3ContextValue {
  const ctx = useContext(MapV3Ctx);
  if (!ctx) {
    throw new Error("useMapV3 must be used within MapV3Provider");
  }
  return ctx;
}
