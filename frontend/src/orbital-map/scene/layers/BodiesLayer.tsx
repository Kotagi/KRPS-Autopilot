import * as THREE from "three";
import { useViewStore } from "../../store/viewStore";
import { applyWorldShift } from "../../coords/worldShift";
import { useLayerFocus } from "./useLayerFocus";
import { getKerbinTexture, getSunTexture } from "../../assets/proceduralTextures";
import { getKspBodyMapColor } from "../bodyMapColors";
import { useMoonVisibilityContext } from "../MoonVisibilityContext";
import { bodyMeshRadius } from "../bodyVisualScale";

function bodyColor(name: string | undefined): string {
  return getKspBodyMapColor(name);
}

function bodyMap(name: string): THREE.Texture | null {
  if (name === "Sun") {
    return getSunTexture();
  }
  if (name === "Kerbin") {
    return getKerbinTexture();
  }
  return null;
}

export function BodiesLayer() {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const cameraMode = useViewStore((s) => s.cameraMode);
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const focus = useLayerFocus();
  const { visibleBodyNames, hostPlanetOpen } = useMoonVisibilityContext();

  if (!model?.canDraw || !model.hierarchy) {
    return null;
  }

  const scaleInputBase = {
    displayScale,
    hierarchy: model.hierarchy,
    hostPlanetOpen,
  };

  return (
    <group>
      {model.bodies.map((entry) => {
        const name = entry.body.name ?? "body";
        if (!visibleBodyNames.has(name)) {
          return null;
        }
        const radius = Math.max(entry.body.radiusMeters ?? 1000, 1000);
        const visualRadius = bodyMeshRadius({
          ...scaleInputBase,
          bodyName: name,
          radiusMeters: radius,
        });
        const [x, y, z] = applyWorldShift(entry.position, focus, displayScale);
        const isSun = name === "Sun" || name === model.telemetry?.rootBody;
        const isFocused =
          cameraMode === "bodyFocus" && focusBodyName === name;
        const map = bodyMap(name);
        return (
          <mesh key={name} position={[x, y, z]} renderOrder={isSun ? 10 : 1}>
            <sphereGeometry args={[visualRadius, 24, 24]} />
            <meshStandardMaterial
              color={bodyColor(name)}
              map={map ?? undefined}
              emissive={
                isSun
                  ? new THREE.Color("#ffaa00")
                  : isFocused
                    ? new THREE.Color("#67d3ff")
                    : new THREE.Color("#000000")
              }
              emissiveIntensity={isSun ? 1.2 : isFocused ? 0.85 : 0}
            />
          </mesh>
        );
      })}
    </group>
  );
}
