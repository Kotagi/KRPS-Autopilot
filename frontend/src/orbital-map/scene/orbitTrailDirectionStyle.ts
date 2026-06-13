/** KSP-style body orbit trail: solid retrograde behind icon, faint prograde ahead. */

export const ORBIT_TRAIL_LINE_COLOR = "#9db1c3";

/** Retrograde arc at/behind the icon — fully opaque. */
export const ORBIT_TRAIL_OPACITY_TRAILING = 1;

/** Prograde arc ahead of the icon (step-style planners / legacy). */
export const ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON = 0.2;

/** Motion tail: bold where orbit meets the body from behind (retrograde attach). */
export const ORBIT_TRAIL_TAIL_ATTACH = 0.85;
/** Motion tail: faint leading edge in prograde direction (ahead of the body). */
export const ORBIT_TRAIL_TAIL_LEAD = 0.25;

/** Retrograde arc — full strength, no fade (split-trail fallback). */
export const ORBIT_TRAIL_HALF_RETRO_BODY = ORBIT_TRAIL_TAIL_ATTACH;
export const ORBIT_TRAIL_HALF_RETRO_FAR = ORBIT_TRAIL_TAIL_ATTACH;
/** @deprecated Use {@link ORBIT_TRAIL_TAIL_LEAD}. */
export const ORBIT_TRAIL_HALF_PROGRADE_BODY = ORBIT_TRAIL_TAIL_LEAD;
/** @deprecated Use {@link ORBIT_TRAIL_TAIL_LEAD}. */
export const ORBIT_TRAIL_HALF_PROGRADE_FAR = ORBIT_TRAIL_TAIL_LEAD;

/**
 * Opacity for a vertex on a body orbit trail (anchored at sample 0 = body at capture UT).
 * Sample order is forward in time: low `ahead` = prograde, high `ahead` ≈ trailing before wrap.
 */
export function opacityAlongTrailIndex(
  index: number,
  pointCount: number,
  anchorIndex = 0,
): number {
  if (pointCount <= 1) {
    return ORBIT_TRAIL_OPACITY_TRAILING;
  }

  const ahead = (index - anchorIndex + pointCount) % pointCount;

  if (ahead === 0) {
    return ORBIT_TRAIL_OPACITY_TRAILING;
  }

  const progradeHorizon = Math.max(1, Math.floor((pointCount - 1) / 2));

  if (ahead <= progradeHorizon) {
    return ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON;
  }

  return ORBIT_TRAIL_OPACITY_TRAILING;
}

/**
 * Opacity for one drawn chord (not averaged across the anchor).
 * Segment starting at the anchor leaves prograde; segment ending at the anchor is retrograde.
 */
export function opacityForTrailSegment(
  segmentIndex: number,
  periodVertices: number,
  anchorIndex = 0,
): number {
  const fromAhead =
    (segmentIndex - anchorIndex + periodVertices) % periodVertices;
  const toAhead =
    (segmentIndex + 1 - anchorIndex + periodVertices) % periodVertices;

  if (fromAhead === 0) {
    return ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON;
  }
  if (toAhead === 0) {
    return ORBIT_TRAIL_OPACITY_TRAILING;
  }

  const progradeHorizon = Math.max(1, Math.floor((periodVertices - 1) / 2));
  if (fromAhead <= progradeHorizon) {
    return ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON;
  }
  return ORBIT_TRAIL_OPACITY_TRAILING;
}

export function projectOntoSegment(
  p: [number, number, number],
  a: [number, number, number],
  b: [number, number, number],
): { point: [number, number, number]; t: number; distSq: number } {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const abLenSq = abx * abx + aby * aby + abz * abz;
  if (abLenSq < 1e-18) {
    return { point: [...a], t: 0, distSq: 0 };
  }
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const apz = p[2] - a[2];
  let t = (apx * abx + apy * aby + apz * abz) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  return {
    point: [a[0] + abx * t, a[1] + aby * t, a[2] + abz * t],
    t,
    distSq:
      (p[0] - (a[0] + abx * t)) ** 2
      + (p[1] - (a[1] + aby * t)) ** 2
      + (p[2] - (a[2] + abz * t)) ** 2,
  };
}

/** +1 when sample index increases with universal time (prograde). */
export function resolveProgradeIndexStep(
  anchorIndex: number,
  periodVertices: number,
  sampleUniversalTimes?: number[],
): 1 | -1 {
  if (
    !sampleUniversalTimes
    || sampleUniversalTimes.length < 2
    || anchorIndex < 0
    || anchorIndex >= periodVertices
  ) {
    return 1;
  }

  const tAnchor = sampleUniversalTimes[anchorIndex];
  const tNext = sampleUniversalTimes[(anchorIndex + 1) % periodVertices];
  const tPrev =
    sampleUniversalTimes[
      (anchorIndex - 1 + periodVertices) % periodVertices
    ];

  if (!Number.isFinite(tAnchor) || !Number.isFinite(tNext) || !Number.isFinite(tPrev)) {
    return 1;
  }

  const forwardDelta = tNext - tAnchor;
  const backwardDelta = tAnchor - tPrev;

  if (forwardDelta > 0 && forwardDelta < backwardDelta) {
    return 1;
  }
  if (backwardDelta > 0 && backwardDelta <= forwardDelta) {
    return -1;
  }
  return forwardDelta >= backwardDelta ? 1 : -1;
}

