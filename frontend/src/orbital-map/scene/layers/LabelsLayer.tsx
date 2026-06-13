import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { useViewStore } from "../../store/viewStore";
import { applyWorldShift, getFocusPosition } from "../../coords/worldShift";
import { getQualitySettings } from "../../settings/qualityStore";
import { useMoonVisibilityContext } from "../MoonVisibilityContext";
import { bodyMeshRadius, moonLabelOffset } from "../bodyVisualScale";
import { isMoon } from "../../model/bodyHierarchy";

const PRIORITY_BODIES = new Set(["Sun", "Kerbin", "Mun", "Minmus", "Duna", "Ike"]);

interface LabelItem {
  key: string;
  text: string;
  position: [number, number, number];
  priority: number;
}

export function LabelsLayer() {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const focusBodyName = useViewStore((s) => s.focusBodyName);
  const cameraMode = useViewStore((s) => s.cameraMode);
  const qualityPreset = useViewStore((s) => s.qualityPreset);
  const { visibleBodyNames, hostPlanetOpen } = useMoonVisibilityContext();
  const quality = useMemo(
    () => getQualitySettings(qualityPreset),
    [qualityPreset],
  );

  const focus = useMemo(() => {
    if (!model) {
      return null;
    }
    if (focusBodyName) {
      return getFocusPosition(model.bodies, focusBodyName);
    }
    if (cameraMode === "currentReferenceBody" && model.referenceBody) {
      return getFocusPosition(model.bodies, model.referenceBody);
    }
    if (cameraMode === "encounterBody" && model.encounterBody) {
      return getFocusPosition(model.bodies, model.encounterBody);
    }
    return null;
  }, [model, focusBodyName, cameraMode]);

  const labels = useMemo((): LabelItem[] => {
    if (!model?.canDraw || !model.hierarchy || !quality.labelsEnabled) {
      return [];
    }
    const items: LabelItem[] = [];
    const hierarchy = model.hierarchy;
    const scaleBase = {
      displayScale,
      hierarchy,
      hostPlanetOpen,
    };

    const bodyPositions = new Map<string, [number, number, number]>();

    model.bodies.forEach((entry) => {
      const name = entry.body.name ?? "body";
      if (!visibleBodyNames.has(name)) {
        return;
      }
      const priority = PRIORITY_BODIES.has(name) ? 10 : 1;
      const scenePos = applyWorldShift(entry.position, focus, displayScale) as [
        number,
        number,
        number,
      ];
      bodyPositions.set(name, scenePos);
      const meshR = bodyMeshRadius({
        ...scaleBase,
        bodyName: name,
        radiusMeters: Math.max(entry.body.radiusMeters ?? 1000, 1000),
      });

      let labelPos: [number, number, number];
      if (isMoon(hierarchy, name)) {
        const host = hierarchy.planetForBody[name];
        const parentPos = host ? bodyPositions.get(host) : undefined;
        labelPos = parentPos
          ? moonLabelOffset(scenePos, parentPos, meshR)
          : [scenePos[0], scenePos[1] + meshR + 0.35, scenePos[2]];
      } else {
        labelPos = [scenePos[0], scenePos[1] + meshR + 0.4, scenePos[2]];
      }

      items.push({
        key: `body-${name}`,
        text: name,
        position: labelPos,
        priority,
      });
    });

    model.routeAnchors.forEach((anchor, index) => {
      const role = anchor.role ?? "anchor";
      if (role !== "encounter" && role !== "escape") {
        return;
      }
      const [x, y, z] = applyWorldShift(anchor.position, focus, displayScale);
      items.push({
        key: `route-${index}`,
        text: `${anchor.targetBody ?? ""} ${role}`,
        position: [x, y + 0.6, z],
        priority: 8,
      });
    });
    items.sort((a, b) => b.priority - a.priority);
    return items.slice(0, 32);
  }, [
    model,
    focus,
    displayScale,
    quality.labelsEnabled,
    visibleBodyNames,
    hostPlanetOpen,
  ]);

  if (!labels.length) {
    return null;
  }

  return (
    <group>
      {labels.map((label) => (
        <Html
          key={label.key}
          position={label.position}
          center
          distanceFactor={12}
          style={{
            pointerEvents: "none",
            color: "#e7f0f7",
            fontSize: "11px",
            fontFamily: "Segoe UI, sans-serif",
            textShadow: "0 1px 3px #000",
            whiteSpace: "nowrap",
            userSelect: "none",
          }}
        >
          {label.text}
        </Html>
      ))}
    </group>
  );
}
