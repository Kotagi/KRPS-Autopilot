import type { Vector3 } from "../telemetry/schema-v6";

export function isFiniteRootPoint(p: Vector3): boolean {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    Number.isFinite(p.z)
  );
}
