/** Open-trail / per-chord prototype — not wired in V3. See docs/ORBIT_TRAIL_DRAWING_GUIDE.md */
import {
  opacityForTrailSegmentDirected,
  projectOntoSegment,
  resolveProgradeIndexStep,
} from "./orbitTrailDirectionStyle";

type Point3 = [number, number, number];

export type TrailDrawSegment = {
  points: [number, number, number][];
  opacity: number;
};

export function buildTrailDrawSegments(
  points: Point3[],
  anchorIndex: number,
  closedWithDuplicateEndpoint: boolean,
  iconPosition: Point3 | null | undefined,
  sampleUniversalTimes?: number[],
): TrailDrawSegment[] {
  if (points.length < 2) {
    return [];
  }

  const periodVertices = closedWithDuplicateEndpoint
    ? Math.max(points.length - 1, 1)
    : points.length;

  const drawSegments: TrailDrawSegment[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const segmentPeriodIndex =
      closedWithDuplicateEndpoint && i === periodVertices - 1
        ? periodVertices - 1
        : i;
    const a = points[i];
    const b = points[i + 1];

    const iconDistSq =
      iconPosition != null
        ? (a[0] - iconPosition[0]) ** 2
          + (a[1] - iconPosition[1]) ** 2
          + (a[2] - iconPosition[2]) ** 2
        : 0;
    const shouldSplit =
      iconPosition != null
      && segmentPeriodIndex === anchorIndex
      && anchorIndex === i
      && iconDistSq > 1e-8;

    if (shouldSplit) {
      const proj = projectOntoSegment(iconPosition, a, b);
      if (proj.t > 0.015 && proj.t < 0.985) {
        const retroOpacity = opacityForTrailSegmentDirected(
          segmentPeriodIndex,
          periodVertices,
          anchorIndex,
          sampleUniversalTimes,
          "retrograde",
        );
        const progradeOpacity = opacityForTrailSegmentDirected(
          segmentPeriodIndex,
          periodVertices,
          anchorIndex,
          sampleUniversalTimes,
          "prograde",
        );
        const step = resolveProgradeIndexStep(
          anchorIndex,
          periodVertices,
          sampleUniversalTimes,
        );
        if (step === 1) {
          drawSegments.push({ points: [a, proj.point], opacity: retroOpacity });
          drawSegments.push({ points: [proj.point, b], opacity: progradeOpacity });
        } else {
          drawSegments.push({ points: [a, proj.point], opacity: progradeOpacity });
          drawSegments.push({ points: [proj.point, b], opacity: retroOpacity });
        }
        continue;
      }
    }

    drawSegments.push({
      points: [a, b],
      opacity: opacityForTrailSegmentDirected(
        segmentPeriodIndex,
        periodVertices,
        anchorIndex,
        sampleUniversalTimes,
      ),
    });
  }

  return drawSegments;
}
