import { useMemo } from "react";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { useV2RootSegments, useV2SceneTrails } from "../../../map-v2/useMapV2Trails";
import type { PlannerFilter } from "../../../map-v2/TrajectoryPlanner";
import { OrbitTrailV2 } from "./OrbitTrailV2";

export function MoonOrbitLayer() {
  const { mapContext, sceneFrame, layers, visibleMoonNames, visibleMoonKey } =
    useMapV2();

  const moonFilter = useMemo((): PlannerFilter | undefined => {
    if (!mapContext) {
      return undefined;
    }
    return { moonOnly: true, bodyNames: visibleMoonNames };
  }, [mapContext, visibleMoonKey]);

  const rootSegs = useV2RootSegments(
    mapContext,
    "BodyOrbit",
    moonFilter,
    layers.moonOrbits,
  );
  const trails = useV2SceneTrails(rootSegs, sceneFrame);

  if (!layers.moonOrbits || trails.length === 0) {
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
          closedWithDuplicateEndpoint={t.closed}
          lineWidth={0.8}
        />
      ))}
    </group>
  );
}
