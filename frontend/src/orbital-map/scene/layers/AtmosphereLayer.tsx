import { useViewStore } from "../../store/viewStore";
import { applyWorldShift } from "../../coords/worldShift";
import { useMoonVisibilityContext } from "../MoonVisibilityContext";
import { useLayerFocus } from "./useLayerFocus";

export function AtmosphereLayer() {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const { visibleBodyNames } = useMoonVisibilityContext();
  const focus = useLayerFocus();

  if (!model?.canDraw) {
    return null;
  }

  return (
    <group>
      {model.bodies.map((entry) => {
        const name = entry.body.name ?? "body";
        if (!visibleBodyNames.has(name) || !entry.body.hasAtmosphere) {
          return null;
        }
        const radius = Math.max(entry.body.radiusMeters ?? 1000, 1000);
        const depth = entry.body.atmosphereDepthMeters ?? radius * 0.05;
        const visualRadius = (radius + depth) * displayScale;
        const [x, y, z] = applyWorldShift(entry.position, focus, displayScale);
        return (
          <mesh key={`atmo-${name}`} position={[x, y, z]}>
            <sphereGeometry args={[visualRadius, 24, 24]} />
            <meshBasicMaterial
              color="#67d3ff"
              transparent
              opacity={0.08}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
