import * as THREE from "three";

export type OrbitPickLine = {
  bodyName: string;
  points: [number, number, number][];
};

/** Skip redundant zustand writes when scene trails re-render with identical geometry. */
export function orbitPickLinesEqual(a: OrbitPickLine[], b: OrbitPickLine[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].bodyName !== b[i].bodyName) {
      return false;
    }
    const ap = a[i].points;
    const bp = b[i].points;
    if (ap.length !== bp.length) {
      return false;
    }
    if (ap.length === 0) {
      continue;
    }
    const a0 = ap[0];
    const b0 = bp[0];
    if (a0[0] !== b0[0] || a0[1] !== b0[1] || a0[2] !== b0[2]) {
      return false;
    }
    const al = ap[ap.length - 1];
    const bl = bp[bp.length - 1];
    if (al[0] !== bl[0] || al[1] !== bl[1] || al[2] !== bl[2]) {
      return false;
    }
  }
  return true;
}

const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const scratchOnRay = new THREE.Vector3();
const scratchOnSeg = new THREE.Vector3();

/** Closest orbit trail to a screen ray (scene-space threshold). */
export function pickOrbitTrail(
  ray: THREE.Ray,
  lines: OrbitPickLine[],
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

/** @deprecated Use {@link OrbitPickLine} */
export type PlanetOrbitPickLine = OrbitPickLine;

/** @deprecated Use {@link pickOrbitTrail} */
export const pickPlanetOrbitTrail = pickOrbitTrail;
