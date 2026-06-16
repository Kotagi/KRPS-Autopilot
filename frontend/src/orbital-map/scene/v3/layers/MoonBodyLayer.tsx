import { useMemo } from "react";
import { useMapV3 } from "../../../map-v3/MapV3Context";
import { planetBodyTextureFields } from "../../../map-v3/elements/planetBody/planetBodyTextureFields";
import { buildSegments } from "../../../map-v3/planner/buildSegments";
import { usePlanetsInMeshMode } from "../../../map-v3/PlanetBodyMeshLodContext";
import { PlanetBodyMesh } from "./PlanetBodyMesh";

/**
 * Textured moon meshes when the host planet is in mesh LOD.
 * Reuses PlanetBodyMesh (scale, orientation, ScaledSpace texture from telemetry).
 */
export function MoonBodyLayer() {
  const { mapContext, layers } = useMapV3();
  const planetsInMeshMode = usePlanetsInMeshMode();

  const segments = useMemo(() => {
    if (!mapContext) {
      return [];
    }
    return buildSegments(mapContext, "moonBody");
  }, [mapContext]);

  if (!layers.moonBody || !mapContext?.canDraw || segments.length === 0) {
    return null;
  }

  return (
    <group>
      {segments.map((seg) => {
        const name = seg.bodyName;
        const parent = seg.parentBody;
        if (!name || !parent || seg.points.length === 0) {
          return null;
        }
        if (!planetsInMeshMode.has(parent)) {
          return null;
        }
        const entry = mapContext.bodyByName.get(name);
        if (!entry) {
          return null;
        }
        const texture = planetBodyTextureFields(entry.body);

        return (
          <PlanetBodyMesh
            key={seg.key}
            bodyName={name}
            radiusMeters={entry.radiusMeters}
            rootPosition={seg.points[0]}
            registerMeshLod={false}
            {...texture}
          />
        );
      })}
    </group>
  );
}
