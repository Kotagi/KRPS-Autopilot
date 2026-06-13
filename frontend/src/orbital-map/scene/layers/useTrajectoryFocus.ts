import { useMemo } from "react";
import { useViewStore } from "../../store/viewStore";
import { resolveTrajectoryFocus } from "../displayFocus";

/** World-shift for vessel/route/patch-conic layers (no SOI-zoom host shift). */
export function useTrajectoryFocus() {
  const model = useViewStore((s) => s.model);
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const cameraMode = useViewStore((s) => s.cameraMode);
  return useMemo(
    () => resolveTrajectoryFocus(model, focusBodyName, cameraMode),
    [model, focusBodyName, cameraMode],
  );
}
