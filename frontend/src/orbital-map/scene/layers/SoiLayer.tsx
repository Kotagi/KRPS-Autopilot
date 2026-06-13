import { useThree } from "@react-three/fiber";
import { useViewStore } from "../../store/viewStore";
import { applyWorldShift } from "../../coords/worldShift";
import { useMoonVisibilityContext } from "../MoonVisibilityContext";
import { useLayerFocus } from "./useLayerFocus";
import { isMoon } from "../../model/bodyHierarchy";

/** Show SOI spheres when their visual size is meaningful for the current camera distance. */
function shouldDrawSoi(visualRadius: number, cameraDistance: number): boolean {
  if (visualRadius <= 0) {
    return false;
  }
  const ratio = visualRadius / Math.max(cameraDistance, 0.01);
  return ratio >= 0.02 && ratio <= 80;
}

export function SoiLayer() {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const { camera } = useThree();
  const { activeHostPlanet } = useMoonVisibilityContext();
  const focus = useLayerFocus();

  if (!model?.canDraw || !model.hierarchy) {
    return null;
  }

  const hierarchy = model.hierarchy;
  const camDist = camera.position.length();

  return (
    <group>
      {model.bodies.map((entry) => {
        const soi = entry.body.sphereOfInfluenceMeters;
        if (!soi || soi <= 0) {
          return null;
        }
        const name = entry.body.name ?? "body";
        if (activeHostPlanet != null && isMoon(hierarchy, name)) {
          return null;
        }
        if (activeHostPlanet == null && isMoon(hierarchy, name)) {
          return null;
        }
        const hostSoiScale =
          activeHostPlanet != null && name === activeHostPlanet ? 0.45 : 0.15;
        const visualRadius = soi * displayScale * hostSoiScale;
        if (!shouldDrawSoi(visualRadius, camDist)) {
          return null;
        }
        const [x, y, z] = applyWorldShift(entry.position, focus, displayScale);
        const opacity = name === activeHostPlanet ? 0.1 : 0.05;
        return (
          <mesh key={`soi-${name}`} position={[x, y, z]}>
            <sphereGeometry args={[visualRadius, 32, 32]} />
            <meshBasicMaterial
              color="#67d3ff"
              transparent
              opacity={opacity}
              wireframe={false}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
