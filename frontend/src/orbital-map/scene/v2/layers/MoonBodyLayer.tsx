import { useMemo } from "react";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { buildSegments } from "../../../map-v2/TrajectoryPlanner";
import { BodyMeshV2 } from "./BodyMeshV2";

export function MoonBodyLayer() {
  const { mapContext, layers, visibleMoonNames } = useMapV2();

  const bodies = useMemo(() => {
    if (!mapContext) {
      return [];
    }
    return buildSegments(mapContext, "BodyPosition", {
      moonOnly: true,
      bodyNames: visibleMoonNames,
    });
  }, [mapContext, visibleMoonNames]);

  if (!layers.moonBodies || !mapContext) {
    return null;
  }

  return (
    <group>
      {bodies.map((seg) => {
        const entry = seg.bodyName
          ? mapContext.bodyByName.get(seg.bodyName)
          : null;
        if (!entry || seg.points.length === 0) {
          return null;
        }
        return (
          <BodyMeshV2
            key={seg.key}
            bodyName={entry.name}
            radiusMeters={entry.radiusMeters}
            rootPosition={seg.points[0]}
          />
        );
      })}
    </group>
  );
}
