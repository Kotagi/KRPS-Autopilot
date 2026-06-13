import { PLANET_BODY_MESH_SPHERE_SEGMENTS } from "../../../map-v3/elements/planetBody/planetBodyLod";

/** Mesh LOD fallback when texture is not ready (orbit map color). */
export function FlatPlanetBody({
  radius,
  position,
  color,
  renderOrder = 1,
}: {
  radius: number;
  position: [number, number, number];
  color: string;
  renderOrder?: number;
}) {
  return (
    <mesh position={position} renderOrder={renderOrder}>
      <sphereGeometry
        args={[radius, PLANET_BODY_MESH_SPHERE_SEGMENTS, PLANET_BODY_MESH_SPHERE_SEGMENTS]}
      />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  );
}
