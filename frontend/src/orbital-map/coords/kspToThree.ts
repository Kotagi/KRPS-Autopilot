import type { Vector3 } from "../telemetry/schema-v6";

/** KSP root-relative meters → Three.js world (ecliptic in XY plane, +Z toward camera). */
export function kspRootToThree(position: Vector3): [number, number, number] {
  return [position.x, position.z, -position.y];
}

export function kspInertialToThree(position: Vector3): [number, number, number] {
  return [position.x, position.z, -position.y];
}

export function threeToKspRoot(x: number, y: number, z: number): Vector3 {
  return { x, y: -z, z: y };
}
