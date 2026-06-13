import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { toScenePoint } from "../../../map-v2/SceneFrame";
import {
  iconDotRadius,
  resolveBodyDrawMode,
  sceneMeshRadius,
} from "../../../map-v2/BodyRepresentation";
import { getKerbinTexture, getSunTexture } from "../../../assets/proceduralTextures";
import { getKspBodyMapColor } from "../../bodyMapColors";
import { useViewStore } from "../../../store/viewStore";

function bodyTexture(name: string): THREE.Texture | null {
  if (name === "Sun") {
    return getSunTexture();
  }
  if (name === "Kerbin") {
    return getKerbinTexture();
  }
  return null;
}

export function BodyMeshV2({
  bodyName,
  radiusMeters,
  rootPosition,
  isStar = false,
}: {
  bodyName: string;
  radiusMeters: number;
  rootPosition: { x: number; y: number; z: number };
  isStar?: boolean;
}) {
  const { sceneFrame, mapContext, layers, hostPlanetOpen } = useMapV2();
  const { camera } = useThree();
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const cameraMode = useViewStore((s) => s.cameraMode);

  if (!mapContext) {
    return null;
  }

  const meshR = sceneMeshRadius({
    bodyName,
    radiusMeters,
    displayScale: sceneFrame.displayScale,
    hierarchy: mapContext.hierarchy,
    hostPlanetOpen,
  });
  const camDist = camera.position.distanceTo(
    new THREE.Vector3(...toScenePoint(rootPosition, sceneFrame)),
  );
  const drawMode =
    layers.bodyLod
      ? resolveBodyDrawMode({
          bodyName,
          radiusMeters,
          displayScale: sceneFrame.displayScale,
          hierarchy: mapContext.hierarchy,
          hostPlanetOpen,
          cameraDistance: camDist,
          sceneMeshRadius: meshR,
        })
      : "mesh";

  const [x, y, z] = toScenePoint(rootPosition, sceneFrame);
  const isFocused = cameraMode === "bodyFocus" && focusBodyName === bodyName;

  if (drawMode === "icon" && !isStar) {
    const iconR = iconDotRadius(bodyName, mapContext.hierarchy);
    return (
      <mesh position={[x, y, z]} renderOrder={2}>
        <sphereGeometry args={[iconR, 8, 8]} />
        <meshBasicMaterial color={getKspBodyMapColor(bodyName)} />
      </mesh>
    );
  }

  return (
    <mesh position={[x, y, z]} renderOrder={isStar ? 10 : 1}>
      <sphereGeometry args={[meshR, 24, 24]} />
      <meshStandardMaterial
        color={getKspBodyMapColor(bodyName)}
        map={bodyTexture(bodyName) ?? undefined}
        emissive={
          isStar
            ? new THREE.Color("#ffaa00")
            : isFocused
              ? new THREE.Color("#67d3ff")
              : new THREE.Color("#000000")
        }
        emissiveIntensity={isStar ? 1.2 : isFocused ? 0.85 : 0}
      />
    </mesh>
  );
}
