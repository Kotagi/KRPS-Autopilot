import { Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useViewStore } from "../store/viewStore";
import {
  closedRingHalfGradientOpacities,
  hexToRgbaVertexColors,
  progradeHalfVertexOpacities,
  retrogradeHalfVertexOpacities,
} from "./orbitTrailDirectionStyle";
import { splitOrbitTrailHalves } from "./splitOrbitTrailHalves";

type Point3 = [number, number, number];

const LINE_COLOR_FOR_VERTEX_COLORS = "#ffffff";

/** Line2 draws open polylines; duplicate the first vertex to close the ring. */
function closeRingPoints(points: Point3[]): Point3[] {
  if (points.length < 2) {
    return points;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const alreadyClosed =
    Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]) < 1e-6;
  return alreadyClosed ? points : [...points, first];
}

/**
 * KspSplitTrailWithHalfGradients — shared closed-ring drawer (V3 planet orbits).
 * - One ring motion tail: 1.0 at body (trailing), 0.25 prograde lead, linear ramp around orbit
 */
export function GradientDirectionalOrbitTrail({
  lineKey,
  lineColor,
  points,
  anchorIndex = 0,
  lineWidth = 1,
  progradeLineWidthFactor = 0.7,
  closedWithDuplicateEndpoint = false,
  sampleUniversalTimes,
  customizeMapPickable = false,
  customizeMapBodyName,
}: {
  lineKey: string;
  lineColor: string;
  points: Point3[];
  anchorIndex?: number;
  lineWidth?: number;
  progradeLineWidthFactor?: number;
  closedWithDuplicateEndpoint?: boolean;
  sampleUniversalTimes?: number[];
  useDenseRingHalves?: boolean;
  customizeMapPickable?: boolean;
  customizeMapBodyName?: string;
}) {
  const customizeEnabled = useViewStore((s) => s.devCustomizeMapEnabled);
  const selectedPlanet = useViewStore((s) => s.customizeMapSelectedPlanet);
  const setSelectedPlanet = useViewStore((s) => s.setCustomizeMapSelectedPlanet);

  if (points.length < 2) {
    return null;
  }

  const pickActive =
    customizeEnabled && customizeMapPickable && !!customizeMapBodyName;
  const isSelected = pickActive && customizeMapBodyName === selectedPlanet;
  const drawWidth =
    pickActive && isSelected
      ? lineWidth * 3
      : pickActive
        ? lineWidth * 2.5
        : lineWidth;

  const onPickPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!pickActive || !customizeMapBodyName) {
      return;
    }
    e.stopPropagation();
    setSelectedPlanet(customizeMapBodyName);
  };

  if (!closedWithDuplicateEndpoint && points.length >= 3) {
    const ringOpacities = closedRingHalfGradientOpacities(
      points.length,
      anchorIndex,
      sampleUniversalTimes,
    );
    const closedPoints = closeRingPoints(points);
    const closedOpacities =
      closedPoints.length === points.length
        ? ringOpacities
        : [...ringOpacities, ringOpacities[0]];
    const ringVertexColors = hexToRgbaVertexColors(lineColor, closedOpacities);
    return (
      <Line
        key={`${lineKey}-ring`}
        points={closedPoints}
        color={LINE_COLOR_FOR_VERTEX_COLORS}
        vertexColors={ringVertexColors}
        lineWidth={drawWidth}
        toneMapped={false}
        transparent
        depthWrite
        onPointerDown={pickActive ? onPickPointerDown : undefined}
      />
    );
  }

  const { retrograde, prograde } = splitOrbitTrailHalves(
    points,
    anchorIndex,
    closedWithDuplicateEndpoint,
    sampleUniversalTimes,
  );

  const progradeWidth = lineWidth * progradeLineWidthFactor;
  const retroVertexColors = hexToRgbaVertexColors(
    lineColor,
    retrogradeHalfVertexOpacities(retrograde.points.length),
  );
  const progradeVertexColors = hexToRgbaVertexColors(
    lineColor,
    progradeHalfVertexOpacities(prograde.points.length),
  );

  return (
    <group>
      {retrograde.points.length >= 2 ? (
        <Line
          key={`${lineKey}-retro`}
          points={retrograde.points}
          color={LINE_COLOR_FOR_VERTEX_COLORS}
          vertexColors={retroVertexColors}
          lineWidth={lineWidth}
          toneMapped={false}
          transparent
          depthWrite
        />
      ) : null}
      {prograde.points.length >= 2 ? (
        <Line
          key={`${lineKey}-pro`}
          points={prograde.points}
          color={LINE_COLOR_FOR_VERTEX_COLORS}
          vertexColors={progradeVertexColors}
          lineWidth={progradeWidth}
          toneMapped={false}
          transparent
          depthWrite
        />
      ) : null}
    </group>
  );
}
