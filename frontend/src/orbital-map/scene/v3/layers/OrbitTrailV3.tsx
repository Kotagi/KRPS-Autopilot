import { memo } from "react";
import { useViewStore } from "../../../store/viewStore";
import { GradientDirectionalOrbitTrail } from "../../GradientDirectionalOrbitTrail";
import { PLANET_ORBIT_STYLE } from "../../../map-v3/elements/planetOrbit/planetOrbitStyle";
import { useKspBodyMapColor } from "../../bodyMapColors";
import { densifyPlanetOrbitScenePoints } from "../../../map-v3/elements/planetOrbit/densifyPlanetOrbitTrail";
import type { ScenePoint3 } from "../../../map-v3/types";

export const OrbitTrailV3 = memo(function OrbitTrailV3({
  lineKey,
  bodyName,
  points,
  anchorIndex = 0,
  sampleUniversalTimes,
  lineWidth = PLANET_ORBIT_STYLE.retrogradeLineWidth,
}: {
  lineKey: string;
  bodyName?: string;
  points: ScenePoint3[];
  anchorIndex?: number;
  sampleUniversalTimes?: number[];
  closedWithDuplicateEndpoint?: boolean;
  lineWidth?: number;
}) {
  const lineColor = useKspBodyMapColor(bodyName);
  const customizeEnabled = useViewStore((s) => s.devCustomizeMapEnabled);
  const finitePoints = points.filter(
    (p) =>
      p.length >= 3 &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1]) &&
      Number.isFinite(p[2]),
  );
  if (finitePoints.length < 2) {
    return null;
  }

  const ring = densifyPlanetOrbitScenePoints(finitePoints);

  return (
    <GradientDirectionalOrbitTrail
      lineKey={lineKey}
      lineColor={lineColor}
      points={ring}
      anchorIndex={anchorIndex}
      sampleUniversalTimes={sampleUniversalTimes}
      lineWidth={lineWidth}
      progradeLineWidthFactor={PLANET_ORBIT_STYLE.progradeLineWidthFactor}
      customizeMapPickable={customizeEnabled}
      customizeMapBodyName={bodyName}
    />
  );
});
