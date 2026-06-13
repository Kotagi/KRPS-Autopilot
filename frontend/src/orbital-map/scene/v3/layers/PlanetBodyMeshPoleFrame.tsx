import { useMemo, type ReactNode } from "react";
import { kspMeshPoleOffsetQuaternion } from "../../../coords/kspBodyOrientation";

/** Aligns sphere +Y texture pole with KSP body north (+Y) in the Three body basis. */
export function PlanetBodyMeshPoleFrame({ children }: { children: ReactNode }) {
  const poleOffset = useMemo(() => kspMeshPoleOffsetQuaternion(), []);
  return <group quaternion={poleOffset}>{children}</group>;
}
