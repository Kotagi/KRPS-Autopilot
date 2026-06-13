import { useViewStore } from "../store/viewStore";
import { MAP_V2_PHASE_LABEL } from "../map-v2/layerFlags";
import { formatTrailValidation } from "../coords/buildBodyOrbitTrail";

/** Minimal HUD overlay when 3d-v2 render mode is active. */
export function MapHudV2() {
  const telemetry = useViewStore((s) => s.telemetry);
  const rootBody = telemetry?.rootBody ?? "—";
  const paths = telemetry?.bodyOrbitPaths ?? [];
  let worstResidual = 0;
  let worstBody = "";
  paths.forEach((p) => {
    const r = p.validation?.liveToAnalyticMeters;
    if (r != null && r > worstResidual) {
      worstResidual = r;
      worstBody = p.bodyName ?? "";
    }
  });

  return (
    <div className="ksp-solar-hud-v2" aria-label="Map v2 status">
      <span className="ksp-solar-hud-v2-phase">{MAP_V2_PHASE_LABEL}</span>
      <span>Root: {rootBody}</span>
      {worstBody ? (
        <span title={formatTrailValidation(paths.find((p) => p.bodyName === worstBody)?.validation)}>
          Worst orbit residual ({worstBody}): {worstResidual.toExponential(1)} m
        </span>
      ) : null}
      <span className="ksp-solar-hud-v2-hint">
        Compare side-by-side with the in-game KSP map (same UT / flight).
      </span>
    </div>
  );
}
