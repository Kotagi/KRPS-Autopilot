import * as THREE from "three";
import type { Vector3 } from "../telemetry/schema-v6";

export function smoothPathForLine(
  points: Vector3[],
  closed: boolean,
  targetCount: number,
): [number, number, number][] {
  if (points.length < 2) {
    return [];
  }
  if (points.length < 3) {
    return points.map((p) => [p.x, p.y, p.z]);
  }
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p.x, p.y, p.z)),
    closed,
    "centripetal",
  );
  const count = Math.max(targetCount, 3);
  return curve.getPoints(count).map((v) => [v.x, v.y, v.z]);
}
