import type { VesselTelemetry } from "../api/types";

function quatNearlyEqual(
  a: [number, number, number, number] | undefined,
  b: [number, number, number, number] | undefined,
  eps = 1e-4
): boolean {
  if (!a || !b) return a === b;
  for (let i = 0; i < 4; i += 1) {
    if (Math.abs(a[i] - b[i]) > eps) return false;
  }
  return true;
}

function vec3NearlyEqual(
  a: [number, number, number] | undefined,
  b: [number, number, number] | undefined,
  eps = 1e-4
): boolean {
  if (!a || !b) return a === b;
  for (let i = 0; i < 3; i += 1) {
    if (Math.abs(a[i] - b[i]) > eps) return false;
  }
  return true;
}

/** True when navball-facing fields are unchanged between telemetry frames. */
export function navballTelemetryUnchanged(
  prev: VesselTelemetry | null,
  next: VesselTelemetry
): boolean {
  if (!prev) return false;
  return (
    Math.abs((prev.pitch_deg ?? 0) - (next.pitch_deg ?? 0)) < 0.01 &&
    Math.abs((prev.roll_deg ?? 0) - (next.roll_deg ?? 0)) < 0.01 &&
    Math.abs((prev.heading_deg ?? 0) - (next.heading_deg ?? 0)) < 0.01 &&
    Math.abs((prev.surface_speed_ms ?? 0) - (next.surface_speed_ms ?? 0)) < 0.05 &&
    quatNearlyEqual(prev.surface_rotation, next.surface_rotation) &&
    vec3NearlyEqual(prev.prograde, next.prograde)
  );
}

export function surfaceRotationKey(
  rotation: [number, number, number, number] | undefined
): string {
  if (!rotation) return "";
  return rotation.map((v) => v.toFixed(5)).join(",");
}
