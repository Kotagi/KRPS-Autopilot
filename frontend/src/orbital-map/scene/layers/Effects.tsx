import { useMemo } from "react";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Stars } from "@react-three/drei";
import { useViewStore } from "../../store/viewStore";
import { getQualitySettings } from "../../settings/qualityStore";

export function SceneEffects() {
  const qualityPreset = useViewStore((s) => s.qualityPreset);
  const quality = useMemo(
    () => getQualitySettings(qualityPreset),
    [qualityPreset],
  );

  return (
    <>
      <Stars
        radius={300}
        depth={50}
        count={quality.starCount}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />
      {quality.bloomEnabled && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={1.2} />
        </EffectComposer>
      )}
    </>
  );
}