function aheadAlongPrograde(
  index: number,
  anchorIndex: number,
  periodVertices: number,
  progradeStep: 1 | -1,
): number {
  if (progradeStep === 1) {
    return (index - anchorIndex + periodVertices) % periodVertices;
  }
  return (anchorIndex - index + periodVertices) % periodVertices;
}

export function opacityForTrailSegmentDirected(
  segmentIndex: number,
  periodVertices: number,
  anchorIndex: number,
  sampleUniversalTimes?: number[],
  half?: "prograde" | "retrograde",
): number {
  const progradeStep = resolveProgradeIndexStep(
    anchorIndex,
    periodVertices,
    sampleUniversalTimes,
  );
  const fromAhead = aheadAlongPrograde(
    segmentIndex,
    anchorIndex,
    periodVertices,
    progradeStep,
  );
  const toAhead = aheadAlongPrograde(
    (segmentIndex + 1) % periodVertices,
    anchorIndex,
    periodVertices,
    progradeStep,
  );

  if (half === "retrograde") {
    return ORBIT_TRAIL_OPACITY_TRAILING;
  }
  if (half === "prograde") {
    return ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON;
  }

  if (fromAhead === 0) {
    return ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON;
  }
  if (toAhead === 0) {
    return ORBIT_TRAIL_OPACITY_TRAILING;
  }

  const progradeHorizon = Math.max(1, Math.floor((periodVertices - 1) / 2));
  if (fromAhead <= progradeHorizon) {
    return ORBIT_TRAIL_OPACITY_PROGRADE_AT_ICON;
  }
  return ORBIT_TRAIL_OPACITY_TRAILING;
}

/** Nearest period vertex to the icon (keeps sample times aligned with geometry). */
export function findTrailAnchorOnPeriod(
  points: [number, number, number][],
  iconPosition: [number, number, number] | null,
  closedWithDuplicateEndpoint: boolean,
): number {
  if (!iconPosition || points.length < 2) {
    return 0;
  }

  const period = closedWithDuplicateEndpoint
    ? points.slice(0, -1)
    : points;
  if (period.length === 0) {
    return 0;
  }

  const segmentCount = closedWithDuplicateEndpoint
    ? period.length
    : period.length - 1;

  let bestSeg = 0;
  let bestProj = projectOntoSegment(iconPosition, period[0], period[1 % period.length]);
  for (let i = 0; i < segmentCount; i++) {
    const a = period[i];
    const b = period[(i + 1) % period.length];
    const proj = projectOntoSegment(iconPosition, a, b);
    if (proj.distSq < bestProj.distSq) {
      bestProj = proj;
      bestSeg = i;
    }
  }

  return bestProj.t < 0.5
    ? bestSeg
    : (bestSeg + 1) % period.length;
}

/** Per-vertex opacities; handles closed loop with duplicated first point at the end. */
type Point3 = { x: number; y: number; z: number } | [number, number, number];

function pointCoords(p: Point3): [number, number, number] {
  return Array.isArray(p) ? p : [p.x, p.y, p.z];
}

