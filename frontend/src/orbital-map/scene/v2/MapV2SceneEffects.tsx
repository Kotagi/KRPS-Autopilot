import { CameraAttachedStars } from "../CameraAttachedStars";

/** v2 background stars only — no postprocessing (EffectComposer crashes CEF after first frame). */
export function MapV2SceneEffects() {
  return <CameraAttachedStars />;
}
