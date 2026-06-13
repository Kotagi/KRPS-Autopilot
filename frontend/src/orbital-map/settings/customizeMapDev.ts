import {
  DEFAULT_BODY_MAP_COLOR,
  KSP_BODY_MAP_COLORS,
} from "../scene/kspBodyMapColorTable";

const LS_ENABLED = "ksp-web-map-dev-customize-map";
const LS_OVERRIDES = "ksp-web-map-dev-planet-orbit-colors";
const LS_STOCK_DEFAULTS = "ksp-web-map-dev-planet-orbit-stock-defaults";
const LS_SELECTED = "ksp-web-map-dev-customize-selected-planet";
/** Legacy single-planet picker */
const LS_LEGACY_ENABLED = "ksp-web-map-dev-duna-orbit-picker";
const LS_LEGACY_COLOR = "ksp-web-map-dev-duna-orbit-color";

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const match = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  return `#${match[1].toLowerCase()}`;
}

/** Shipped table entry (ignores dev “Set color” defaults). */
export function getShippedPlanetOrbitColor(bodyName: string): string {
  return KSP_BODY_MAP_COLORS[bodyName] ?? DEFAULT_BODY_MAP_COLOR;
}

/** Effective default: shipped color, then dev-persisted default from Customize Map. */
export function getStockPlanetOrbitColor(
  bodyName: string,
  stockDefaults: Record<string, string> = {},
): string {
  const customDefault = stockDefaults[bodyName];
  if (customDefault) {
    return normalizeHexColor(customDefault) ?? customDefault;
  }
  return getShippedPlanetOrbitColor(bodyName);
}

function parseColorRecord(raw: string | null): Record<string, string> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [name, hex] of Object.entries(parsed)) {
      const norm = normalizeHexColor(hex);
      if (norm) {
        out[name] = norm;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function loadCustomizeMapDev(): {
  enabled: boolean;
  selectedPlanet: string | null;
  overrides: Record<string, string>;
  stockDefaults: Record<string, string>;
} {
  try {
    let enabled = localStorage.getItem(LS_ENABLED) === "1";
    let overrides = parseColorRecord(localStorage.getItem(LS_OVERRIDES));
    const stockDefaults = parseColorRecord(
      localStorage.getItem(LS_STOCK_DEFAULTS),
    );
    if (!enabled && localStorage.getItem(LS_LEGACY_ENABLED) === "1") {
      enabled = true;
      const legacy = normalizeHexColor(localStorage.getItem(LS_LEGACY_COLOR) ?? "");
      if (legacy) {
        overrides.Duna = legacy;
      }
    }
    const selected = localStorage.getItem(LS_SELECTED);
    return {
      enabled,
      selectedPlanet: selected && selected.length > 0 ? selected : null,
      overrides,
      stockDefaults,
    };
  } catch {
    return {
      enabled: false,
      selectedPlanet: null,
      overrides: {},
      stockDefaults: {},
    };
  }
}

export function persistCustomizeMapDev(
  enabled: boolean,
  selectedPlanet: string | null,
  overrides: Record<string, string>,
  stockDefaults: Record<string, string>,
): void {
  try {
    localStorage.setItem(LS_ENABLED, enabled ? "1" : "0");
    localStorage.setItem(LS_SELECTED, selectedPlanet ?? "");
    localStorage.setItem(LS_OVERRIDES, JSON.stringify(overrides));
    localStorage.setItem(LS_STOCK_DEFAULTS, JSON.stringify(stockDefaults));
  } catch {
    /* ignore */
  }
}
