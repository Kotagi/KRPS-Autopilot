import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { useViewStore } from "../../store/viewStore";
import { applyWorldShift } from "../../coords/worldShift";
import {
  buildBodyOrbitTrailSegments,
  findBodyOrbitAnchor,
  resolveTrailRenderMode,
} from "../../coords/buildBodyOrbitTrail";
import { nearestPointOnPolyline } from "../../coords/orbitAlignment";
import type { Vector3 } from "../../telemetry/schema-v6";
import { useTrajectoryFocus } from "./useTrajectoryFocus";

const RESIDUAL_DRAW_THRESHOLD_METERS = 1e6;

export function DebugResidualsLayer() {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const qualityPreset = useViewStore((s) => s.qualityPreset);
  const focus = useTrajectoryFocus();

  const segments = useMemo(() => {
    if (!import.meta.env.DEV || qualityPreset !== "high") {
      return [] as { key: string; points: [number, number, number][] }[];
    }

    const rootBodyName = model?.telemetry?.rootBody ?? null;
    const bodies = model?.bodies ?? [];
    const lines: { key: string; points: [number, number, number][] }[] = [];

    (model?.bodyOrbitPaths ?? []).forEach((path, pathIndex) => {
      if (!path?.bodyName) {
        return;
      }

      const bodyEntry = bodies.find((b) => b.body.name === path.bodyName);
      const icon = bodyEntry?.position;
      if (!icon) {
        return;
      }

      const residual = path.validation?.liveToAnalyticMeters;
      if (residual == null || residual <= RESIDUAL_DRAW_THRESHOLD_METERS) {
        return;
      }

      const mode = resolveTrailRenderMode(path);
      let trail: Vector3[] = [];
      if (mode === "analytic") {
        const anchor = findBodyOrbitAnchor(path, bodies, rootBodyName, path.samples?.[0]);
        trail = buildBodyOrbitTrailSegments(path, anchor).flat();
      } else {
        (path.samples ?? []).forEach((s) => {
          if (s.positionRootRelativeMeters) {
            trail.push(s.positionRootRelativeMeters);
          }
        });
      }

      if (trail.length < 2) {
        return;
      }

      const { nearest } = nearestPointOnPolyline(icon, trail);
      const shifted: [number, number, number][] = [icon, nearest].map((p) =>
        applyWorldShift(p, focus, displayScale),
      ) as [number, number, number][];

      lines.push({
        key: `debug-residual-${path.bodyName ?? pathIndex}`,
        points: shifted,
      });
    });

    return lines;
  }, [model, focus, displayScale, qualityPreset]);

  if (!segments.length) {
    return null;
  }

  return (
    <group>
      {segments.map((seg) => (
        <Line
          key={seg.key}
          points={seg.points}
          color="#ff6b6b"
          lineWidth={2}
          transparent
          opacity={0.85}
        />
      ))}
    </group>
  );
}
