import { Line } from "@react-three/drei";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { useV2RootSegments, useV2SceneTrails } from "../../../map-v2/useMapV2Trails";

export function FutureRouteLayer() {
  const { mapContext, sceneFrame, layers } = useMapV2();
  const rootSegs = useV2RootSegments(
    mapContext,
    "FutureRouteLeg",
    undefined,
    layers.futureRoute,
  );
  const legs = useV2SceneTrails(rootSegs, sceneFrame);

  if (!layers.futureRoute || legs.length === 0) {
    return null;
  }

  return (
    <group>
      {legs.map((leg) =>
        leg.points.length >= 2 ? (
          <Line
            key={leg.key}
            points={leg.points}
            color={leg.color ?? "#ffeb3b"}
            lineWidth={leg.lineWidth ?? 1.5}
            transparent
            opacity={leg.opacity ?? 0.85}
            dashed
          />
        ) : null,
      )}
    </group>
  );
}
