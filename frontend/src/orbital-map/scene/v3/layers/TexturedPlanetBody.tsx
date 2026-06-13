import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { loadBodyTexture } from "../../../assets/planetBodyTextures";
import { PLANET_BODY_MESH_SPHERE_SEGMENTS } from "../../../map-v3/elements/planetBody/planetBodyLod";

export function TexturedPlanetBody({
  radius,
  position,
  renderOrder,
  fallbackColor,
  textureUrl,
  textureRevision,
}: {
  radius: number;
  position: [number, number, number];
  renderOrder: number;
  fallbackColor: string;
  textureUrl?: string;
  textureRevision?: string;
}) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(fallbackColor),
        toneMapped: false,
      }),
    [fallbackColor],
  );

  useEffect(() => {
    if (!textureUrl) {
      material.map = null;
      material.color.set(fallbackColor);
      material.needsUpdate = true;
      return;
    }

    let disposed = false;
    material.map = null;
    material.color.set(fallbackColor);
    material.needsUpdate = true;

    loadBodyTexture(
      textureUrl,
      textureRevision,
      (texture) => {
        if (disposed) {
          return;
        }
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
      },
      (url) => {
        if (!disposed) {
          console.warn("[KspWebMap] TexturedPlanetBody failed:", url);
        }
      },
    );

    return () => {
      disposed = true;
      material.map = null;
      material.color.set(fallbackColor);
      material.needsUpdate = true;
    };
  }, [textureUrl, textureRevision, fallbackColor, material]);

  return (
    <mesh position={position} renderOrder={renderOrder}>
      <sphereGeometry
        args={[radius, PLANET_BODY_MESH_SPHERE_SEGMENTS, PLANET_BODY_MESH_SPHERE_SEGMENTS]}
      />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
