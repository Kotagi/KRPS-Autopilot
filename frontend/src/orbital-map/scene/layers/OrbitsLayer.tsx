import { useMemo } from "react";
import { Line } from "@react-three/drei";
import {
  buildActivePatchDisplaySegments,
  resolveVesselOrbitDisplayPatch,
} from "../../coords/buildPatchConic";
import { findPatchRootAnchor } from "../../coords/patchAnchor";
import { useViewStore } from "../../store/viewStore";
import { applyWorldShift } from "../../coords/worldShift";
import { isDegenerateRouteAnchor } from "../../coords/routeOverlay";
import { useTrajectoryFocus } from "./useTrajectoryFocus";

export function OrbitsLayer() {
  const telemetry = useViewStore((s) => s.telemetry);
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const focus = useTrajectoryFocus();

  const patchLines = useMemo(() => {
    const patches = telemetry?.orbitPatches ?? [];
    const bodyModels = model?.bodies ?? [];
    const rootBodyName = telemetry?.rootBody ?? null;
    const vesselRoot =
      model?.vesselPosition ?? telemetry?.activeVessel?.positionRootRelativeMeters ?? null;
    const vesselPathPoints = model?.vesselPathPoints ?? [];

    const displayPatch = resolveVesselOrbitDisplayPatch(patches, vesselRoot);
    const anchor = displayPatch
      ? findPatchRootAnchor(displayPatch, bodyModels, rootBodyName)
      : null;
    const segments = displayPatch
      ? buildActivePatchDisplaySegments(
          displayPatch,
          anchor,
          vesselRoot,
          vesselPathPoints,
          telemetry?.gameUniversalTimeSeconds,
        )
      : [];

    return segments.map((segment, segmentIndex) => ({
      key: `trajectory-seg-${segmentIndex}`,
      points: segment.map(
        (p) => applyWorldShift(p, focus, displayScale) as [number, number, number],
      ),
      active: true,
    }));
  }, [telemetry, model, focus, displayScale]);

  return (
    <group>
      {patchLines.map((line) => (
        <Line
          key={line.key}
          points={line.points}
          color={line.active ? "#67d3ff" : "#4a6a80"}
          lineWidth={line.active ? 2 : 1}
          transparent
          opacity={line.active ? 0.95 : 0.45}
        />
      ))}
    </group>
  );
}

/** Scrub highlight markers at sampled placements */
export function PlacementMarkersLayer() {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const focus = useTrajectoryFocus();

  if (!model?.canDraw) {
    return null;
  }

  const rootBodyName = model.telemetry?.rootBody ?? null;

  return (
    <group>
      {model.placementMarkers.map((marker, index) => {
        if (isDegenerateRouteAnchor(marker, rootBodyName)) {
          return null;
        }
        const [x, y, z] = applyWorldShift(marker.position, focus, displayScale);
        const isEncounter = marker.role === "encounter";
        return (
          <mesh key={`placement-${index}`} position={[x, y, z]}>
            <boxGeometry args={[0.4, 0.4, 0.4]} />
            <meshStandardMaterial
              color={isEncounter ? "#ff6b6b" : "#ffd166"}
              emissive={isEncounter ? "#ff6b6b" : "#ffd166"}
              emissiveIntensity={0.35}
            />
          </mesh>
        );
      })}
    </group>
  );
}
