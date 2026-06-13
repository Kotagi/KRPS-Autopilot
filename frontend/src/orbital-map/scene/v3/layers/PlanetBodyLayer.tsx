import { useMemo } from "react";
import { useMapV3 } from "../../../map-v3/MapV3Context";
import { planetBodyTextureFields } from "../../../map-v3/elements/planetBody/planetBodyTextureFields";
import { buildSegments } from "../../../map-v3/planner/buildSegments";
import { useMoonVisibilityContext } from "../../MoonVisibilityContext";
import { PlanetBodyMesh } from "./PlanetBodyMesh";

export function PlanetBodyLayer() {
  const { mapContext, layers } = useMapV3();
  const { visibleBodyNames } = useMoonVisibilityContext();

  const segments = useMemo(() => {
    if (!mapContext) {
      return [];
    }
    return buildSegments(mapContext, "planetBody");
  }, [mapContext]);

  if (!layers.planetBody || !mapContext?.canDraw || segments.length === 0) {
    return null;
  }

  return (
    <group>
      {segments.map((seg) => {
        const name = seg.bodyName;
        if (!name || seg.points.length === 0) {
          return null;
        }
        if (!visibleBodyNames.has(name)) {
          return null;
        }
        if (!mapContext.hierarchy.planetNames.includes(name)) {
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
            {...texture}
          />
        );
      })}
    </group>
  );
}
