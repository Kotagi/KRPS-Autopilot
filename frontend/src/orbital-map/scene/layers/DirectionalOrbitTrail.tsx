import { useKspBodyMapColor } from "../bodyMapColors";
import { GradientDirectionalOrbitTrail } from "../GradientDirectionalOrbitTrail";

type Point3 = [number, number, number];

export interface DirectionalOrbitTrailProps {
  lineKey: string;
  bodyName?: string;
  points: Point3[];
  lineWidth?: number;
  anchorIndex?: number;
  closedWithDuplicateEndpoint?: boolean;
  iconPosition?: Point3 | null;
  sampleUniversalTimes?: number[];
}

/** Per-body KSP map color with retrograde/prograde split trails (meets at body). */
export function DirectionalOrbitTrail({
  lineKey,
  bodyName,
  points,
  lineWidth = 1,
  anchorIndex = 0,
  closedWithDuplicateEndpoint = false,
  sampleUniversalTimes,
}: DirectionalOrbitTrailProps) {
  const lineColor = useKspBodyMapColor(bodyName);

  if (points.length < 2) {
    return null;
  }

  return (
    <GradientDirectionalOrbitTrail
      lineKey={lineKey}
      lineColor={lineColor}
      points={points}
      anchorIndex={anchorIndex}
      lineWidth={lineWidth}
      closedWithDuplicateEndpoint={closedWithDuplicateEndpoint}
      sampleUniversalTimes={sampleUniversalTimes}
    />
  );
}
