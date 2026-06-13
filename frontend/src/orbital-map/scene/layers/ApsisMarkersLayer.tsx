import { useMemo } from "react";
import { useViewStore } from "../../store/viewStore";
import { applyWorldShift, getFocusPosition } from "../../coords/worldShift";
import { buildConicGeometry } from "../../math/buildConicGeometry";
import { finiteOr } from "../../math/util";
import type { OrbitPatch, Vector3 } from "../../telemetry/schema-v6";

function findPatchStartPosition(patch: OrbitPatch): Vector3 | null {
  const samples = patch.placementSamples ?? [];
  for (const sample of samples) {
    if (sample.sampleRole === "patchStart" && sample.positionRootRelativeMeters) {
      return sample.positionRootRelativeMeters;
    }
  }
  return patch.referenceBodyPositionRootRelativeMeters ?? null;
}

function translateInertialToRoot(
  inertialPoints: Vector3[],
  anchor: Vector3 | null,
): Vector3[] {
  if (!anchor) {
    return inertialPoints;
  }
  return inertialPoints.map((p) => ({
    x: anchor.x + p.x,
    y: anchor.y + p.y,
    z: anchor.z + p.z,
  }));
}

export function ApsisMarkersLayer() {
  const telemetry = useViewStore((s) => s.telemetry);
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const focus = useMemo(() => {
    if (!model || !focusBodyName) {
      return null;
    }
    return getFocusPosition(model.bodies, focusBodyName);
  }, [model, focusBodyName]);

  const markers = useMemo(() => {
    const patches = telemetry?.orbitPatches ?? [];
    const active = patches.find((p) => p?.isActivePatch);
    if (!active || !model?.canDraw) {
      return [];
    }
    const refName = active.referenceBody;
    const refBody = (telemetry?.bodies ?? []).find((b) => b.name === refName);
    const bodyRadius = finiteOr(
      active.referenceBodyRadiusMeters ?? refBody?.radiusMeters,
      1000,
    );
    const geom = buildConicGeometry(active, bodyRadius, "orbitPlane", true);
    if (!geom.canDraw || (!geom.periapsisPoint && !geom.apoapsisPoint)) {
      return [];
    }
    const mode = active.patchPlacementMode ?? "";
    const useSampled =
      mode === "multiSampleEphemeris" || mode === "multiSampleEphemerisPartial";
    const anchor = useSampled ? findPatchStartPosition(active) : null;
    const result: { key: string; position: [number, number, number]; color: string }[] =
      [];

    function addMarker(
      key: string,
      inertial: Vector3 | undefined,
      color: string,
    ) {
      if (!inertial) {
        return;
      }
      const rootPath = translateInertialToRoot([inertial], anchor);
      const p = rootPath[0];
      const [x, y, z] = applyWorldShift(p, focus, displayScale);
      result.push({ key, position: [x, y, z], color });
    }

    addMarker("pe", geom.periapsisPoint?.inertial, "#61d394");
    addMarker("ap", geom.apoapsisPoint?.inertial, "#ff6b6b");
    return result;
  }, [telemetry, model, focus, displayScale]);

  return (
    <group>
      {markers.map((m) => (
        <mesh key={m.key} position={m.position}>
          <sphereGeometry args={[0.35, 12, 12]} />
          <meshStandardMaterial color={m.color} emissive={m.color} emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}
