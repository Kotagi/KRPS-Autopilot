import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { KSP_BODY_NORTH_LOCAL_THREE } from "../../../coords/kspBodyOrientation";

const SPIN_AXIS_COLOR = "#ffe066";
const SPIN_AXIS_LENGTH_FACTOR = 1.15;

/**
 * Spin axis through mesh poles (body north in Three body basis).
 * Child of PlanetBodyOrientedGroup — co-rotates with the textured sphere.
 */
export function PlanetBodySpinAxisLine({ radius }: { radius: number }) {
  const len = radius * SPIN_AXIS_LENGTH_FACTOR;
  const points = useMemo((): [number, number, number][] => {
    const axis = KSP_BODY_NORTH_LOCAL_THREE;
    return [
      [-axis.x * len, -axis.y * len, -axis.z * len],
      [axis.x * len, axis.y * len, axis.z * len],
    ];
  }, [len]);

  return <Line points={points} color={SPIN_AXIS_COLOR} lineWidth={2} />;
}
