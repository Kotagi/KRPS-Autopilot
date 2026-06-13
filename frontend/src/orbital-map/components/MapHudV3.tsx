import { useViewStore } from "../store/viewStore";
import { MAP_V3_PHASE_LABEL } from "../map-v3/layerFlags";

/** Status strip when View → 3D Map V3 is active. */
export function MapHudV3() {
  const telemetry = useViewStore((s) => s.telemetry);
  const rootBody = telemetry?.rootBody ?? "—";

  return (
    <div className="ksp-solar-hud-v3" aria-label="Map v3 status">
      <span className="ksp-solar-hud-v3-phase">{MAP_V3_PHASE_LABEL}</span>
      <span>Root: {rootBody}</span>
      <span className="ksp-solar-hud-v3-hint">
        Modular map — elements documented in docs/MAP_V3_RENDERING_GUIDE.md
      </span>
    </div>
  );
}
