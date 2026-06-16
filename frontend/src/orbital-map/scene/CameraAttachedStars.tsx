import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import type { Group } from "three";
import { useViewStore } from "../store/viewStore";
import { getQualitySettings } from "../settings/qualityStore";

/**
 * Distant star shell centered on the camera — not on world origin.
 *
 * Map content uses world-shift (focused body → scene origin). A fixed-origin
 * drei Stars mesh would wrap that body in a "globe of stars" after focus/zoom.
 */
export function CameraAttachedStars({
  maxCount = 2000,
  radius = 500,
  depth = 80,
}: {
  maxCount?: number;
  radius?: number;
  depth?: number;
}) {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();
  const qualityPreset = useViewStore((s) => s.qualityPreset);
  const quality = useMemo(
    () => getQualitySettings(qualityPreset),
    [qualityPreset],
  );

  useFrame(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    group.position.copy(camera.position);
  });

  return (
    <group ref={groupRef} frustumCulled={false}>
      <Stars
        radius={radius}
        depth={depth}
        count={Math.min(quality.starCount, maxCount)}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />
    </group>
  );
}
