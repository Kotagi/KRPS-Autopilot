import { useViewStore } from "../store/viewStore";
import { normalizeHexColor } from "../settings/customizeMapDev";
import {
  DEFAULT_BODY_MAP_COLOR,
  KSP_BODY_MAP_COLORS,
} from "./kspBodyMapColorTable";

export { KSP_BODY_MAP_COLORS, DEFAULT_BODY_MAP_COLOR };

function planetOrbitColorFromCustomizeMap(bodyName: string): string | null {
  const {
    devCustomizeMapEnabled,
    planetOrbitColorOverrides,
  } = useViewStore.getState();
  if (!devCustomizeMapEnabled) {
    return null;
  }
  const override = planetOrbitColorOverrides[bodyName];
  if (!override) {
    return null;
  }
  return normalizeHexColor(override) ?? override;
}

function effectiveStockColor(bodyName: string): string {
  const { planetOrbitStockDefaults } = useViewStore.getState();
  const customDefault = planetOrbitStockDefaults[bodyName];
  if (customDefault) {
    return normalizeHexColor(customDefault) ?? customDefault;
  }
  return KSP_BODY_MAP_COLORS[bodyName] ?? DEFAULT_BODY_MAP_COLOR;
}

export function getKspBodyMapColor(bodyName: string | undefined): string {
  if (!bodyName) {
    return DEFAULT_BODY_MAP_COLOR;
  }
  const custom = planetOrbitColorFromCustomizeMap(bodyName);
  if (custom) {
    return custom;
  }
  return effectiveStockColor(bodyName);
}

/**
 * Subscribe in trail layers so orbit colors update live when Customize Map changes.
 */
export function useKspBodyMapColor(bodyName: string | undefined): string {
  const enabled = useViewStore((s) => s.devCustomizeMapEnabled);
  const overrides = useViewStore((s) => s.planetOrbitColorOverrides);
  const stockDefaults = useViewStore((s) => s.planetOrbitStockDefaults);
  if (!bodyName) {
    return DEFAULT_BODY_MAP_COLOR;
  }
  if (enabled && overrides[bodyName]) {
    return normalizeHexColor(overrides[bodyName]) ?? overrides[bodyName];
  }
  const customDefault = stockDefaults[bodyName];
  if (customDefault) {
    return normalizeHexColor(customDefault) ?? customDefault;
  }
  return KSP_BODY_MAP_COLORS[bodyName] ?? DEFAULT_BODY_MAP_COLOR;
}
