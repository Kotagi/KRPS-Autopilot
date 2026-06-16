import { useEffect, useMemo } from "react";
import { PLANET_ORBIT_STYLE } from "../../../map-v3/elements/planetOrbit/planetOrbitStyle";
import { usePlanetsInMeshMode } from "../../../map-v3/PlanetBodyMeshLodContext";
import { useMapV3 } from "../../../map-v3/MapV3Context";
import {
  moonOrbitPointsToScene,
  resolveMoonOrbitAnchorIndex,
} from "../../../map-v3/elements/moonOrbit/moonOrbitScene";
import {
  useV3RootSegments,
  type SceneTrail,
} from "../../../map-v3/useMapV3Trails";
import { useCustomizeMapOrbitPickRegistration } from "../../useCustomizeMapOrbitPickRegistration";
import { OrbitTrailV3 } from "./OrbitTrailV3";

declare global {
  interface Window {
    KspSolarMapMoonOrbitDebug?: {
      trails: {
        bodyName?: string;
        pointCount: number;
        geometrySource?: string;
      }[];
      targetVertices: number;
    };
  }
}

function sceneFrameKey(
  frame: ReturnType<typeof useMapV3>["sceneFrame"],
): string {
  const f = frame.focus;
  return [
    frame.focusMode,
    frame.focusBodyName ?? "",
    frame.displayScale,
    f?.x ?? "n",
    f?.y ?? "n",
    f?.z ?? "n",
  ].join("|");
}

export function MoonOrbitLayer() {
  const { mapContext, sceneFrame, layers } = useMapV3();
  const planetsInMeshMode = usePlanetsInMeshMode();

  const rootSegs = useV3RootSegments(
    mapContext,
    "moonOrbit",
    layers.moonOrbit,
  );

  const filteredRoot = useMemo(
    () =>
      rootSegs.filter((seg) => {
        const parent = seg.parentBody;
        return !!parent && planetsInMeshMode.has(parent);
      }),
    [rootSegs, planetsInMeshMode],
  );

  const frameKey = sceneFrameKey(sceneFrame);
  const trails = useMemo((): SceneTrail[] => {
    if (!mapContext) {
      return [];
    }
    return filteredRoot.map((seg) => {
      const parentEntry = seg.parentBody
        ? mapContext.bodyByName.get(seg.parentBody)
        : undefined;
      const points = parentEntry
        ? moonOrbitPointsToScene(seg.points, parentEntry, sceneFrame)
        : [];
      const anchorIndex = resolveMoonOrbitAnchorIndex(
        points,
        seg.bodyName,
        mapContext,
        sceneFrame,
      );
      return {
        key: seg.key,
        bodyName: seg.bodyName,
        points,
        anchorIndex,
        sampleUniversalTimes: seg.sampleUniversalTimes,
        closed: seg.closed ?? false,
        closedWithDuplicateEndpoint: seg.closedWithDuplicateEndpoint,
        lineWidth: seg.lineWidth,
        geometrySource: seg.geometrySource,
      };
    });
  }, [filteredRoot, mapContext, frameKey, sceneFrame]);

  useCustomizeMapOrbitPickRegistration(
    "moonOrbit",
    trails,
    layers.moonOrbit && !!mapContext?.canDraw,
  );

  useEffect(() => {
    if (!layers.moonOrbit || trails.length === 0) {
      window.KspSolarMapMoonOrbitDebug = undefined;
      return;
    }
    window.KspSolarMapMoonOrbitDebug = {
      trails: trails.map((t) => ({
        bodyName: t.bodyName,
        pointCount: t.points.length,
        geometrySource: t.geometrySource,
      })),
      targetVertices: PLANET_ORBIT_STYLE.trailVertices,
    };
  }, [layers.moonOrbit, trails]);

  if (!layers.moonOrbit || !mapContext?.canDraw || trails.length === 0) {
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
