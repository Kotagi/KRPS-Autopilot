import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vector3 } from "../../../telemetry/schema-v6";
import {
  kspRootAngularVelocityToThree,
  kspRootQuaternionToThree,
  type KspRootQuaternion,
} from "../../../coords/kspBodyOrientation";

/**
 * Applies body attitude in the scene.
 *
 * - Production map: pass resolved `orientationKsp` at game UT only (no frame spin).
 * - Lab presets: `frameSpin` integrates inertial ω with pre-multiply between frames.
 */
export function PlanetBodyOrientedGroup({
  orientationKsp,
  angularVelocityKsp,
  frameSpin = false,
  children,
}: {
  orientationKsp: KspRootQuaternion;
  angularVelocityKsp?: Vector3;
  /** Lab only — animate spin about inertial ω between frames (not combined with UT resolve). */
  frameSpin?: boolean;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const spinAccumRef = useRef(new THREE.Quaternion());

  const baseQuaternion = useMemo(
    () => kspRootQuaternionToThree(orientationKsp),
    [orientationKsp.x, orientationKsp.y, orientationKsp.z, orientationKsp.w],
  );

  const spinAxisThree = useMemo(() => {
    if (!angularVelocityKsp) {
      return null;
    }
    const v = kspRootAngularVelocityToThree(angularVelocityKsp);
    if (v.lengthSq() < 1e-12) {
      return null;
    }
    return v.normalize();
  }, [angularVelocityKsp?.x, angularVelocityKsp?.y, angularVelocityKsp?.z]);

  const spinSpeed = useMemo(() => {
    if (!angularVelocityKsp) {
      return 0;
    }
    return Math.hypot(
      angularVelocityKsp.x,
      angularVelocityKsp.y,
      angularVelocityKsp.z,
    );
  }, [angularVelocityKsp?.x, angularVelocityKsp?.y, angularVelocityKsp?.z]);

  useEffect(() => {
    spinAccumRef.current.copy(baseQuaternion);
    const group = groupRef.current;
    if (group && !frameSpin) {
      group.quaternion.copy(baseQuaternion);
    }
  }, [baseQuaternion, frameSpin]);

  useFrame((_state, delta) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }

    if (!frameSpin) {
      group.quaternion.copy(baseQuaternion);
      return;
    }

    if (spinAxisThree && spinSpeed > 0) {
      const dq = new THREE.Quaternion().setFromAxisAngle(
        spinAxisThree,
        spinSpeed * delta,
      );
      spinAccumRef.current.premultiply(dq);
    } else {
      spinAccumRef.current.copy(baseQuaternion);
    }
    group.quaternion.copy(spinAccumRef.current);
  });

  return <group ref={groupRef}>{children}</group>;
}
