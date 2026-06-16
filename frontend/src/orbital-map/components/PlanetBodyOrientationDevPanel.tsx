import { useState } from "react";
import { useViewStore } from "../store/viewStore";
import {
  getKerbinChiralitySampleCount,
  runSpinChiralityDiagnostic,
} from "../map-v3/elements/planetBody/planetBodySpinChiralityDiagnostic";

/** Dev HUD: show spin/tilt axis through planet mesh LOD bodies. */
export function PlanetBodyOrientationDevPanel() {
  const visible = useViewStore((s) => s.devPlanetBodySpinAxisVisible);
  const setVisible = useViewStore((s) => s.setDevPlanetBodySpinAxisVisible);
  const spinDirectionVisible = useViewStore((s) => s.devPlanetBodySpinDirectionVisible);
  const setSpinDirectionVisible = useViewStore(
    (s) => s.setDevPlanetBodySpinDirectionVisible,
  );
  const spinDiag = useViewStore((s) => s.devPlanetBodySpinDiagnostics);
  const setSpinDiag = useViewStore((s) => s.setDevPlanetBodySpinDiagnostics);
  const chiralityCollect = useViewStore((s) => s.devPlanetBodySpinChiralityCollect);
  const setChiralityCollect = useViewStore((s) => s.setDevPlanetBodySpinChiralityCollect);
  const renderMode = useViewStore((s) => s.solarRenderMode);
  const lodOverride = useViewStore((s) => s.devPlanetBodyLodOverride);
  const v3 = renderMode === "3d-v3";
  const gameUt = useViewStore((s) => s.telemetry?.gameUniversalTimeSeconds);
  const sampleCount = chiralityCollect ? getKerbinChiralitySampleCount() : 0;
  void gameUt;
  const [chiralityStatus, setChiralityStatus] = useState<string | null>(null);

  return (
    <div className="ksp-solar-customize-map-dev">
      <span className="ksp-solar-customize-map-dev-toggle">Dev: planet orientation</span>
      <label className="ksp-solar-customize-map-dev-toggle">
        <input
          type="checkbox"
          checked={visible}
          disabled={!v3}
          onChange={(e) => setVisible(e.target.checked)}
        />
        Show spin/tilt axis
      </label>
      <label className="ksp-solar-customize-map-dev-toggle">
        <input
          type="checkbox"
          checked={spinDirectionVisible}
          disabled={!v3}
          onChange={(e) => setSpinDirectionVisible(e.target.checked)}
        />
        Show spin direction
      </label>
      <label className="ksp-solar-customize-map-dev-toggle">
        <input
          type="checkbox"
          checked={spinDiag}
          disabled={!v3}
          onChange={(e) => setSpinDiag(e.target.checked)}
        />
        Log Kerbin spin (console)
      </label>
      <label className="ksp-solar-customize-map-dev-toggle">
        <input
          type="checkbox"
          checked={chiralityCollect}
          disabled={!v3}
          onChange={(e) => setChiralityCollect(e.target.checked)}
        />
        Collect Kerbin spin samples ({sampleCount})
      </label>
      <button
        type="button"
        className="ksp-solar-customize-map-dev-button"
        disabled={!v3}
        onClick={() => {
          void (async () => {
            setChiralityStatus(
              sampleCount >= 2
                ? "Running… (using collected samples)"
                : "Running… fetching 2 live samples (~3 s)",
            );
            const report = await runSpinChiralityDiagnostic({
              useBuffer: true,
              captureDelayMs: 3000,
            });
            if (report) {
              setChiralityStatus(
                `Done — open browser console (F12). Verdict: ${report.verdict}`,
              );
            } else {
              setChiralityStatus(
                "Failed — open console (F12) for [KspWebMap] spin chirality warning",
              );
            }
          })();
        }}
      >
        Run spin chirality diagnostic
      </button>
      {chiralityStatus ? (
        <span className="ksp-solar-customize-map-dev-hint">{chiralityStatus}</span>
      ) : (
        <span className="ksp-solar-customize-map-dev-hint">
          Output is only in the browser console (F12 → Console), not on the map.
        </span>
      )}
      {!v3 ? (
        <span className="ksp-solar-customize-map-dev-hint">
          Switch render mode to <strong>3d-v3</strong> to use orientation overlays.
        </span>
      ) : lodOverride === "icon" ? (
        <span className="ksp-solar-customize-map-dev-hint">
          Axis hidden while <strong>Force dot</strong> is on (mesh LOD only).
        </span>
      ) : visible || spinDirectionVisible ? (
        <span className="ksp-solar-customize-map-dev-hint">
          {visible ? "Yellow = spin axis (poles). " : ""}
          {spinDirectionVisible
            ? "Magenta = prime meridian; cyan arrow = prograde along equator (tangent, not toward a pole). Yellow spin axis uses a different parent frame — enable both to verify they stay consistent."
            : null}
        </span>
      ) : null}
    </div>
  );
}
