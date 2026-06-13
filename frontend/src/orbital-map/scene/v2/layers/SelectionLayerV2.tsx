import { useMemo } from "react";
import { useMapV2 } from "../../../map-v2/MapV2Context";
import { toScenePoint } from "../../../map-v2/SceneFrame";
import { useViewStore } from "../../../store/viewStore";

export function SelectionLayerV2() {
  const { mapContext, sceneFrame, layers } = useMapV2();
  const selectedObjectId = useViewStore((s) => s.selectedObjectId);
  const hoverObjectId = useViewStore((s) => s.hoverObjectId);

  const highlightName = selectedObjectId ?? hoverObjectId;

  const entry = useMemo(() => {
    if (!mapContext || !highlightName) {
      return null;
    }
    return mapContext.bodyByName.get(highlightName) ?? null;
  }, [mapContext, highlightName]);

  if (!layers.selection || !entry) {
    return null;
  }

  const [x, y, z] = toScenePoint(entry.position, sceneFrame);

  return (
    <mesh position={[x, y, z]}>
      <ringGeometry args={[0.12, 0.16, 32]} />
      <meshBasicMaterial color="#ffeb3b" transparent opacity={0.9} />
    </mesh>
  );
}
