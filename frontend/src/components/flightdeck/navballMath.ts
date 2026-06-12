/** KSP / kRPC surface reference frame: +X zenith, +Y north, +Z east. */

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len <= 1e-9) return [0, 1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function quatFromAxisAngle(axis: Vec3, angleDeg: number): Quat {
  const half = degToRad(angleDeg) * 0.5;
  const s = Math.sin(half);
  const [ax, ay, az] = normalize(axis);
  return [ax * s, ay * s, az * s, Math.cos(half)];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

export function quatConjugate(q: Quat): Quat {
  return [-q[0], -q[1], -q[2], q[3]];
}

/** kRPC surface frame axes. */
export const SURFACE_ZENITH: Vec3 = [1, 0, 0];
export const SURFACE_NORTH: Vec3 = [0, 1, 0];
export const SURFACE_EAST: Vec3 = [0, 0, 1];

export const PITCH_MARKS_SKY = [80, 70, 60, 50, 40, 30, 20, 10] as const;
export const PITCH_MARKS_GROUND = [-10, -20, -30, -40, -50, -60, -70, -80] as const;
export const PITCH_MARKS = [...PITCH_MARKS_SKY, ...PITCH_MARKS_GROUND] as const;

const FORWARD_HEMISPHERE_EPS = 1e-5;

/** KSP navball longitude lines and labels are spaced every 45°. */
export const HEADING_MERIDIAN_STEP = 45;

/** Pitch ring numbers are repeated on the four cardinal meridians. */
export const PITCH_LABEL_MERIDIANS = [0, 90, 180, 270] as const;

/** Distance from meridian line to each flanking pitch digit (viewBox units). */
const PITCH_LABEL_SIDE_OFFSET = 10.5;
/** Cardinal heading labels sit closer to the rim with a slightly tighter flank. */
const HEADING_LABEL_SIDE_OFFSET = 7.5;

export interface PitchRingLabel {
  mark: number;
  meridianDeg: number;
  side: -1 | 1;
  text: string;
  x: number;
  y: number;
  rotationDeg: number;
  isGround: boolean;
  isZenith: boolean;
}

function labelBesideMeridianFallback(
  baseProj: [number, number],
  zenithPos: [number, number] | null,
  side: -1 | 1,
  offsetDist: number
): [number, number] {
  const [x, y] = baseProj;
  const zx = zenithPos?.[0] ?? 0;
  const zy = zenithPos?.[1] ?? 0;
  const mx = zx - x;
  const my = zy - y;
  const len = Math.hypot(mx, my);
  if (len < 1e-6) {
    return [x + offsetDist * side, y];
  }
  const px = (-my / len) * offsetDist * side;
  const py = (mx / len) * offsetDist * side;
  return [x + px, y + py];
}

/** Offset along the pitch ring — perpendicular to the meridian on the sphere. */
function labelBesideMeridian(
  invQ: Quat,
  headingDeg: number,
  elevationDeg: number,
  radius: number,
  zenithPos: [number, number] | null,
  side: -1 | 1,
  offsetDist: number
): [number, number] | null {
  const elev = degToRad(elevationDeg);
  const h = degToRad(headingDeg);
  const azimuthStep = degToRad(4) * side;
  const baseSurface = meridianSurfacePointAtElevation(headingDeg, elevationDeg);
  const flankSurface = normalize([
    Math.sin(elev),
    Math.cos(elev) * Math.cos(h + azimuthStep),
    Math.cos(elev) * Math.sin(h + azimuthStep),
  ]);
  const baseProj = projectVesselDirection(quatRotate(invQ, baseSurface), radius);
  const flankProj = projectVesselDirection(quatRotate(invQ, flankSurface), radius);
  if (!baseProj) return null;
  if (!flankProj) {
    return labelBesideMeridianFallback(baseProj, zenithPos, side, offsetDist);
  }
  const dx = flankProj[0] - baseProj[0];
  const dy = flankProj[1] - baseProj[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return labelBesideMeridianFallback(baseProj, zenithPos, side, offsetDist);
  }
  return [baseProj[0] + (dx / len) * offsetDist, baseProj[1] + (dy / len) * offsetDist];
}

function pushCardinalPitchLabels(
  labels: PitchRingLabel[],
  invQ: Quat,
  radius: number,
  mark: number,
  text: string,
  heading: number,
  zenithPos: [number, number] | null,
  isGround: boolean,
  isZenith: boolean
): void {
  for (const side of [-1, 1] as const) {
    const pos = labelBesideMeridian(
      invQ,
      heading,
      mark,
      radius,
      zenithPos,
      side,
      PITCH_LABEL_SIDE_OFFSET
    );
    if (!pos) continue;
    const [ox, oy] = pos;
    labels.push({
      mark,
      meridianDeg: heading,
      side,
      text,
      x: ox,
      y: oy,
      rotationDeg: labelRotationTowardZenith(ox, oy, zenithPos),
      isGround,
      isZenith,
    });
  }
}

/** Rotate label so the top of the digit points toward surface zenith on the ball. */
export function labelRotationTowardZenith(
  x: number,
  y: number,
  zenithPos: [number, number] | null
): number {
  const zx = zenithPos?.[0] ?? 0;
  const zy = zenithPos?.[1] ?? 0;
  const dx = zx - x;
  const dy = zy - y;
  if (Math.hypot(dx, dy) < 2) return 0;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

export function zenithDiscPosition(invQ: Quat, radius: number): [number, number] | null {
  return projectVesselDirection(quatRotate(invQ, SURFACE_ZENITH), radius);
}

/** KSP places one heading label per intercardinal meridian on the 45° pitch ring. */
export const INTERCARDINAL_LABEL_ELEVATION = 45;

export interface IntercardinalHeadingLabel {
  deg: number;
  text: string;
  x: number;
  y: number;
  rotationDeg: number;
  isGround: boolean;
}

/** One centered heading label (45, 135, 225, 315) on the 45° latitude ring per diagonal meridian. */
export function buildIntercardinalHeadingLabels(
  invQ: Quat,
  radius: number,
  pitchDeg: number
): IntercardinalHeadingLabel[] {
  const labels: IntercardinalHeadingLabel[] = [];
  const zenithPos = zenithDiscPosition(invQ, radius);
  const skySide = pitchDeg >= -8;
  const labelElev = skySide ? INTERCARDINAL_LABEL_ELEVATION : -INTERCARDINAL_LABEL_ELEVATION;

  for (let heading = 0; heading < 360; heading += HEADING_MERIDIAN_STEP) {
    if (isCardinalMeridian(heading)) continue;
    const surface = meridianSurfacePointAtElevation(heading, labelElev);
    const pos = projectVesselDirection(quatRotate(invQ, surface), radius);
    if (!pos) continue;
    const [x, y] = pos;
    labels.push({
      deg: heading,
      text: String(heading),
      x,
      y,
      rotationDeg: labelRotationTowardZenith(x, y, zenithPos),
      isGround: !skySide,
    });
  }

  return labels;
}

/** KSP-style pitch labels on N/E/S/W meridians only; diagonals show heading instead. */
export function buildPitchRingLabels(
  invQ: Quat,
  radius: number,
  pitchDeg: number
): PitchRingLabel[] {
  const labels: PitchRingLabel[] = [];
  const zenithPos = zenithDiscPosition(invQ, radius);

  for (const mark of PITCH_MARKS) {
    const text = String(Math.abs(mark));
    for (const heading of PITCH_LABEL_MERIDIANS) {
      const surface = meridianSurfacePointAtElevation(heading, mark);
      const vessel = quatRotate(invQ, surface);
      const pos = projectVesselDirection(vessel, radius);
      if (!pos) continue;
      pushCardinalPitchLabels(labels, invQ, radius, mark, text, heading, zenithPos, mark < 0, false);
    }
  }

  if (Math.abs(pitchDeg) >= 75) {
    for (const heading of PITCH_LABEL_MERIDIANS) {
      const surface = meridianSurfacePointAtElevation(heading, 88);
      const vessel = quatRotate(invQ, surface);
      const pos = projectVesselDirection(vessel, radius);
      if (!pos) continue;
      pushCardinalPitchLabels(labels, invQ, radius, 90, "90", heading, zenithPos, false, true);
    }
  }

  return labels;
}

/** Quaternion rotating vessel-frame vectors into kRPC surface frame. */
export function vesselToSurfaceQuat(
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number
): Quat {
  const zenith: Vec3 = [1, 0, 0];
  let q = quatFromAxisAngle(zenith, headingDeg);
  q = quatMultiply(q, quatFromAxisAngle([0, 0, 1], -pitchDeg));
  q = quatMultiply(q, quatFromAxisAngle([0, 1, 0], rollDeg));
  return q;
}

export function surfaceToVesselQuat(
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number
): Quat {
  return quatConjugate(vesselToSurfaceQuat(headingDeg, pitchDeg, rollDeg));
}

/** kRPC vessel frame: +X right, +Y forward (nose), +Z down. Screen maps X right, Z down, Y into ball. */
export function projectVesselDirection(dir: Vec3, radius: number): [number, number] | null {
  const d = normalize(dir);
  if (d[1] <= FORWARD_HEMISPHERE_EPS) return null;
  return [d[0] * radius, d[2] * radius];
}

export function projectToDisc(dir: Vec3, radius: number): [number, number] | null {
  const d = normalize(dir);
  if (d[1] > 0.001) {
    return [d[0] * radius, d[2] * radius];
  }
  const planar = Math.hypot(d[0], d[2]);
  if (planar < 0.001) return null;
  return [(d[0] / planar) * radius, (d[2] / planar) * radius];
}

export function discToVesselDirection(u: number, v: number): Vec3 {
  const r2 = u * u + v * v;
  if (r2 > 1) return [0, 1, 0];
  return [u, Math.sqrt(1 - r2), v];
}

export function surfaceHorizonDirection(headingDeg: number): Vec3 {
  const h = degToRad(headingDeg);
  return normalize([0, Math.cos(h), Math.sin(h)]);
}

export function projectHorizonMark(
  invQ: Quat,
  headingDeg: number,
  radius: number,
  radialScale = 1
): [number, number] | null {
  const vessel = quatRotate(invQ, surfaceHorizonDirection(headingDeg));
  return projectToDisc(vessel, radius * radialScale);
}

export interface MeridianLabelSlot {
  x: number;
  y: number;
  rotationDeg: number;
  side: -1 | 1;
}

export interface HeadingMeridian {
  deg: number;
  label: string;
  isNorth: boolean;
  labelSlots: MeridianLabelSlot[];
  innerLabelSlots: MeridianLabelSlot[];
}

function isCardinalMeridian(headingDeg: number): boolean {
  return (PITCH_LABEL_MERIDIANS as readonly number[]).includes(headingDeg);
}

function meridianLabelSlots(
  invQ: Quat,
  headingDeg: number,
  elevationDeg: number,
  radius: number,
  zenithPos: [number, number] | null,
  isCardinal: boolean
): MeridianLabelSlot[] {
  if (!isCardinal) {
    const baseSurface = meridianSurfacePointAtElevation(headingDeg, elevationDeg);
    const pos = projectVesselDirection(quatRotate(invQ, baseSurface), radius);
    if (!pos) return [];
    const [x, y] = pos;
    return [{ x, y, rotationDeg: labelRotationTowardZenith(x, y, zenithPos), side: 1 }];
  }
  return ([-1, 1] as const).flatMap((side) => {
    const pos = labelBesideMeridian(
      invQ,
      headingDeg,
      elevationDeg,
      radius,
      zenithPos,
      side,
      HEADING_LABEL_SIDE_OFFSET
    );
    if (!pos) return [];
    const [x, y] = pos;
    return [{ x, y, rotationDeg: labelRotationTowardZenith(x, y, zenithPos), side }];
  });
}

/**
 * Sample the full great-circle meridian (360°), not just nadir→zenith.
 * The visible forward-hemisphere arc often lies on the opposite semicircle
 * once pitch/heading/roll change, which caused lines to stop mid-ball.
 */
export function meridianSurfacePoints(headingDeg: number, segments = 144): Vec3[] {
  const h = degToRad(headingDeg);
  const horizon: Vec3 = [0, Math.cos(h), Math.sin(h)];
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const elev = degToRad(-90 + (360 * i) / segments);
    const ce = Math.cos(elev);
    const se = Math.sin(elev);
    points.push([se, ce * horizon[1], ce * horizon[2]]);
  }
  return points;
}

/** Point on a meridian at elevation above the horizon (0° = horizon, 90° = zenith). */
export function meridianSurfacePointAtElevation(
  headingDeg: number,
  elevationDeg: number
): Vec3 {
  const h = degToRad(headingDeg);
  const elev = degToRad(elevationDeg);
  const ce = Math.cos(elev);
  const se = Math.sin(elev);
  return normalize([se, ce * Math.cos(h), ce * Math.sin(h)]);
}

function surfacePathSegments(
  points: Vec3[],
  invQ: Quat,
  radius: number
): [number, number][][] {
  const segments: [number, number][][] = [];
  let current: [number, number][] = [];
  for (const surface of points) {
    const vessel = quatRotate(invQ, surface);
    const projected = projectVesselDirection(vessel, radius);
    if (!projected) {
      if (current.length > 1) {
        segments.push(current);
      }
      current = [];
      continue;
    }
    current.push(projected);
  }
  if (current.length > 1) {
    segments.push(current);
  }
  return segments;
}

function strokeSurfacePath(
  ctx: CanvasRenderingContext2D,
  points: Vec3[],
  invQ: Quat,
  radius: number,
  centerX: number,
  centerY: number
): void {
  for (const segment of surfacePathSegments(points, invQ, radius)) {
    ctx.beginPath();
    const [first, ...rest] = segment;
    ctx.moveTo(centerX + first[0], centerY + first[1]);
    for (const [x, y] of rest) {
      ctx.lineTo(centerX + x, centerY + y);
    }
    ctx.stroke();
  }
}

export function drawNavballGrid(
  ctx: CanvasRenderingContext2D,
  radius: number,
  invQ: Quat,
  centerX = radius,
  centerY = radius
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const mark of PITCH_MARKS) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 1.25;
    strokeSurfacePath(ctx, pitchRingSurfacePoints(mark), invQ, radius, centerX, centerY);
  }

  ctx.restore();
}