function angleDeltaRadians(a: number, b: number): number {
  let delta = a - b;
  while (delta > Math.PI) {
    delta -= Math.PI * 2;
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return Math.abs(delta);
}

/** Ecliptic-plane phase (Three.js XZ) for closed-orbit anchor selection. */
function eclipticAngle(point: Point3): number {
  const [x, , z] = pointCoords(point);
  return Math.atan2(z, x);
}

/** Index on the drawn polyline closest to the body icon in orbital phase. */
export function findTrailAnchorIndex(
  points: Point3[],
  bodyPosition: Point3 | null | undefined,
): number {
  if (!bodyPosition || points.length === 0) {
    return 0;
  }

  const closed =
    points.length >= 3 &&
    (() => {
      const [fx, fy, fz] = pointCoords(points[0]);
      const [lx, ly, lz] = pointCoords(points[points.length - 1]);
      return fx === lx && fy === ly && fz === lz;
    })();
  const period = closed ? points.slice(0, -1) : points;

  if (period.length === 0) {
    return 0;
  }

  const bodyAngle = eclipticAngle(bodyPosition);
  let bestIndex = 0;
  let bestAngleDelta = Infinity;
  let bestDistSq = Infinity;

  period.forEach((point, index) => {
    const phaseDelta = angleDeltaRadians(eclipticAngle(point), bodyAngle);
    const [x, y, z] = pointCoords(point);
    const [tx, ty, tz] = pointCoords(bodyPosition);
    const dx = x - tx;
    const dy = y - ty;
    const dz = z - tz;
    const distSq = dx * dx + dy * dy + dz * dz;
    if (
      phaseDelta < bestAngleDelta - 1e-9
      || (Math.abs(phaseDelta - bestAngleDelta) <= 1e-9 && distSq < bestDistSq)
    ) {
      bestAngleDelta = phaseDelta;
      bestDistSq = distSq;
      bestIndex = index;
    }
  });

  return bestIndex;
}

/** Rotate polyline so the body anchor is index 0 (prograde = increasing index). */
export function rotateTrailToAnchorIndex<T extends Point3>(
  points: T[],
  anchorIndex: number,
  closedWithDuplicateEndpoint: boolean,
): T[] {
  if (anchorIndex <= 0 || points.length < 2) {
    return points;
  }

  if (closedWithDuplicateEndpoint) {
    const period = points.slice(0, -1);
    const count = period.length;
    if (count === 0) {
      return points;
    }
    const start = anchorIndex % count;
    const rotated = [...period.slice(start), ...period.slice(0, start)];
    return [...rotated, rotated[0]] as T[];
  }

  const start = Math.min(anchorIndex, points.length - 1);
  return [...points.slice(start), ...points.slice(0, start)] as T[];
}

/** RGBA vertex colors for drei Line (`color` must be `#ffffff`). */
export function hexToRgbaVertexColors(
  hex: string,
  opacities: number[],
): [number, number, number, number][] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return opacities.map((a) => [r, g, b, a]);
}

/** Linear fade along one half-orbit polyline (index 0 = body). */
export function halfOrbitVertexOpacities(
  vertexCount: number,
  opacityAtBody: number,
  opacityAtFar: number,
): number[] {
  if (vertexCount <= 1) {
    return [opacityAtBody];
  }
  const span = vertexCount - 1;
  return Array.from({ length: vertexCount }, (_, i) => {
    const t = i / span;
    return opacityAtFar + (opacityAtBody - opacityAtFar) * (1 - t);
  });
}

/**
 * Opacity along orbit in prograde order from the body: 1.0 at anchor (trailing attach),
 * 0.25 one step ahead (leading edge), then linear rise back to 1.0 before the rear meets the body.
 */
export function opacityForOrbitTailAhead(
  ahead: number,
  periodVertices: number,
): number {
  const n = Math.max(2, periodVertices);
  if (ahead <= 0) {
    return ORBIT_TRAIL_TAIL_ATTACH;
  }
  const span = Math.max(1, n - 2);
  const t = Math.min(1, Math.max(0, (ahead - 1) / span));
  return (
    ORBIT_TRAIL_TAIL_LEAD
    + (ORBIT_TRAIL_TAIL_ATTACH - ORBIT_TRAIL_TAIL_LEAD) * t
  );
}

/**
 * One closed ring motion tail (KSP-style direction cue).
 */
export function closedRingHalfGradientOpacities(
  periodVertices: number,
  anchorIndex: number,
  sampleUniversalTimes?: number[],
): number[] {
  const n = Math.max(2, periodVertices);
  const progradeStep = resolveProgradeIndexStep(
    anchorIndex,
    n,
    sampleUniversalTimes,
  );

  return Array.from({ length: n }, (_, periodIndex) => {
    const ahead = aheadAlongPrograde(
      periodIndex,
      anchorIndex,
      n,
      progradeStep,
    );
    return opacityForOrbitTailAhead(ahead, n);
  });
}

/** Retrograde half: solid 1.0 (no vertex fade). */
export function retrogradeHalfVertexOpacities(vertexCount: number): number[] {
  const count = Math.max(1, vertexCount);
  return Array.from({ length: count }, () => ORBIT_TRAIL_HALF_RETRO_BODY);
}

/** Prograde half of split trail: same linear tail ramp on an estimated full period. */
export function progradeHalfVertexOpacities(vertexCount: number): number[] {
  const count = Math.max(1, vertexCount);
  const estimatedPeriod = Math.max(2, (count - 1) * 2);
  return Array.from({ length: count }, (_, i) => {
    const ahead = i === 0 ? 0 : 1 + Math.round(((i - 1) / Math.max(1, count - 1)) * (estimatedPeriod - 2));
    return opacityForOrbitTailAhead(ahead, estimatedPeriod);
  });
}

export function trailVertexOpacities(
  vertexCount: number,
  anchorIndex = 0,
  closedWithDuplicateEndpoint = false,
): number[] {
  const periodVertices = closedWithDuplicateEndpoint
    ? Math.max(vertexCount - 1, 1)
    : vertexCount;

  return Array.from({ length: vertexCount }, (_, i) => {
    const periodIndex = closedWithDuplicateEndpoint && i === vertexCount - 1 ? anchorIndex : i;
    return opacityAlongTrailIndex(periodIndex, periodVertices, anchorIndex);
  });
}
