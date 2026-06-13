import { useMemo, useState } from "react";
import type { CameraMode } from "../store/viewStore";
import { useViewStore } from "../store/viewStore";
import type { QualityPreset } from "../settings/qualityStore";
import { formatTrailValidation } from "../coords/buildBodyOrbitTrail";
import { CustomizeMapDevPanel } from "./CustomizeMapDevPanel";
import { PlanetBodyLodDevPanel } from "./PlanetBodyLodDevPanel";
import { PlanetBodyOrientationDevPanel } from "./PlanetBodyOrientationDevPanel";
import { MapHudV2 } from "./MapHudV2";
import { MapHudV3 } from "./MapHudV3";

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: "fullSystem", label: "Full system" },
  { id: "activeVessel", label: "Vessel" },
  { id: "currentReferenceBody", label: "Reference" },
  { id: "encounterBody", label: "Encounter" },
  { id: "route", label: "Route" },
];

const QUALITY_OPTIONS: { id: QualityPreset; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Med" },
  { id: "high", label: "High" },
];

export function MapHud() {
  const model = useViewStore((s) => s.model);
  const cameraMode = useViewStore((s) => s.cameraMode);
  const displayScale = useViewStore((s) => s.displayScale);
  const scrubEnabled = useViewStore((s) => s.scrubEnabled);
  const scrubUniversalTime = useViewStore((s) => s.scrubUniversalTime);
  const solarRenderMode = useViewStore((s) => s.solarRenderMode);
  const qualityPreset = useViewStore((s) => s.qualityPreset);
  const setCameraMode = useViewStore((s) => s.setCameraMode);
  const setDisplayScale = useViewStore((s) => s.setDisplayScale);
  const setScrubEnabled = useViewStore((s) => s.setScrubEnabled);
  const setScrubUniversalTime = useViewStore((s) => s.setScrubUniversalTime);
  const setSolarRenderMode = useViewStore((s) => s.setSolarRenderMode);
  const setQualityPreset = useViewStore((s) => s.setQualityPreset);
  const solarFullscreen = useViewStore((s) => s.solarFullscreen);
  const toggleSolarFullscreen = useViewStore((s) => s.toggleSolarFullscreen);
  const recenter = useViewStore((s) => s.recenter);
  const resetView = useViewStore((s) => s.resetView);
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const focusOnBody = useViewStore((s) => s.focusOnBody);
  const unfocusBody = useViewStore((s) => s.unfocusBody);
  const isBodyFocus = cameraMode === "bodyFocus";

  const utMin = model?.telemetry?.gameUniversalTimeSeconds ?? 0;
  const utMax = utMin + 86400 * 30;
  const classification = model?.telemetry?.orbit?.classification;
  const [showBodyOrbitQa, setShowBodyOrbitQa] = useState(false);
  const [showMoonLodDebug, setShowMoonLodDebug] = useState(true);
  const bodyOrbitPaths = model?.bodyOrbitPaths ?? [];
  const moonLodDebug = useViewStore((s) => s.moonLodDebug);
  const frameDiagnostics = model?.telemetry?.frameDiagnostics;
  const hierarchy = model?.hierarchy;

  const focusBodyOptions = useMemo(() => {
    if (!hierarchy) {
      return { star: [] as string[], planets: [] as string[], moonsByPlanet: [] as [string, string[]][] };
    }
    const star = hierarchy.rootBody ? [hierarchy.rootBody] : [];
    const moonsByPlanet = hierarchy.planetNames
      .map((planet) => [planet, hierarchy.moonsByPlanet[planet] ?? []] as [string, string[]])
      .filter(([, moons]) => moons.length > 0);
    return {
      star,
      planets: hierarchy.planetNames,
      moonsByPlanet,
    };
  }, [hierarchy]);

  return (
    <div className="ksp-solar-hud">
      {solarRenderMode === "3d-v2" ? <MapHudV2 /> : null}
      {solarRenderMode === "3d-v3" ? <MapHudV3 /> : null}
      <div className="ksp-solar-hud-row">
        <label>
          View{" "}
          <select
            value={solarRenderMode}
            onChange={(e) => {
              const mode = e.target.value as "3d" | "2d" | "3d-v2" | "3d-v3";
              setSolarRenderMode(mode);
            }}
          >
            <option value="3d">3D WebGL (v1)</option>
            <option value="3d-v2">3D Map V2</option>
            <option value="3d-v3">3D Map V3</option>
            <option value="2d">2D Canvas (legacy)</option>
          </select>
        </label>
        <label>
          Quality{" "}
          <select
            value={qualityPreset}
            onChange={(e) => setQualityPreset(e.target.value as QualityPreset)}
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Display scale{" "}
          <input
            type="range"
            min={6}
            max={12}
            step={0.1}
            value={Math.log10(displayScale)}
            onChange={(e) => setDisplayScale(10 ** Number(e.target.value))}
          />
          <span>{displayScale.toExponential(1)} m/unit</span>
        </label>
      </div>
      <div className="ksp-solar-hud-row">
        {CAMERA_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={cameraMode === mode.id ? "active" : ""}
            onClick={() => setCameraMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
        <button type="button" onClick={() => recenter()}>
          Recenter
        </button>
        <button type="button" onClick={() => resetView()}>
          Reset view
        </button>
        <label>
          Focus{" "}
          <select
            className="ksp-solar-focus-select"
            value={isBodyFocus && focusBodyName ? focusBodyName : ""}
            onChange={(e) => {
              const bodyName = e.target.value;
              if (!bodyName) {
                unfocusBody();
                return;
              }
              focusOnBody(bodyName);
            }}
            title="Focus camera on a body to inspect rendering up close"
          >
            <option value="">Full system</option>
            {focusBodyOptions.star.length > 0 ? (
              <optgroup label="Star">
                {focusBodyOptions.star.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {focusBodyOptions.planets.length > 0 ? (
              <optgroup label="Planets">
                {focusBodyOptions.planets.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {focusBodyOptions.moonsByPlanet.map(([planet, moons]) => (
              <optgroup key={planet} label={`Moons of ${planet}`}>
                {moons.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {isBodyFocus && focusBodyName ? (
          <button
            type="button"
            className="active ksp-solar-unfocus"
            onClick={() => unfocusBody()}
            title="Return to normal solar-system camera"
          >
            Unfocus {focusBodyName}
          </button>
        ) : null}
        <button
          type="button"
          className={solarFullscreen ? "active" : ""}
          onClick={() => toggleSolarFullscreen()}
          title={solarFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen solar map"}
        >
          {solarFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
      <div className="ksp-solar-hud-row">
        <label>
          <input
            type="checkbox"
            checked={scrubEnabled}
            onChange={(e) => setScrubEnabled(e.target.checked)}
          />
          Ephemeris scrub (read-only)
        </label>
        {scrubEnabled && (
          <input
            type="range"
            min={utMin}
            max={utMax}
            value={scrubUniversalTime ?? utMin}
            onChange={(e) => setScrubUniversalTime(Number(e.target.value))}
          />
        )}
      </div>
      <div className="ksp-solar-truth-banner">
        <strong>Truth:</strong> KSP patched-conic prediction — not SPICE/N-body.{" "}
        {model?.routeOverlayMode && model.routeOverlayMode !== "none"
          ? `Route: ${model.routeOverlayMode}. `
          : ""}
        Ephemeris: {model?.ephemerisStatus ?? "N/A"}. Placement:{" "}
        {model?.placementMode ?? "N/A"}. Patch chain: {model?.patchChainStatus ?? "N/A"}.
        {model?.iconTrailSample0ResidualMeters != null && (
          <> Icon↔trail₀: {model.iconTrailSample0ResidualMeters.toFixed(1)} m.</>
        )}
        {model?.ephemerisValidationResidualMeters != null && (
          <> Validation (same-UT): {model.ephemerisValidationResidualMeters.toFixed(1)} m.</>
        )}
        {model?.telemetry?.bodyOrbitSampleResidualMeters != null && (
          <> Trail sample: {model.telemetry.bodyOrbitSampleResidualMeters.toFixed(1)} m.</>
        )}
        {model?.ephemerisLivePropagationResidualMeters != null &&
          model.ephemerisLivePropagationResidualMeters > 0 && (
            <>
              {" "}
              60s orbital sep (diag):{" "}
              {model.ephemerisLivePropagationResidualMeters.toExponential(2)} m.
            </>
          )}
        {model?.positionValidation?.worstBodyName &&
          model.positionValidation.worstResidualMeters != null && (
            <>
              {" "}
              Worst: {model.positionValidation.worstBodyName}{" "}
              {model.positionValidation.worstCheck}{" "}
              {model.positionValidation.worstResidualMeters.toExponential(2)} m.
            </>
          )}
        {frameDiagnostics?.orbitOffsetMode && (
          <>
            {" "}
            Resolver: body {frameDiagnostics.orbitOffsetMode}
            {frameDiagnostics.vesselOffsetMode
              ? `, vessel ${frameDiagnostics.vesselOffsetMode}`
              : ""}{" "}
            (v{frameDiagnostics.resolverVersion ?? "?"}).
          </>
        )}
      </div>
      {moonLodDebug && showMoonLodDebug && (
        <div className="ksp-solar-truth-banner">{moonLodDebug.label}</div>
      )}
      <div className="ksp-solar-hud-row">
        <label>
          <input
            type="checkbox"
            checked={showMoonLodDebug}
            onChange={(e) => setShowMoonLodDebug(e.target.checked)}
          />
          Moon LOD debug
        </label>
      </div>
      <PlanetBodyLodDevPanel />
      <PlanetBodyOrientationDevPanel />
      <CustomizeMapDevPanel />
      {bodyOrbitPaths.length > 0 && (
        <div className="ksp-solar-hud-row">
          <button
            type="button"
            onClick={() => setShowBodyOrbitQa((v) => !v)}
          >
            {showBodyOrbitQa ? "Hide" : "Show"} body orbit QA
          </button>
        </div>
      )}
      {showBodyOrbitQa && bodyOrbitPaths.length > 0 && (
        <div className="ksp-solar-body-orbit-qa">
          <table>
            <thead>
              <tr>
                <th>Body</th>
                <th>Type</th>
                <th>Mode</th>
                <th>Metrics</th>
                <th>Warning</th>
              </tr>
            </thead>
            <tbody>
              {bodyOrbitPaths.map((path) => {
                const name = path.bodyName ?? "";
                const isMoonRow =
                  hierarchy != null && hierarchy.allMoonNames.includes(name);
                return (
                  <tr key={path.bodyName ?? "unknown"}>
                    <td>{path.bodyName ?? "—"}</td>
                    <td>{isMoonRow ? "moon" : "planet"}</td>
                    <td>{path.validation?.trailRenderMode ?? "—"}</td>
                    <td>{formatTrailValidation(path.validation)}</td>
                    <td>{path.validation?.trailWarning ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(classification === "Suborbital" || classification === "Landed") && (
        <div className="ksp-solar-warning">
          Trajectory display may be limited ({classification}).
        </div>
      )}
      {!model?.canDraw && model?.reason && (
        <div className="ksp-solar-warning">{model.reason}</div>
      )}
    </div>
  );
}