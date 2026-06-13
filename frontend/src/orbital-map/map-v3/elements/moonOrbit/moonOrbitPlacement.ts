import type { Vector3 } from "../../../telemetry/schema-v6";
import type { BodyEntry } from "../../MapContext";

/**
 * Parent-relative offsets (moon − parent at each sample UT, solar-root axes)
 * anchored to the parent's **current** root position for SOI-focused display.
 *
 * display = parent(now) + (moon(t) − parent(t))
 *
 * No body-orientation or reference-frame rotation — same authority as DLL samples.
 */
export function parentRelativeOffsetsAnchoredToParentNow(
  parentRelativeOffsets: Vector3[],
  parentEntry: BodyEntry,
): Vector3[] {
  const parentRoot = parentEntry.position;
  return parentRelativeOffsets.map((offset) => ({
    x: parentRoot.x + offset.x,
    y: parentRoot.y + offset.y,
    z: parentRoot.z + offset.z,
  }));
}

/** Unit normal of a closed ring (Newell), parent-relative offsets. */
export function moonOrbitRingPlaneNormal(
  parentRelativeOffsets: Vector3[],
): Vector3 | null {
  if (parentRelativeOffsets.length < 3) {
    return null;
  }
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const n = parentRelativeOffsets.length;
  for (let i = 0; i < n; i++) {
    const cur = parentRelativeOffsets[i]!;
    const next = parentRelativeOffsets[(i + 1) % n]!;
    nx += (cur.y - next.y) * (cur.z + next.z);
    ny += (cur.z - next.z) * (cur.x + next.x);
    nz += (cur.x - next.x) * (cur.y + next.y);
  }
  const len = Math.hypot(nx, ny, nz);
  if (!Number.isFinite(len) || len < 1e-6) {
    return null;
  }
  return { x: nx / len, y: ny / len, z: nz / len };
}
