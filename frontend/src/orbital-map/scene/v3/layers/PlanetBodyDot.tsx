import { useMemo } from "react";
import * as THREE from "three";
import { getPlanetBodyDotTexture } from "../../../assets/proceduralTextures";
import { PLANET_BODY_DOT_PIXEL_SIZE } from "../../../map-v3/elements/planetBody/planetBodyLod";

/**
 * Fixed-screen map dot (not a mesh). Color matches planet orbit / map color.
 */
export function PlanetBodyDot({
  position,
  color,
  renderOrder = 2,
}: {
  position: [number, number, number];
  color: string;
  renderOrder?: number;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    return g;
  }, []);
  const dotMap = useMemo(() => getPlanetBodyDotTexture(), []);

  return (
    <points position={position} renderOrder={renderOrder} frustumCulled={false}>
      <primitive object={geometry} attach="geometry" />
      <pointsMaterial
        color={color}
        map={dotMap}
        size={PLANET_BODY_DOT_PIXEL_SIZE}
        sizeAttenuation={false}
        transparent
        alphaTest={0.5}
        depthTest
        depthWrite
        toneMapped={false}
      />
    </points>
  );
}
