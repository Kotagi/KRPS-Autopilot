import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useState } from "react";
import * as THREE from "three";
import {
  type PlanetBodyDrawMode,
  type PlanetBodyLodDevOverride,
  resolvePlanetBodyDrawMode,
} from "../../../map-v3/elements/planetBody/planetBodyLod";

/**
 * Recompute icon vs mesh every frame (camera zoom does not trigger React renders).
 */
export function usePlanetBodyDrawMode(
  sceneMeshRadius: number,
  scenePosition: [number, number, number],
  devOverride: PlanetBodyLodDevOverride,
): PlanetBodyDrawMode {
  const { camera, size } = useThree();
  const bodyPos = useMemo(
    () => new THREE.Vector3(scenePosition[0], scenePosition[1], scenePosition[2]),
    [scenePosition[0], scenePosition[1], scenePosition[2]],
  );
  const [drawMode, setDrawMode] = useState<PlanetBodyDrawMode>(() =>
    devOverride === "mesh" ? "mesh" : "icon",
  );

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const dist = cam.position.distanceTo(bodyPos);
    const next = resolvePlanetBodyDrawMode({
      sceneMeshRadius,
      cameraDistance: dist,
      cameraFovDeg: cam.fov,
      viewportHeight: size.height,
      devOverride,
    });
    setDrawMode((prev) => (prev === next ? prev : next));
  });

  return drawMode;
}