export function meridianSvgPath(invQ: Quat, headingDeg: number, radius: number): string | null {
  const path = projectSurfacePath(meridianSurfacePoints(headingDeg), invQ, radius);
  if (!path || !path.includes(" L ")) return null;
  return path;
}

/** Horizon-ring heading labels for 45° meridians only (cardinals use pitch digits). */
export function buildHeadingMeridians(
  invQ: Quat,
  radius: number,
  pitchDeg: number
): HeadingMeridian[] {
  const absPitch = Math.abs(pitchDeg);
  const skySide = pitchDeg >= -8;
  const labelMagnitude = absPitch >= 35 ? 42 : 28;
  const labelElev = skySide ? labelMagnitude : -labelMagnitude;
  const meridians: HeadingMeridian[] = [];
  const zenithPos = zenithDiscPosition(invQ, radius);

  for (let deg = 0; deg < 360; deg += HEADING_MERIDIAN_STEP) {
    const isNorth = deg === 0;
    const label = isNorth ? "N" : String(deg);
    const isCardinal = isCardinalMeridian(deg);
    if (isCardinal || absPitch >= 75) {
      meridians.push({ deg, label, isNorth, labelSlots: [], innerLabelSlots: [] });
      continue;
    }
    meridians.push({
      deg,
      label,
      isNorth,
      labelSlots: meridianLabelSlots(invQ, deg, labelElev, radius, zenithPos, false),
      innerLabelSlots: [],
    });
  }
  return meridians;
}

