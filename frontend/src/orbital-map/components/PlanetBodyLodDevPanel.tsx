import { useViewStore } from "../store/viewStore";

/** Dev HUD: force Map V3 planet body icon vs mesh LOD (mutually exclusive; auto = zoom). */
export function PlanetBodyLodDevPanel() {
  const override = useViewStore((s) => s.devPlanetBodyLodOverride);
  const setOverride = useViewStore((s) => s.setDevPlanetBodyLodOverride);
  const renderMode = useViewStore((s) => s.solarRenderMode);
  const v3 = renderMode === "3d-v3";

  const forceIcon = override === "icon";
  const forceMesh = override === "mesh";

  return (
    <div className="ksp-solar-customize-map-dev">
      <span className="ksp-solar-customize-map-dev-toggle">Dev: planet body LOD</span>
      <label className="ksp-solar-customize-map-dev-toggle">
        <input
          type="checkbox"
          checked={forceIcon}
          disabled={!v3}
          onChange={(e) => setOverride(e.target.checked ? "icon" : "auto")}
        />
        Force dot
      </label>
      <label className="ksp-solar-customize-map-dev-toggle">
        <input
          type="checkbox"
          checked={forceMesh}
          disabled={!v3}
          onChange={(e) => setOverride(e.target.checked ? "mesh" : "auto")}
        />
        Force mesh
      </label>
      {!v3 ? (
        <span className="ksp-solar-customize-map-dev-hint">
          Switch render mode to <strong>3d-v3</strong> to use these overrides.
        </span>
      ) : override === "auto" ? (
        <span className="ksp-solar-customize-map-dev-hint">
          Auto — fixed orbit-color dot when the mesh would be smaller on screen; mesh when larger.
        </span>
      ) : (
        <span className="ksp-solar-customize-map-dev-hint">
          Forced <strong>{override === "icon" ? "dot" : override}</strong> on all V3 planet bodies.
        </span>
      )}
    </div>
  );
}
