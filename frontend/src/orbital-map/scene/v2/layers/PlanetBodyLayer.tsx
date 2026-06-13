import { useMemo } from "react";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { buildSegments } from "../../../map-v2/TrajectoryPlanner";
import { BodyMeshV2 } from "./BodyMeshV2";

export function PlanetBodyLayer() {
  const { mapContext, layers } = useMapV2();

  const bodies = useMemo(() => {
    if (!mapContext) {
      return [];
    }
    return buildSegments(mapContext, "BodyPosition", { planetOnly: true });
  }, [mapContext]);

  if (!layers.planetBodies || !mapContext) {
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
