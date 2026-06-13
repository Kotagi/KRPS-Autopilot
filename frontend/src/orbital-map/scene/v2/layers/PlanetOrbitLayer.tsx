import { useMemo } from "react";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { buildPlanetOrbitSegments } from "../../../map-v3/elements/planetOrbit/buildPlanetOrbitSegments";
import { toScenePoints } from "../../../map-v2/SceneFrame";
import { OrbitTrailV2 } from "./OrbitTrailV2";

export function PlanetOrbitLayer() {
  const { mapContext, sceneFrame, layers } = useMapV2();
  const rootSegs = useMemo(
    () => (mapContext ? buildPlanetOrbitSegments(mapContext) : []),
    [mapContext],
  );
  const trails = useMemo(
    () =>
      rootSegs.map((seg) => ({
        key: seg.key,
        bodyName: seg.bodyName,
        points: toScenePoints(seg.points, sceneFrame),
        anchorIndex: seg.anchorIndex ?? 0,
        closed: seg.closed ?? false,
      })),
    [rootSegs, sceneFrame],
  );

  if (!layers.planetOrbits || trails.length === 0) {
    return null;
  }

  return (
    <group>
      {trails.map((t) => (
        <OrbitTrailV2
          key={t.key}
          lineKey={t.key}
          bodyName={t.bodyName}
          points={t.points}
          anchorIndex={t.anchorIndex}
          closedWithDuplicateEndpoint={false}
          planetRing
        />
      ))}
    </group>
  );
}
