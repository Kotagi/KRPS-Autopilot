import { useMemo } from "react";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { CameraAttachedStars } from "../CameraAttachedStars";
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
      <CameraAttachedStars maxCount={quality.starCount} />
      {quality.bloomEnabled && (
        <EffectComposer>
          <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={1.2} />
        </EffectComposer>
      )}
    </>
  );
}
