import { memo } from "react";
import { GradientDirectionalOrbitTrail } from "../../GradientDirectionalOrbitTrail";
import { densifyPlanetOrbitScenePoints } from "../../../map-v3/elements/planetOrbit/densifyPlanetOrbitTrail";
import { useKspBodyMapColor } from "../../bodyMapColors";
import type { ScenePoint3 } from "../../../map-v2/types";

export const OrbitTrailV2 = memo(function OrbitTrailV2({
  lineKey,
  bodyName,
  points,
  anchorIndex = 0,
  closedWithDuplicateEndpoint = false,
  lineWidth = 1,
  planetRing = false,
}: {
  lineKey: string;
  bodyName?: string;
  points: ScenePoint3[];
  anchorIndex?: number;
  closedWithDuplicateEndpoint?: boolean;
  lineWidth?: number;
  planetRing?: boolean;
}) {
  const lineColor = useKspBodyMapColor(bodyName);
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

  const ring = planetRing
    ? densifyPlanetOrbitScenePoints(finitePoints)
    : finitePoints;

  return (
    <GradientDirectionalOrbitTrail
      lineKey={lineKey}
      lineColor={lineColor}
      points={ring}
      anchorIndex={anchorIndex}
      lineWidth={lineWidth}
      closedWithDuplicateEndpoint={closedWithDuplicateEndpoint}
    />
  );
});
