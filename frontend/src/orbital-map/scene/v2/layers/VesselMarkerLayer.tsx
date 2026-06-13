import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { buildSegments } from "../../../map-v2/TrajectoryPlanner";
import { toScenePoint } from "../../../map-v2/SceneFrame";

export function VesselMarkerLayer() {
  const { mapContext, sceneFrame, layers } = useMapV2();

  const marker = useMemo(() => {
    if (!mapContext) {
      return null;
    }
    const segs = buildSegments(mapContext, "VesselPosition");
    return segs[0] ?? null;
  }, [mapContext]);

  if (!layers.vesselMarker || !marker || marker.points.length === 0) {
    return null;
  }

  const pos = toScenePoint(marker.points[0], sceneFrame);
  const diamond: [number, number, number][] = [
    [pos[0], pos[1] + 0.08, pos[2]],
    [pos[0] + 0.06, pos[1], pos[2]],
    [pos[0], pos[1] - 0.08, pos[2]],
    [pos[0] - 0.06, pos[1], pos[2]],
    [pos[0], pos[1] + 0.08, pos[2]],
  ];

  return (
    <Line
      points={diamond}
      color={marker.color ?? "#00e5ff"}
      lineWidth={2}
    />
  );
}
