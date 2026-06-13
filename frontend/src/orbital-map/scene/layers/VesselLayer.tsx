import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useViewStore } from "../../store/viewStore";
import { applyWorldShift } from "../../coords/worldShift";
import { selectVesselPathLegContainingShip } from "../../coords/buildPatchConic";
import { isRenderableVesselRootPath } from "../vesselPathValidation";
import { distance3 } from "../../perf/pathSegments";
import { useTrajectoryFocus } from "./useTrajectoryFocus";

export function VesselLayer() {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const vesselTarget = useViewStore((s) => s.vesselTargetPosition);
  const meshRef = useRef<THREE.Mesh>(null);
  const displayPos = useRef(new THREE.Vector3());
  const focus = useTrajectoryFocus();

  const targetScene = useMemo(() => {
    if (!vesselTarget) {
      return null;
    }
    const [x, y, z] = applyWorldShift(vesselTarget, focus, displayScale);
    return new THREE.Vector3(x, y, z);
  }, [vesselTarget, focus, displayScale]);

  const pathSegments = useMemo(() => {
    if (!model?.vesselPathPoints.length) {
      return [];
    }
    const legs = selectVesselPathLegContainingShip(
      model.vesselPathPoints,
      model.vesselPosition,
    );
    const vesselPos = model.vesselPosition;
    return legs.map((leg) => {
      const shifted = leg.map((p) => applyWorldShift(p, focus, displayScale));
      if (!vesselPos || shifted.length === 0) {
        return shifted;
      }
      const nearVessel = leg.some((p) => distance3(p, vesselPos) < 1000);
      if (!nearVessel) {
        const [vx, vy, vz] = applyWorldShift(vesselPos, focus, displayScale);
        shifted.push([vx, vy, vz]);
      }
      return shifted;
    });
  }, [model, focus, displayScale]);

  useFrame((_, delta) => {
    if (!targetScene || !meshRef.current) {
      return;
    }
    if (displayPos.current.lengthSq() === 0) {
      displayPos.current.copy(targetScene);
    }
    const t = Math.min(delta * 4, 1);
    displayPos.current.lerp(targetScene, t);
    meshRef.current.position.copy(displayPos.current);
  });

  if (!model?.canDraw || !targetScene) {
    return null;
  }

  const showGreenPath =
    pathSegments.length > 0 &&
    !isRenderableVesselRootPath(model.vesselPathPoints);

  return (
    <group>
      {showGreenPath &&
        pathSegments.map((points, index) => (
          <Line
            key={`vessel-path-${index}`}
            points={points}
            color="#61d394"
            lineWidth={1.25}
            transparent
            opacity={0.85}
          />
        ))}
      <mesh ref={meshRef} position={targetScene}>
        <coneGeometry args={[0.25, 0.6, 8]} />
        <meshStandardMaterial
          color="#61d394"
          emissive="#61d394"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}
