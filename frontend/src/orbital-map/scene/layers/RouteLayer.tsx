import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { useViewStore } from "../../store/viewStore";
import { applyWorldShift } from "../../coords/worldShift";
import {
  buildFutureRoutePreviewSegments,
  resolveVesselOrbitDisplayPatch,
} from "../../coords/buildPatchConic";
import { buildRouteChordSegments } from "../../coords/routeOverlay";
import { useTrajectoryFocus } from "./useTrajectoryFocus";

export function RouteLayer() {
  const telemetry = useViewStore((s) => s.telemetry);
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const focus = useTrajectoryFocus();

  const lineGroups = useMemo(() => {
    if (!model) {
      return [] as { key: string; points: [number, number, number][]; dashed: boolean }[];
    }

    const isPrediction = model.routeOverlayMode.includes("patched-conic");
    const rootBodyName = telemetry?.rootBody ?? null;
    const vesselRoot =
      model.vesselPosition ??
      telemetry?.activeVessel?.positionRootRelativeMeters ??
      null;

    const patches = telemetry?.orbitPatches ?? [];
    const displayPatch = resolveVesselOrbitDisplayPatch(patches, vesselRoot);

    const rootSegments = isPrediction
      ? buildFutureRoutePreviewSegments(
          displayPatch,
          patches,
          model.bodies,
          rootBodyName,
        )
      : buildRouteChordSegments(model.routeAnchors, rootBodyName);

    return rootSegments.map((segment, index) => ({
      key: `route-seg-${index}`,
      points: segment.map(
        (p) => applyWorldShift(p, focus, displayScale) as [number, number, number],
      ),
      dashed: !isPrediction,
    }));
  }, [telemetry, model, focus, displayScale]);

  if (!lineGroups.length) {
    return null;
  }

  return (
    <group>
      {lineGroups.map((line) => (
        <Line
          key={line.key}
          points={line.points}
          color="#ffd166"
          lineWidth={2}
          dashed={line.dashed}
          dashSize={0.5}
          gapSize={0.25}
        />
      ))}
    </group>
  );
}
