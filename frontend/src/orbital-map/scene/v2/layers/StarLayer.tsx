import * as THREE from "three";
import { useMemo } from "react";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { buildSegments } from "../../../map-v2/TrajectoryPlanner";
import { toScenePoint } from "../../../map-v2/SceneFrame";
import { getSunTexture } from "../../../assets/proceduralTextures";
import { bodyMeshRadius } from "../../bodyVisualScale";
import { getKspBodyMapColor } from "../../bodyMapColors";

export function StarLayer() {
  const { mapContext, sceneFrame, layers } = useMapV2();
  const sunTexture = useMemo(() => getSunTexture(), []);

  if (!layers.star || !mapContext?.canDraw) {
    return null;
  }

  const segments = buildSegments(mapContext, "StarMarker");
  const seg = segments[0];
  if (!seg || seg.points.length === 0) {
    return null;
  }

  const star = mapContext.bodyByName.get(seg.bodyName ?? mapContext.rootBody);
  const radiusMeters = star?.radiusMeters ?? 696_000_000;
  const visualRadius = bodyMeshRadius({
    bodyName: star?.name ?? mapContext.rootBody,
    radiusMeters,
    displayScale: sceneFrame.displayScale,
    hierarchy: mapContext.hierarchy,
    hostPlanetOpen: false,
  });
  const [x, y, z] = toScenePoint(seg.points[0], sceneFrame);

  return (
    <mesh position={[x, y, z]} renderOrder={10}>
      <sphereGeometry args={[visualRadius, 32, 32]} />
      <meshStandardMaterial
        color={getKspBodyMapColor(seg.bodyName)}
        map={sunTexture}
        emissive={new THREE.Color("#ffaa00")}
        emissiveIntensity={1.2}
      />
    </mesh>
  );
}
