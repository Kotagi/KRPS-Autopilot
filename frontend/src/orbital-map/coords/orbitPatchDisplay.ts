import type { OrbitPatch } from "../telemetry/schema-v6";

/** Patched-conic chain index 0 is the vessel's current orbit at capture. */
export function isCurrentOrbitPatchIndex(patchIndex: number): boolean {
  return patchIndex === 0;
}

export function isFutureOrbitPatch(
  patch: OrbitPatch,
  gameUniversalTimeSeconds: number | undefined,
): boolean {
  const start = patch.patchStartUniversalTimeSeconds;
  if (start == null || gameUniversalTimeSeconds == null) {
    return false;
  }
  return gameUniversalTimeSeconds + 1 < start;
}
