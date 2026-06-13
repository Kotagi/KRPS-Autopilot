import * as THREE from "three";
import type { Vector3 } from "../telemetry/schema-v6";

/** Body-fixed → root inertial, KSP root-relative axes (same as position telemetry). */
export interface KspRootQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Permutation matrix M: v_three = M · v_ksp  (matches {@link kspRootToThree}). */
const KSP_TO_THREE_BASIS = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
);

const _basisQuat = new THREE.Quaternion();
_basisQuat.setFromRotationMatrix(KSP_TO_THREE_BASIS);
const _basisQuatInverse = _basisQuat.clone().invert();

/** KSP root vector → Three.js (x, z, -y). */
export function kspRootVectorToThree(v: Vector3): THREE.Vector3 {
  return new THREE.Vector3(v.x, v.z, -v.y);
}

/** KSP root vector → tuple for R3F props. */
export function kspRootVectorToThreeTuple(v: Vector3): [number, number, number] {
  return [v.x, v.z, -v.y];
}

/**
 * Orientation similarity transform: Q_three = M · Q_ksp · M⁻¹
 * Maps body-fixed vectors into the same Three frame as {@link kspRootToThree}.
 */
export function kspRootQuaternionToThree(q: KspRootQuaternion): THREE.Quaternion {
  const ksp = new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();
  return _basisQuat.clone().multiply(ksp).multiply(_basisQuatInverse);
}

export function kspRootAngularVelocityToThree(v: Vector3): THREE.Vector3 {
  return kspRootVectorToThree(v);
}

/** Axis-angle quaternion in KSP root frame (axis need not be normalized). */
export function kspRootQuaternionFromAxisAngle(
  axis: Vector3,
  angleRadians: number,
): KspRootQuaternion {
  const q = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(axis.x, axis.y, axis.z).normalize(),
    angleRadians,
  );
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/** Sidereal spin about KSP +Y (stock north pole axis before obliquity tilt). */
export function kspRootQuaternionSpinAboutNorth(
  rotationAngleRadians: number,
): KspRootQuaternion {
  return kspRootQuaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, rotationAngleRadians);
}

/** Obliquity POC: tilt spin axis in KSP root frame (e.g. 23.5° about +X). */
export function kspRootQuaternionObliquityTilt(
  obliquityRadians: number,
  spinAngleRadians = 0,
): KspRootQuaternion {
  const tilt = kspRootQuaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, obliquityRadians);
  const spin = kspRootQuaternionSpinAboutNorth(spinAngleRadians);
  const combined = new THREE.Quaternion(tilt.x, tilt.y, tilt.z, tilt.w).multiply(
    new THREE.Quaternion(spin.x, spin.y, spin.z, spin.w),
  );
  return { x: combined.x, y: combined.y, z: combined.z, w: combined.w };
}

export function normalizeKspRootQuaternion(q: KspRootQuaternion): KspRootQuaternion {
  const n = new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();
  return { x: n.x, y: n.y, z: n.z, w: n.w };
}

/** Compose KSP root quaternions: result = a ⊗ b (same convention as Three multiply). */
export function multiplyKspRootQuaternions(
  a: KspRootQuaternion,
  b: KspRootQuaternion,
): KspRootQuaternion {
  const qa = new THREE.Quaternion(a.x, a.y, a.z, a.w).normalize();
  const qb = new THREE.Quaternion(b.x, b.y, b.z, b.w).normalize();
  qa.multiply(qb);
  return { x: qa.x, y: qa.y, z: qa.z, w: qa.w };
}

export const KSP_ROOT_IDENTITY_QUATERNION: KspRootQuaternion = {
  x: 0,
  y: 0,
  z: 0,
  w: 1,
};

/**
 * KSP body +Y (north) expressed in the Three.js body-fixed basis (before attitude quaternion).
 * Matches {@link kspRootVectorToThree} on (0,1,0)_ksp.
 */
export const KSP_BODY_NORTH_LOCAL_THREE = new THREE.Vector3(0, 0, -1);

/** +90° about KSP X: Unity world → root-relative (matches OrbitFrameMapping.cs). */
const WORLD_TO_ROOT_REL_QUAT = new THREE.Quaternion(
  Math.SQRT1_2,
  0,
  0,
  Math.SQRT1_2,
);

/** Unity world quaternion → same root-relative frame as getRelativePositionAtUT. */
export function kspWorldQuaternionToRootRelative(
  q: KspRootQuaternion,
): KspRootQuaternion {
  const world = new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize();
  const root = WORLD_TO_ROOT_REL_QUAT.clone().multiply(world);
  return { x: root.x, y: root.y, z: root.z, w: root.w };
}

export function kspWorldVectorToRootRelative(v: Vector3): Vector3 {
  const out = new THREE.Vector3(v.x, v.y, v.z).applyQuaternion(
    WORLD_TO_ROOT_REL_QUAT,
  );
  return { x: out.x, y: out.y, z: out.z };
}

/** Rotates default sphere +Y pole onto {@link KSP_BODY_NORTH_LOCAL_THREE}. */
const _meshPoleOffset = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
);

export function kspMeshPoleOffsetQuaternion(): THREE.Quaternion {
  return _meshPoleOffset.clone();
}

/** KSP north pole direction in root inertial frame. */
export function kspNorthPoleRootDirection(q: KspRootQuaternion): Vector3 {
  return rotateKspRootVector(q, { x: 0, y: 1, z: 0 });
}

/** Rotate a KSP root vector by a KSP root quaternion (body → root). */
export function rotateKspRootVector(q: KspRootQuaternion, v: Vector3): Vector3 {
  const vec = new THREE.Vector3(v.x, v.y, v.z);
  vec.applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w).normalize());
  return { x: vec.x, y: vec.y, z: vec.z };
}

/** Exposed for tests — angle between two unit vectors in degrees. */
export function angleBetweenDegrees(a: THREE.Vector3, b: THREE.Vector3): number {
  return THREE.MathUtils.radToDeg(a.clone().normalize().angleTo(b.clone().normalize()));
}
