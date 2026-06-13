import { useEffect } from "react";
import { useViewStore } from "../../../store/viewStore";
import { useMapV3 } from "../../../map-v3/MapV3Context";
import { PLANET_ORBIT_STYLE } from "../../../map-v3/elements/planetOrbit/planetOrbitStyle";
import { useV3RootSegments, useV3SceneTrails } from "../../../map-v3/useMapV3Trails";
import { useMoonVisibilityContext } from "../../MoonVisibilityContext";
import { OrbitTrailV3 } from "./OrbitTrailV3";

declare global {
  interface Window {
    KspSolarMapPlanetOrbitDebug?: {
      trails: { bodyName?: string; pointCount: number }[];
      targetVertices: number;
    };
  }
}

export function PlanetOrbitLayer() {
  const { mapContext, sceneFrame, layers } = useMapV3();
  const { visibleBodyNames } = useMoonVisibilityContext();

  const rootSegs = useV3RootSegments(
    mapContext,
    "planetOrbit",
    layers.planetOrbit,
  );

  const filteredRoot = rootSegs.filter((seg) => {
    const name = seg.bodyName;
    if (!name || !mapContext) {
      return false;
    }
    if (!visibleBodyNames.has(name)) {
      return false;
    }
    if (!mapContext.hierarchy.planetNames.includes(name)) {
      return false;
    }
    return true;
  });

  const trails = useV3SceneTrails(filteredRoot, sceneFrame);

  const customizeEnabled = useViewStore((s) => s.devCustomizeMapEnabled);
  const setPickLines = useViewStore((s) => s.setCustomizeMapOrbitPickLines);

  useEffect(() => {
    if (!layers.planetOrbit || trails.length === 0) {
      window.KspSolarMapPlanetOrbitDebug = undefined;
      return;
    }
    window.KspSolarMapPlanetOrbitDebug = {
      trails: trails.map((t) => ({
        bodyName: t.bodyName,
        pointCount: t.points.length,
      })),
      targetVertices: PLANET_ORBIT_STYLE.trailVertices,
    };
  }, [layers.planetOrbit, trails]);

  useEffect(() => {
    if (!customizeEnabled) {
      setPickLines([]);
      return;
    }
    setPickLines(
      trails
        .filter((t) => t.bodyName && t.points.length >= 2)
        .map((t) => ({
          bodyName: t.bodyName!,
          points: t.points,
        })),
    );
  }, [customizeEnabled, trails, setPickLines]);

  if (!layers.planetOrbit || !mapContext?.canDraw || trails.length === 0) {
    return null;
  }

  return (
    <group>
      {trails.map((t) => (
        <OrbitTrailV3
          key={t.key}
          lineKey={t.key}
          bodyName={t.bodyName}
          points={t.points}
          anchorIndex={t.anchorIndex}
          sampleUniversalTimes={t.sampleUniversalTimes}
          lineWidth={t.lineWidth}
        />
      ))}
    </group>
  );
}
