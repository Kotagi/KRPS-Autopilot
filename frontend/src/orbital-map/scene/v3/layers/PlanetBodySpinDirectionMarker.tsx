import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import {
  MESH_PRIME_MERIDIAN_EQUATOR_LOCAL,
  MESH_SPHERE_NORTH_LOCAL,
} from "../../../coords/kspBodyOrientation";
import type { CelestialBodyWithOrientation } from "../../../map-v3/elements/planetBody/planetBodyOrientationFields";
import { resolveStockSiderealSpinRateRadPerSec } from "../../../map-v3/elements/planetBody/planetBodySiderealSpin";

const MERIDIAN_COLOR = "#ff66cc";
const SPIN_ARROW_COLOR = "#66e0ff";
const ARROW_LENGTH_FACTOR = 0.38;
const ARROW_HEAD_FACTOR = 0.14;
const ARROW_HEAD_ANGLE = Math.PI / 7;

function buildSpinDirectionLines(
  radius: number,
  spinSign: number,
): {
  meridian: [number, number, number][];
  arrow: [number, number, number][];
} | null {
  if (radius <= 0 || spinSign === 0) {
    return null;
  }

  const surface = MESH_PRIME_MERIDIAN_EQUATOR_LOCAL.clone().multiplyScalar(radius);
  const radial = surface.clone().normalize();
  const tangent = new THREE.Vector3()
    .crossVectors(MESH_SPHERE_NORTH_LOCAL, radial)
    .normalize()
    .multiplyScalar(spinSign);

  if (tangent.lengthSq() < 1e-12) {
    return null;
  }

  const arrowLen = radius * ARROW_LENGTH_FACTOR;
  const headLen = radius * ARROW_HEAD_FACTOR;
  const tip = surface.clone().add(tangent.clone().multiplyScalar(arrowLen));
  const shaftBase = surface.clone().add(
    tangent.clone().multiplyScalar(Math.max(0, arrowLen - headLen)),
  );

  const wingLeft = tip
    .clone()
    .add(
      tangent
        .clone()
        .negate()
        .applyAxisAngle(MESH_SPHERE_NORTH_LOCAL, ARROW_HEAD_ANGLE)
        .setLength(headLen),
    );
  const wingRight = tip
    .clone()
    .add(
      tangent
        .clone()
        .negate()
        .applyAxisAngle(MESH_SPHERE_NORTH_LOCAL, -ARROW_HEAD_ANGLE)
        .setLength(headLen),
    );

  return {
    meridian: [
      [0, 0, 0],
      [surface.x, surface.y, surface.z],
    ],
    arrow: [
      [shaftBase.x, shaftBase.y, shaftBase.z],
      [tip.x, tip.y, tip.z],
      [wingLeft.x, wingLeft.y, wingLeft.z],
      [tip.x, tip.y, tip.z],
      [wingRight.x, wingRight.y, wingRight.z],
    ],
  };
}

/**
 * Prime meridian + equator tangent arrow in **pole-frame** local space (same frame as
 * SphereGeometry). Must live inside PlanetBodyMeshPoleFrame — not PlanetBodyOrientedGroup.
 */
export function PlanetBodySpinDirectionMarker({
  radius,
  body,
}: {
  radius: number;
  body: CelestialBodyWithOrientation | undefined;
}) {
  const lines = useMemo(() => {
    if (body?.rotates === false) {
      return null;
    }
    const rate = resolveStockSiderealSpinRateRadPerSec(body);
    if (rate == null || !Number.isFinite(rate)) {
      return null;
    }
    const spinSign = Math.sign(rate) || 1;
    return buildSpinDirectionLines(radius, spinSign);
  }, [
    radius,
    body?.rotates,
    body?.rotationPeriodSeconds,
    body?.inverseRotation,
  ]);

  if (!lines) {
    return null;
  }

  return (
    <group renderOrder={3}>
      <Line points={lines.meridian} color={MERIDIAN_COLOR} lineWidth={2} />
      <Line points={lines.arrow} color={SPIN_ARROW_COLOR} lineWidth={2.5} />
    </group>
  );
}
