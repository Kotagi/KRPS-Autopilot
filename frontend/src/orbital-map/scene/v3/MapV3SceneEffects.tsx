import { useMemo } from "react";
import { Stars } from "@react-three/drei";
import { useViewStore } from "../../store/viewStore";
import { getQualitySettings } from "../../settings/qualityStore";

/** v3 background stars only — no postprocessing (CEF-safe, same as v2). */
export function MapV3SceneEffects() {
  const qualityPreset = useViewStore((s) => s.qualityPreset);
  const quality = useMemo(
    () => getQualitySettings(qualityPreset),
    [qualityPreset],
  );

  return (
    <Stars
      radius={300}
      depth={50}
      count={Math.min(quality.starCount, 2000)}
      factor={4}
      saturation={0}
      fade
      speed={0.5}
    />
  );
}
