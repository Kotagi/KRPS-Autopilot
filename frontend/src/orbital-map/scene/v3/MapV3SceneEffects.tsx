import { CameraAttachedStars } from "../CameraAttachedStars";

/** v3 background stars only — no postprocessing (CEF-safe, same as v2). */
export function MapV3SceneEffects() {
  return <CameraAttachedStars />;
}
