import { create } from "zustand";
import type { TelemetrySnapshot, Vector3 } from "../telemetry/schema-v6";
import {
  buildSolarSystemModel,
  type SolarSystemModel,
} from "../model/buildSolarSystemModel";
import type { QualityPreset } from "../settings/qualityStore";
import type { SelectionDetail } from "../selection/types";
import type { MoonVisibilityReason } from "../scene/moonVisibility";
import {
  getStockPlanetOrbitColor,
  loadCustomizeMapDev,
  normalizeHexColor,
  persistCustomizeMapDev,
} from "../settings/customizeMapDev";
import type { PlanetOrbitPickLine } from "../selection/pickPlanetOrbitTrail";
import type { PlanetBodyLodDevOverride } from "../map-v3/elements/planetBody/planetBodyLod";

const customizeMapInitial = loadCustomizeMapDev();

function persistCustomizeFromState(state: {
  devCustomizeMapEnabled: boolean;
  customizeMapSelectedPlanet: string | null;
  planetOrbitColorOverrides: Record<string, string>;
  planetOrbitStockDefaults: Record<string, string>;
}): void {
  persistCustomizeMapDev(
    state.devCustomizeMapEnabled,
    state.customizeMapSelectedPlanet,
    state.planetOrbitColorOverrides,
    state.planetOrbitStockDefaults,
  );
}

export interface MoonLodDebugState {
  reason: MoonVisibilityReason;
  activeHostPlanet: string | null;
  visibleCount: number;
  label: string;
}

export type CameraMode =
  | "fullSystem"
  | "activeVessel"
  | "currentReferenceBody"
  | "encounterBody"
  | "route"
  | "bodyFocus";

export type SolarRenderMode = "3d" | "2d" | "3d-v2" | "3d-v3";

interface ViewState {
  telemetry: TelemetrySnapshot | null;
  model: SolarSystemModel | null;
  cameraMode: CameraMode;
  displayScale: number;
  focusBodyName: string | null;
  /** Camera mode to restore when leaving body focus (click unfocus). */
  cameraModeBeforeBodyFocus: CameraMode | null;
  scrubEnabled: boolean;
  scrubUniversalTime: number | null;
  solarRenderMode: SolarRenderMode;
  selectedObjectId: string | null;
  selectionDetail: SelectionDetail | null;
  hoverObjectId: string | null;
  userInteractedCamera: boolean;
  qualityPreset: QualityPreset;
  cameraFitNonce: number;
  solarFullscreen: boolean;
  vesselDisplayPosition: Vector3 | null;
  vesselTargetPosition: Vector3 | null;
  moonLodDebug: MoonLodDebugState | null;
  /** Dev HUD: customize planet orbit colors (click orbit to select). */
  devCustomizeMapEnabled: boolean;
  customizeMapSelectedPlanet: string | null;
  planetOrbitColorOverrides: Record<string, string>;
  /** Dev “Set color” defaults (persisted; used even when Customize Map is off). */
  planetOrbitStockDefaults: Record<string, string>;
  customizeMapOrbitPickLines: PlanetOrbitPickLine[];
  /** Dev HUD: force Map V3 planet bodies icon vs mesh LOD (auto = zoom-based). */
  devPlanetBodyLodOverride: PlanetBodyLodDevOverride;
  devPlanetBodySpinAxisVisible: boolean;
  devPlanetBodySpinDiagnostics: boolean;
  /** Buffer Kerbin orientation samples for spin chirality diagnostic. */
  devPlanetBodySpinChiralityCollect: boolean;
  setDevPlanetBodySpinAxisVisible: (visible: boolean) => void;
  setDevPlanetBodySpinDiagnostics: (enabled: boolean) => void;
  setDevPlanetBodySpinChiralityCollect: (enabled: boolean) => void;
  setDevPlanetBodyLodOverride: (override: PlanetBodyLodDevOverride) => void;
  setDevCustomizeMapEnabled: (enabled: boolean) => void;
  setCustomizeMapSelectedPlanet: (planet: string | null) => void;
  setPlanetOrbitColorOverride: (planet: string, hex: string) => void;
  setPlanetOrbitStockDefault: (planet: string) => void;
  resetPlanetOrbitColorToStock: (planet: string) => void;
  resetAllPlanetOrbitColorsToStock: () => void;
  setCustomizeMapOrbitPickLines: (lines: PlanetOrbitPickLine[]) => void;
  setMoonLodDebug: (debug: MoonLodDebugState | null) => void;
  setTelemetry: (telemetry: TelemetrySnapshot | null) => void;
  setCameraMode: (mode: CameraMode) => void;
  setDisplayScale: (scale: number) => void;
  setFocusBodyName: (name: string | null) => void;
  focusOnBody: (bodyName: string) => void;
  unfocusBody: () => void;
  setScrubEnabled: (enabled: boolean) => void;
  setScrubUniversalTime: (ut: number | null) => void;
  setSolarRenderMode: (mode: SolarRenderMode) => void;
  setSelectedObjectId: (id: string | null) => void;
  setSelectionDetail: (detail: SelectionDetail | null) => void;
  setHoverObjectId: (id: string | null) => void;
  setUserInteractedCamera: (value: boolean) => void;
  setQualityPreset: (preset: QualityPreset) => void;
  requestCameraFit: () => void;
  setSolarFullscreen: (enabled: boolean) => void;
  toggleSolarFullscreen: () => void;
  recenter: () => void;
  resetView: () => void;
  rebuildModel: () => void;
}

