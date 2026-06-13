import { Html } from "@react-three/drei";
import { useMemo } from "react";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { buildSegments } from "../../../map-v2/TrajectoryPlanner";
import { toScenePoint } from "../../../map-v2/SceneFrame";
import { useViewStore } from "../../../store/viewStore";

export function BodyLabelsLayer() {
  const { mapContext, sceneFrame, layers, visibleMoonNames, hostPlanetOpen } =
    useMapV2();
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const cameraMode = useViewStore((s) => s.cameraMode);

  const labels = useMemo(() => {
    if (!mapContext) {
      return [];
    }
    const showClose =
      cameraMode === "bodyFocus" || hostPlanetOpen;
    if (!showClose) {
      return [];
    }
    const planetSegs = buildSegments(mapContext, "BodyLabel", {
      planetOnly: true,
      bodyNames: focusBodyName ? new Set([focusBodyName]) : undefined,
    });
    const moonSegs = buildSegments(mapContext, "BodyLabel", {
      moonOnly: true,
      bodyNames: visibleMoonNames,
    });
    return [...planetSegs, ...moonSegs];
  }, [
    mapContext,
    visibleMoonNames,
    focusBodyName,
    cameraMode,
    hostPlanetOpen,
  ]);

  if (!layers.bodyLabels || labels.length === 0) {
    return null;
  }

  return (
    <group>
      {labels.map((seg) => {
        if (!seg.bodyName || seg.points.length === 0) {
          return null;
        }
        const [x, y, z] = toScenePoint(seg.points[0], sceneFrame);
        return (
          <Html
            key={seg.key}
            position={[x, y + 0.2, z]}
            center
            style={{
              color: "#e8f4ff",
              fontSize: "11px",
              fontFamily: "system-ui, sans-serif",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              textShadow: "0 0 4px #000",
            }}
          >
            {seg.bodyName}
          </Html>
        );
      })}
    </group>
  );
}
