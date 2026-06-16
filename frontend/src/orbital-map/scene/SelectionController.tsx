import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useViewStore } from "../store/viewStore";
import { applyWorldShift } from "../coords/worldShift";
import { useLayerFocus } from "./layers/useLayerFocus";
import {
  buildSelectionTargets,
  findSelectionDetail,
} from "../selection/buildSelectionTargets";
import { useMoonVisibilityContext } from "./MoonVisibilityContext";
import { bodyPickRadius } from "./bodyVisualScale";
import { pickOrbitTrail } from "../selection/pickOrbitTrail";
import { getCustomizeMapOrbitPickLines } from "../selection/customizeMapOrbitPickRegistry";

export function SelectionController() {
  const model = useViewStore((s) => s.model);
  const displayScale = useViewStore((s) => s.displayScale);
  const setSelectionDetail = useViewStore((s) => s.setSelectionDetail);
  const setHoverObjectId = useViewStore((s) => s.setHoverObjectId);
  const focusOnBody = useViewStore((s) => s.focusOnBody);
  const customizeEnabled = useViewStore((s) => s.devCustomizeMapEnabled);
  const setCustomizeSelected = useViewStore(
    (s) => s.setCustomizeMapSelectedPlanet,
  );
  const { visibleBodyNames, hostPlanetOpen } = useMoonVisibilityContext();
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());

  const focus = useLayerFocus();

  const spheres = useMemo(() => {
    if (!model?.canDraw || !model.hierarchy) {
      return [];
    }
    const hierarchy = model.hierarchy;
    const scaleBase = { displayScale, hierarchy, hostPlanetOpen };

    return buildSelectionTargets(model)
      .filter((target) => {
        if (!target.id.startsWith("body:")) {
          return true;
        }
        const name = target.id.slice("body:".length);
        return visibleBodyNames.has(name);
      })
      .map((target) => {
        const [x, y, z] = applyWorldShift(
          { x: target.position[0], y: target.position[1], z: target.position[2] },
          focus,
          displayScale,
        );
        const bodyName = target.id.startsWith("body:")
          ? target.id.slice("body:".length)
          : target.label;
        const pickR = target.id.startsWith("body:")
          ? bodyPickRadius({
              ...scaleBase,
              bodyName,
              radiusMeters: Math.max(target.radius, 1000),
            })
          : Math.max(target.radius * displayScale, 0.2);
        return {
          ...target,
          scenePos: new THREE.Vector3(x, y, z),
          sceneRadius: pickR,
        };
      });
  }, [model, focus, displayScale, visibleBodyNames, hostPlanetOpen]);

  useEffect(() => {
    const dom = gl.domElement;

    function pick(clientX: number, clientY: number): string | null {
      if (!spheres.length) {
        return null;
      }
      const rect = dom.getBoundingClientRect();
      pointer.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(pointer.current, camera);
      let bestId: string | null = null;
      let bestDist = Infinity;
      spheres.forEach((sphere) => {
        const distSq = raycaster.current.ray.distanceSqToPoint(sphere.scenePos);
        const threshold = sphere.sceneRadius * 1.5;
        if (distSq <= threshold * threshold && distSq < bestDist) {
          bestDist = distSq;
          bestId = sphere.id;
        }
      });
      return bestId;
    }

    function onClick(event: MouseEvent) {
      if (!model?.canDraw) {
        return;
      }
      if (customizeEnabled) {
        const orbitPickLines = getCustomizeMapOrbitPickLines();
        if (orbitPickLines.length > 0) {
          const rect = dom.getBoundingClientRect();
          pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.current.setFromCamera(pointer.current, camera);
          const orbitBody = pickOrbitTrail(
            raycaster.current.ray,
            orbitPickLines,
            3,
          );
          if (orbitBody) {
            setCustomizeSelected(orbitBody);
            return;
          }
        }
      }
      const id = pick(event.clientX, event.clientY);
      const targets = buildSelectionTargets(model);
      const detail = findSelectionDetail(targets, id);
      setSelectionDetail(detail);
      if (customizeEnabled) {
        return;
      }
      if (detail?.type === "body" && detail.id.startsWith("body:")) {
        focusOnBody(detail.id.slice("body:".length));
      }
    }

    function onMove(event: MouseEvent) {
      if (customizeEnabled) {
        const orbitPickLines = getCustomizeMapOrbitPickLines();
        if (orbitPickLines.length > 0) {
          const rect = dom.getBoundingClientRect();
          pointer.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.current.setFromCamera(pointer.current, camera);
          const orbitBody = pickOrbitTrail(
            raycaster.current.ray,
            orbitPickLines,
            3,
          );
          dom.style.cursor = orbitBody ? "pointer" : "";
          return;
        }
      }
      const id = pick(event.clientX, event.clientY);
      setHoverObjectId(id);
      dom.style.cursor = id?.startsWith("body:") ? "pointer" : "";
    }

    dom.addEventListener("click", onClick);
    dom.addEventListener("mousemove", onMove);
    return () => {
      dom.removeEventListener("click", onClick);
      dom.removeEventListener("mousemove", onMove);
      dom.style.cursor = "";
    };
  }, [
    gl,
    camera,
    spheres,
    model,
    setSelectionDetail,
    setHoverObjectId,
    focusOnBody,
    customizeEnabled,
    setCustomizeSelected,
  ]);

  return null;
}

