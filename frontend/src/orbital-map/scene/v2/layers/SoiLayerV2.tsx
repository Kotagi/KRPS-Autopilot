import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { toScenePoint } from "../../../map-v2/SceneFrame";
import { isMoon } from "../../../model/bodyHierarchy";

function shouldDrawSoi(visualRadius: number, cameraDistance: number): boolean {
  if (visualRadius <= 0) {
    return false;
  }
  const ratio = visualRadius / Math.max(cameraDistance, 0.01);
  return ratio >= 0.02 && ratio <= 80;
}

export function SoiLayerV2() {
  const { mapContext, sceneFrame, layers, activeHostPlanet, visibleMoonNames } =
    useMapV2();
  const { camera } = useThree();

  const rings = useMemo(() => {
    if (!mapContext) {
      return [];
    }
    return mapContext.bodies.filter((b) => {
      if (b.soiMeters <= 0) {
        return false;
      }
      if (isMoon(mapContext.hierarchy, b.name)) {
        return visibleMoonNames.has(b.name);
      }
      return true;
    });
  }, [mapContext, visibleMoonNames]);

  if (!layers.soi || !mapContext) {
    return null;
  }

  const camDist = camera.position.length();

  return (
    <group>
      {rings.map((entry) => {
        const name = entry.name;
        const hostSoiScale =
          activeHostPlanet != null && name === activeHostPlanet ? 0.45 : 0.15;
        const visualRadius =
          entry.soiMeters * sceneFrame.displayScale * hostSoiScale;
        if (!shouldDrawSoi(visualRadius, camDist)) {
          return null;
        }
        const [x, y, z] = toScenePoint(entry.position, sceneFrame);
        return (
          <mesh key={`soi-${name}`} position={[x, y, z]}>
            <sphereGeometry args={[visualRadius, 32, 32]} />
            <meshBasicMaterial
              color="#4fc3f7"
              transparent
              opacity={0.08}
              wireframe
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