/** Pitch ring in surface frame: +X zenith, ring in Y–Z plane. */
export function pitchRingSurfacePoints(pitchMark: number, segments = 72): Vec3[] {
  const elev = degToRad(pitchMark);
  const x = Math.sin(elev);
  const ringRadius = Math.cos(elev);
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    points.push([x, Math.cos(t) * ringRadius, Math.sin(t) * ringRadius]);
  }
  return points;
}

export function projectSurfacePath(
  points: Vec3[],
  invQ: Quat,
  radius: number
): string | null {
  const arcs = surfacePathSegments(points, invQ, radius);
  if (arcs.length === 0) return null;
  const parts: string[] = [];
  for (const arc of arcs) {
    arc.forEach(([x, y], index) => {
      parts.push(`${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    });
  }
  return parts.join(" ");
}

export function projectCardinal(
  direction: Vec3,
  invQ: Quat,
  radius: number
): [number, number] | null {
  const vessel = quatRotate(invQ, direction);
  return projectToDisc(vessel, radius);
}

export function projectPrograde(
  prograde: Vec3,
  invQ: Quat,
  radius: number
): [number, number] | null {
  const vessel = quatRotate(invQ, normalize(prograde));
  return projectVesselDirection(vessel, radius);
}

export function skyGroundColor(zenithComponent: number): string {
  if (zenithComponent > 0.015) return "#7ad4ef";
  if (zenithComponent < -0.015) return "#8b5e34";
  return zenithComponent >= 0 ? "#7ad4ef" : "#8b5e34";
}

let scratchCanvas: HTMLCanvasElement | null = null;

function getScratchCanvas(size: number): HTMLCanvasElement {
  if (!scratchCanvas || scratchCanvas.width !== size || scratchCanvas.height !== size) {
    scratchCanvas = document.createElement("canvas");
    scratchCanvas.width = size;
    scratchCanvas.height = size;
  }
  return scratchCanvas;
}

export function paintNavballCanvas(
  ctx: CanvasRenderingContext2D,
  radius: number,
  vesselToSurface: Quat,
  centerX = radius,
  centerY = radius
): void {
  renderNavballSphereFromQuat(ctx, radius, vesselToSurface, centerX, centerY);
  drawNavballGrid(ctx, radius, quatConjugate(vesselToSurface), centerX, centerY);
}

export function renderNavballSphereFromQuat(
  ctx: CanvasRenderingContext2D,
  radius: number,
  vesselToSurface: Quat,
  centerX = radius,
  centerY = radius
): void {
  const size = radius * 2;
  const image = ctx.createImageData(size, size);
  const data = image.data;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const u = (px - radius + 0.5) / radius;
      const v = (py - radius + 0.5) / radius;
      const idx = (py * size + px) * 4;
      if (u * u + v * v > 1) {
        data[idx + 3] = 0;
        continue;
      }
      const vesselDir = discToVesselDirection(u, v);
      const surfaceDir = normalize(quatRotate(vesselToSurface, vesselDir));
      const color = skyGroundColor(surfaceDir[0]);
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  const scratch = getScratchCanvas(size);
  const scratchCtx = scratch.getContext("2d");
  if (!scratchCtx) return;
  scratchCtx.putImageData(image, 0, 0);
  ctx.drawImage(scratch, centerX - radius, centerY - radius, size, size);
}

export function renderNavballSphere(
  ctx: CanvasRenderingContext2D,
  radius: number,
  headingDeg: number,
  pitchDeg: number,
  rollDeg: number,
  centerX = radius,
  centerY = radius
): void {
  renderNavballSphereFromQuat(
    ctx,
    radius,
    vesselToSurfaceQuat(headingDeg, pitchDeg, rollDeg),
    centerX,
    centerY
  );
}
