import { useViewStore } from "../store/viewStore";
import {
  getStockPlanetOrbitColor,
  normalizeHexColor,
} from "../settings/customizeMapDev";

/** Dev HUD: customize planet/moon orbit colors (click orbit to select). */
export function CustomizeMapDevPanel() {
  const enabled = useViewStore((s) => s.devCustomizeMapEnabled);
  const selected = useViewStore((s) => s.customizeMapSelectedPlanet);
  const overrides = useViewStore((s) => s.planetOrbitColorOverrides);
  const stockDefaults = useViewStore((s) => s.planetOrbitStockDefaults);
  const setEnabled = useViewStore((s) => s.setDevCustomizeMapEnabled);
  const setPlanetColor = useViewStore((s) => s.setPlanetOrbitColorOverride);
  const setStockDefault = useViewStore((s) => s.setPlanetOrbitStockDefault);
  const resetPlanet = useViewStore((s) => s.resetPlanetOrbitColorToStock);
  const resetAll = useViewStore((s) => s.resetAllPlanetOrbitColorsToStock);

  const colorForPicker = selected
    ? (overrides[selected] ??
        getStockPlanetOrbitColor(selected, stockDefaults))
    : "#ffffff";
  const normalized = normalizeHexColor(colorForPicker) ?? "#ffffff";
  const hasUnsetPreview =
    !!selected &&
    !!overrides[selected] &&
    overrides[selected] !== (stockDefaults[selected] ?? "");

  const copyHex = () => {
    if (!selected) {
      return;
    }
    const hex =
      overrides[selected] ?? getStockPlanetOrbitColor(selected, stockDefaults);
    void navigator.clipboard?.writeText(hex);
  };

  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="ksp-solar-customize-map-dev">
      <label className="ksp-solar-customize-map-dev-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Dev: Customize Map
      </label>
      {enabled ? (
        <div className="ksp-solar-customize-map-dev-controls">
          <span className="ksp-solar-customize-map-dev-prompt">
            Click a <strong>planet or moon orbit</strong> ring on the map to edit its color.
            Moon rings appear when the host planet is in mesh LOD (zoomed in).
          </span>
          {selected ? (
            <>
              <span className="ksp-solar-customize-map-dev-selected">
                Selected: <strong>{selected}</strong>
              </span>
              <input
                type="color"
                value={normalized}
                onChange={(e) => setPlanetColor(selected, e.target.value)}
                title={`${selected} orbit color`}
                aria-label={`${selected} orbit color`}
              />
              <code className="ksp-solar-customize-map-dev-hex">{normalized}</code>
              <button
                type="button"
                onClick={() => setStockDefault(selected)}
                title="Save this color as the body default (persists in browser)"
              >
                Set color
              </button>
              <button type="button" onClick={() => resetPlanet(selected)}>
                Revert body
              </button>
              <button type="button" onClick={() => copyHex()}>
                Copy hex
              </button>
              {hasUnsetPreview ? (
                <span className="ksp-solar-customize-map-dev-hint">
                  Preview only — click <strong>Set color</strong> to save as default.
                </span>
              ) : null}
            </>
          ) : (
            <span className="ksp-solar-customize-map-dev-hint">
              No body selected — click a planet or moon orbit trail.
            </span>
          )}
          <button type="button" onClick={() => resetAll()}>
            Revert all bodies
          </button>
          {overrideCount > 0 || Object.keys(stockDefaults).length > 0 ? (
            <span className="ksp-solar-customize-map-dev-hint">
              {overrideCount > 0
                ? `${overrideCount} preview override${overrideCount === 1 ? "" : "s"}. `
                : null}
              {Object.keys(stockDefaults).length > 0
                ? `${Object.keys(stockDefaults).length} saved default${Object.keys(stockDefaults).length === 1 ? "" : "s"}. `
                : null}
              Copy hex into <code>kspBodyMapColorTable.ts</code> to ship in the mod.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
