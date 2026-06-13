import * as THREE from "three";

export type PlanetOrbitPickLine = {
  bodyName: string;
  points: [number, number, number][];
};

const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const scratchOnRay = new THREE.Vector3();
const scratchOnSeg = new THREE.Vector3();

/** Closest planet orbit trail to a screen ray (scene-space threshold). */
export function pickPlanetOrbitTrail(
  ray: THREE.Ray,
  lines: PlanetOrbitPickLine[],
  maxDistanceScene: number,
): string | null {
  const maxSq = maxDistanceScene * maxDistanceScene;
  let bestBody: string | null = null;
  let bestDistSq = Infinity;

  for (const line of lines) {
    const pts = line.points;
    if (pts.length < 2) {
      continue;
    }
    const closed =
      pts.length >= 3 &&
      Math.hypot(
        pts[0][0] - pts[pts.length - 1][0],
        pts[0][1] - pts[pts.length - 1][1],
        pts[0][2] - pts[pts.length - 1][2],
      ) < 1e-3;
    const segCount = closed ? pts.length : pts.length - 1;

    for (let i = 0; i < segCount; i += 1) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      scratchA.set(p0[0], p0[1], p0[2]);
      scratchB.set(p1[0], p1[1], p1[2]);
      const distSq = ray.distanceSqToSegment(
        scratchA,
        scratchB,
        scratchOnRay,
        scratchOnSeg,
      );
      if (distSq <= maxSq && distSq < bestDistSq) {
        bestDistSq = distSq;
        bestBody = line.bodyName;
      }
    }
  }

  return bestBody;
}
