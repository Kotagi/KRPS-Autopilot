import type { OrbitPickLine } from "./pickOrbitTrail";
import { orbitPickLinesEqual } from "./pickOrbitTrail";

/** Module registry — avoids zustand updates when trail geometry refreshes (prevents #185 loops). */
const pickLinesBySource = new Map<string, OrbitPickLine[]>();

export function registerCustomizeMapOrbitPickLines(
  sourceId: string,
  lines: OrbitPickLine[],
): void {
  const existing = pickLinesBySource.get(sourceId);
  if (existing && orbitPickLinesEqual(existing, lines)) {
    return;
  }
  if (lines.length === 0) {
    pickLinesBySource.delete(sourceId);
    return;
  }
  pickLinesBySource.set(sourceId, lines);
}

export function getCustomizeMapOrbitPickLines(): OrbitPickLine[] {
  const merged: OrbitPickLine[] = [];
  for (const lines of pickLinesBySource.values()) {
    merged.push(...lines);
  }
  return merged;
}

/** Clear all registered pick lines (e.g. when Customize Map is disabled). */
export function clearCustomizeMapOrbitPickRegistry(): void {
  pickLinesBySource.clear();
}

/** Test helper */
export function clearCustomizeMapOrbitPickRegistryForTests(): void {
  clearCustomizeMapOrbitPickRegistry();
}
