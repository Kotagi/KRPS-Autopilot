import type { Vector3 } from "../telemetry/schema-v6";
import { kspRootToThree } from "./kspToThree";

export function applyWorldShift(
  position: Vector3,
  focus: Vector3 | null,
  displayScale: number,
): [number, number, number] {
  const scale = displayScale > 0 ? displayScale : 1;
  if (!focus) {
    const [x, y, z] = kspRootToThree(position);
    return [x * scale, y * scale, z * scale];
  }
  const shifted: Vector3 = {
    x: position.x - focus.x,
    y: position.y - focus.y,
    z: position.z - focus.z,
  };
  const [x, y, z] = kspRootToThree(shifted);
  return [x * scale, y * scale, z * scale];
}

export function getFocusPosition(
  bodies: { body: { name?: string }; position: Vector3 }[],
  focusBodyName: string | null,
): Vector3 | null {
  if (!focusBodyName) {
    return null;
  }
  const match = bodies.find((b) => b.body.name === focusBodyName);
  return match?.position ?? null;
}