function rebuild(
  telemetry: TelemetrySnapshot | null,
  scrubEnabled: boolean,
  scrubUniversalTime: number | null,
): SolarSystemModel | null {
  if (!telemetry) {
    return null;
  }
  return buildSolarSystemModel(telemetry, { scrubEnabled, scrubUniversalTime });
}

function focusForMode(
  model: SolarSystemModel | null,
  mode: CameraMode,
  bodyFocusTarget: string | null = null,
): string | null {
  if (!model) {
    return null;
  }
  if (mode === "bodyFocus" && bodyFocusTarget) {
    return bodyFocusTarget;
  }
  if (mode === "currentReferenceBody" && model.referenceBody) {
    return model.referenceBody;
  }
  if (mode === "encounterBody" && model.encounterBody) {
    return model.encounterBody;
  }
  if (mode === "activeVessel" && model.referenceBody) {
    return model.referenceBody;
  }
  return null;
}

function resolveFocusBodyName(
  model: SolarSystemModel | null,
  cameraMode: CameraMode,
  bodyFocusTarget: string | null,
): string | null {
  return focusForMode(model, cameraMode, bodyFocusTarget);
}

export const useViewStore = create<ViewState>((set, get) => ({
  telemetry: null,
  model: null,
  cameraMode: "fullSystem",
  displayScale: 1e-9,
  focusBodyName: null,
  cameraModeBeforeBodyFocus: null,
  scrubEnabled: false,
  scrubUniversalTime: null,
  solarRenderMode: "3d-v3",
  selectedObjectId: null,
  selectionDetail: null,
  hoverObjectId: null,
  userInteractedCamera: false,
  qualityPreset: "medium",
  cameraFitNonce: 0,
  solarFullscreen: false,
  vesselDisplayPosition: null,
  vesselTargetPosition: null,
  moonLodDebug: null,
  devCustomizeMapEnabled: customizeMapInitial.enabled,
  customizeMapSelectedPlanet: customizeMapInitial.selectedPlanet,
  planetOrbitColorOverrides: customizeMapInitial.overrides,
  planetOrbitStockDefaults: customizeMapInitial.stockDefaults,
  customizeMapOrbitPickLines: [],
  devPlanetBodyLodOverride: "auto",
  setDevPlanetBodyLodOverride: (devPlanetBodyLodOverride) =>
    set({ devPlanetBodyLodOverride }),
  devPlanetBodySpinAxisVisible: false,
  devPlanetBodySpinDiagnostics: false,
  devPlanetBodySpinChiralityCollect: false,
  setDevPlanetBodySpinAxisVisible: (devPlanetBodySpinAxisVisible) =>
    set({ devPlanetBodySpinAxisVisible }),
  setDevPlanetBodySpinDiagnostics: (devPlanetBodySpinDiagnostics) =>
    set({ devPlanetBodySpinDiagnostics }),
  setDevPlanetBodySpinChiralityCollect: (devPlanetBodySpinChiralityCollect) =>
    set({ devPlanetBodySpinChiralityCollect }),
  setDevCustomizeMapEnabled: (enabled) => {
    const next = {
      devCustomizeMapEnabled: enabled,
      customizeMapSelectedPlanet: get().customizeMapSelectedPlanet,
      planetOrbitColorOverrides: get().planetOrbitColorOverrides,
      planetOrbitStockDefaults: get().planetOrbitStockDefaults,
    };
    persistCustomizeFromState(next);
    set({ devCustomizeMapEnabled: enabled });
  },
  setCustomizeMapSelectedPlanet: (planet) => {
    const next = {
      devCustomizeMapEnabled: get().devCustomizeMapEnabled,
      customizeMapSelectedPlanet: planet,
      planetOrbitColorOverrides: get().planetOrbitColorOverrides,
      planetOrbitStockDefaults: get().planetOrbitStockDefaults,
    };
    persistCustomizeFromState(next);
    set({ customizeMapSelectedPlanet: planet });
  },
  setPlanetOrbitColorOverride: (planet, hex) => {
    const normalized = normalizeHexColor(hex);
    if (!normalized) {
      return;
    }
    const overrides = {
      ...get().planetOrbitColorOverrides,
      [planet]: normalized,
    };
    const next = {
      devCustomizeMapEnabled: get().devCustomizeMapEnabled,
      customizeMapSelectedPlanet: planet,
      planetOrbitColorOverrides: overrides,
      planetOrbitStockDefaults: get().planetOrbitStockDefaults,
    };
    persistCustomizeFromState(next);
    set({
      customizeMapSelectedPlanet: planet,
      planetOrbitColorOverrides: overrides,
    });
  },
  setPlanetOrbitStockDefault: (planet) => {
    const { planetOrbitColorOverrides, planetOrbitStockDefaults } = get();
    const hex = normalizeHexColor(
      planetOrbitColorOverrides[planet] ??
        getStockPlanetOrbitColor(planet, planetOrbitStockDefaults),
    );
    if (!hex) {
      return;
    }
    const stockDefaults = { ...planetOrbitStockDefaults, [planet]: hex };
    const overrides = { ...planetOrbitColorOverrides };
    delete overrides[planet];
    const next = {
      devCustomizeMapEnabled: get().devCustomizeMapEnabled,
      customizeMapSelectedPlanet: planet,
      planetOrbitColorOverrides: overrides,
      planetOrbitStockDefaults: stockDefaults,
    };
    persistCustomizeFromState(next);
    set({
      customizeMapSelectedPlanet: planet,
      planetOrbitColorOverrides: overrides,
      planetOrbitStockDefaults: stockDefaults,
    });
  },
  resetPlanetOrbitColorToStock: (planet) => {
    const overrides = { ...get().planetOrbitColorOverrides };
    delete overrides[planet];
    const stockDefaults = { ...get().planetOrbitStockDefaults };
    delete stockDefaults[planet];
    const next = {
      devCustomizeMapEnabled: get().devCustomizeMapEnabled,
      customizeMapSelectedPlanet: get().customizeMapSelectedPlanet,
      planetOrbitColorOverrides: overrides,
      planetOrbitStockDefaults: stockDefaults,
    };
    persistCustomizeFromState(next);
    set({ planetOrbitColorOverrides: overrides, planetOrbitStockDefaults: stockDefaults });
  },
  resetAllPlanetOrbitColorsToStock: () => {
    const next = {
      devCustomizeMapEnabled: get().devCustomizeMapEnabled,
      customizeMapSelectedPlanet: get().customizeMapSelectedPlanet,
      planetOrbitColorOverrides: {},
      planetOrbitStockDefaults: {},
    };
    persistCustomizeFromState(next);
    set({ planetOrbitColorOverrides: {}, planetOrbitStockDefaults: {} });
  },
  setCustomizeMapOrbitPickLines: (lines) =>
    set({ customizeMapOrbitPickLines: lines }),
  setMoonLodDebug: (moonLodDebug) => set({ moonLodDebug }),
  setTelemetry: (telemetry) => {
    const { scrubEnabled, scrubUniversalTime, vesselDisplayPosition } = get();
    const model = rebuild(telemetry, scrubEnabled, scrubUniversalTime);
    const nextTarget = model?.vesselPosition ?? null;
    set({
      telemetry,
      model,
      vesselTargetPosition: nextTarget,
      vesselDisplayPosition: vesselDisplayPosition ?? nextTarget,
      focusBodyName: resolveFocusBodyName(
        model,
        get().cameraMode,
        get().cameraMode === "bodyFocus" ? get().focusBodyName : null,
      ),
    });
  },
  setCameraMode: (cameraMode) => {
    const { model } = get();
    set({
      cameraMode,
      cameraModeBeforeBodyFocus: null,
      focusBodyName: resolveFocusBodyName(model, cameraMode, null),
      userInteractedCamera: false,
      cameraFitNonce: get().cameraFitNonce + 1,
    });
  },
  setDisplayScale: (displayScale) => set({ displayScale }),
  setFocusBodyName: (focusBodyName) => set({ focusBodyName }),
  focusOnBody: (bodyName) => {
    const { model, cameraMode, cameraModeBeforeBodyFocus } = get();
    if (!model?.bodies.some((b) => b.body.name === bodyName)) {
      return;
    }
    const restoreMode =
      cameraMode !== "bodyFocus" ? cameraMode : cameraModeBeforeBodyFocus;
    set({
      cameraMode: "bodyFocus",
      cameraModeBeforeBodyFocus: restoreMode ?? "fullSystem",
      focusBodyName: bodyName,
      userInteractedCamera: false,
      cameraFitNonce: get().cameraFitNonce + 1,
    });
  },
  unfocusBody: () => {
    const { model, cameraModeBeforeBodyFocus } = get();
    const restore = cameraModeBeforeBodyFocus ?? "fullSystem";
    set({
      cameraMode: restore,
      cameraModeBeforeBodyFocus: null,
      focusBodyName: resolveFocusBodyName(model, restore, null),
      userInteractedCamera: false,
      cameraFitNonce: get().cameraFitNonce + 1,
    });
  },
  setScrubEnabled: (scrubEnabled) => {
    set({ scrubEnabled });
    get().rebuildModel();
  },
  setScrubUniversalTime: (scrubUniversalTime) => {
    set({ scrubUniversalTime });
    get().rebuildModel();
  },
  setSolarRenderMode: (solarRenderMode) => set({ solarRenderMode }),
  setSelectedObjectId: (selectedObjectId) => set({ selectedObjectId }),
  setSelectionDetail: (selectionDetail) =>
    set({
      selectionDetail,
      selectedObjectId: selectionDetail?.id ?? null,
    }),
  setHoverObjectId: (hoverObjectId) => set({ hoverObjectId }),
  setUserInteractedCamera: (userInteractedCamera) => set({ userInteractedCamera }),
  setQualityPreset: (qualityPreset) => set({ qualityPreset }),
  requestCameraFit: () => set({ cameraFitNonce: get().cameraFitNonce + 1 }),
  setSolarFullscreen: (solarFullscreen) => {
    if (!solarFullscreen && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    set({
      solarFullscreen,
      userInteractedCamera: solarFullscreen ? false : get().userInteractedCamera,
      cameraFitNonce: get().cameraFitNonce + 1,
    });
  },
  toggleSolarFullscreen: () => {
    get().setSolarFullscreen(!get().solarFullscreen);
  },
  recenter: () => {
    set({
      userInteractedCamera: false,
      cameraFitNonce: get().cameraFitNonce + 1,
    });
  },
  resetView: () => {
    set({
      cameraMode: "fullSystem",
      cameraModeBeforeBodyFocus: null,
      focusBodyName: null,
      userInteractedCamera: false,
      cameraFitNonce: get().cameraFitNonce + 1,
    });
  },
  rebuildModel: () => {
    const { telemetry, scrubEnabled, scrubUniversalTime, cameraMode, focusBodyName } =
      get();
    const model = rebuild(telemetry, scrubEnabled, scrubUniversalTime);
    const bodyFocusTarget = cameraMode === "bodyFocus" ? focusBodyName : null;
    set({
      model,
      focusBodyName: resolveFocusBodyName(model, cameraMode, bodyFocusTarget),
    });
  },
}));
