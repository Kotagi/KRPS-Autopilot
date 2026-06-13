import { Line } from "@react-three/drei";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { useV2RootSegments, useV2SceneTrails } from "../../../map-v2/useMapV2Trails";

export function VesselOrbitLayer() {
  const { mapContext, sceneFrame, layers } = useMapV2();
  const rootSegs = useV2RootSegments(
    mapContext,
    "ActiveVesselLeg",
    undefined,
    layers.vesselOrbit,
  );
  const legs = useV2SceneTrails(rootSegs, sceneFrame);

  if (!layers.vesselOrbit || legs.length === 0) {
    return null;
  }

  return (
    <group>
      {legs.map((leg) =>
        leg.points.length >= 2 ? (
          <Line
            key={leg.key}
            points={leg.points}
            color={leg.color ?? "#00e5ff"}
            lineWidth={leg.lineWidth ?? 2}
          />
        ) : null,
      )}
    </group>
  );
}
