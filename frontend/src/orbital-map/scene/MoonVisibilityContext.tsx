import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useThree } from "@react-three/fiber";
import { useViewStore } from "../store/viewStore";
import {
  formatMoonVisibilityDebug,
  resolveMoonVisibility,
  type MoonVisibilityResult,
} from "./moonVisibility";
import {
  moonParentSeparationMeters,
  resolveDisplayFocus,
  resolveSoiDetectionFocus,
} from "./displayFocus";
import type { Vector3 } from "../telemetry/schema-v6";

export type MoonVisibilityState = MoonVisibilityResult & {
  hostPlanetOpen: boolean;
  displayFocus: Vector3 | null;
};

const defaultState: MoonVisibilityState = {
  visibleBodyNames: new Set<string>(),
  activeHostPlanet: null,
  reason: "solar",
  hostPlanetOpen: false,
  displayFocus: null,
};

const MoonVisibilityContext = createContext<MoonVisibilityState>(defaultState);

export function MoonVisibilityProvider({ children }: { children: ReactNode }) {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const cameraMode = useViewStore((s) => s.cameraMode);
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const hoverObjectId = useViewStore((s) => s.hoverObjectId);
  const selectedObjectId = useViewStore((s) => s.selectedObjectId);
  const setMoonLodDebug = useViewStore((s) => s.setMoonLodDebug);
  const { camera } = useThree();
  const previousHostRef = useRef<string | null>(null);

  const vesselReferenceBody =
    model?.telemetry?.orbit?.referenceBody ?? model?.referenceBody ?? null;

  const hoverBodyName = hoverObjectId?.startsWith("body:")
    ? hoverObjectId.slice("body:".length)
    : null;
  const selectedBodyName = selectedObjectId?.startsWith("body:")
    ? selectedObjectId.slice("body:".length)
    : null;

  const bodySoiMeters = useMemo(() => {
    const map: Record<string, number> = {};
    model?.bodies.forEach((entry) => {
      const name = entry.body.name;
      const soi = entry.body.sphereOfInfluenceMeters;
      if (name && soi && soi > 0) {
        map[name] = soi;
      }
    });
    return map;
  }, [model?.bodies]);

  const value = useMemo((): MoonVisibilityState => {
    if (!model?.hierarchy || !model.canDraw) {
      return defaultState;
    }

    const soiDetectionFocus = resolveSoiDetectionFocus(
      model,
      focusBodyName,
      cameraMode,
    );

    const resolved = resolveMoonVisibility({
      hierarchy: model.hierarchy,
      bodies: model.bodies,
      bodySoiMeters,
      displayScale,
      focus: soiDetectionFocus,
      cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
      cameraMode,
      focusBodyName,
      vesselReferenceBody,
      hoverBodyName,
      selectedBodyName,
      previousHostPlanet: previousHostRef.current,
    });

    previousHostRef.current = resolved.activeHostPlanet;

    const displayFocus = resolveDisplayFocus(
      model,
      focusBodyName,
      cameraMode,
      resolved.activeHostPlanet,
      resolved.reason,
    );

    return {
      ...resolved,
      hostPlanetOpen: resolved.activeHostPlanet != null,
      displayFocus,
    };
  }, [
    model,
    bodySoiMeters,
    displayScale,
    camera.position.x,
    camera.position.y,
    camera.position.z,
    cameraMode,
    focusBodyName,
    vesselReferenceBody,
    hoverBodyName,
    selectedBodyName,
  ]);

  useEffect(() => {
    let label = formatMoonVisibilityDebug(value);
    if (value.activeHostPlanet === "Duna") {
      const sep = moonParentSeparationMeters(model, "Ike", "Duna");
      if (sep != null) {
        label += ` | Ike↔Duna ${(sep / 1e6).toFixed(2)} Mm`;
      }
    } else if (value.activeHostPlanet === "Kerbin") {
      const mun = moonParentSeparationMeters(model, "Mun", "Kerbin");
      if (mun != null) {
        label += ` | Mun↔Kerbin ${(mun / 1e6).toFixed(2)} Mm`;
      }
    }
    setMoonLodDebug({
      reason: value.reason,
      activeHostPlanet: value.activeHostPlanet,
      visibleCount: value.visibleBodyNames.size,
      label,
    });
  }, [value, setMoonLodDebug, model]);

  return (
    <MoonVisibilityContext.Provider value={value}>
      {children}
    </MoonVisibilityContext.Provider>
  );
}

export function useMoonVisibilityContext(): MoonVisibilityState {
  return useContext(MoonVisibilityContext);
}
