import { useMemo } from "react";
import { useMapV3 } from "../../../map-v3/MapV3Context";
import { buildSegments } from "../../../map-v3/planner/buildSegments";
import { toScenePoint } from "../../../map-v3/SceneFrame";
import { starMarkerDrawFrame } from "../../../map-v3/camera/starCameraBounds";
import { getSunTexture } from "../../../assets/proceduralTextures";
import { bodyMeshRadius } from "../../bodyVisualScale";
import { getKspBodyMapColor } from "../../bodyMapColors";

export function StarMarkerLayer() {
  const { mapContext, sceneFrame, layers } = useMapV3();
  const sunTexture = useMemo(() => getSunTexture(), []);

  if (!layers.starMarker || !mapContext?.canDraw) {
    return null;
  }

  const segments = buildSegments(mapContext, "starMarker");
  if (segments.length === 0) {
    return null;
  }

  const starFrame = starMarkerDrawFrame(sceneFrame);

  return (
    <>
      {segments.map((seg) => {
        if (seg.points.length === 0) {
          return null;
        }
        const star = mapContext.bodyByName.get(
          seg.bodyName ?? mapContext.rootBody,
        );
        const bodyName = star?.name ?? mapContext.rootBody;
        const radiusMeters = star?.radiusMeters ?? 696_000_000;
        const visualRadius = bodyMeshRadius({
          bodyName,
          radiusMeters,
          displayScale: sceneFrame.displayScale,
          hierarchy: mapContext.hierarchy,
          hostPlanetOpen: false,
        });
        const [x, y, z] = toScenePoint(seg.points[0], starFrame);

        return (
          <mesh key={seg.key} position={[x, y, z]} renderOrder={10}>
            <sphereGeometry args={[visualRadius, 32, 32]} />
            <meshBasicMaterial
              color={getKspBodyMapColor(bodyName)}
              map={sunTexture}
            />
          </mesh>
        );
      })}
    </>
  );
}
