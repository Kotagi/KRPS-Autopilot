import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PlanetBodyDrawMode } from "./elements/planetBody/planetBodyLod";

type DrawModeMap = ReadonlyMap<string, PlanetBodyDrawMode>;

const PlanetBodyMeshLodCtx = createContext<{
  registerPlanetDrawMode: (name: string, mode: PlanetBodyDrawMode) => void;
  unregisterPlanet: (name: string) => void;
  drawModes: DrawModeMap;
} | null>(null);

export function PlanetBodyMeshLodProvider({ children }: { children: ReactNode }) {
  const [drawModes, setDrawModes] = useState<Map<string, PlanetBodyDrawMode>>(
    () => new Map(),
  );

  const registerPlanetDrawMode = useCallback(
    (name: string, mode: PlanetBodyDrawMode) => {
      setDrawModes((prev) => {
        if (prev.get(name) === mode) {
          return prev;
        }
        const next = new Map(prev);
        next.set(name, mode);
        return next;
      });
    },
    [],
  );

  const unregisterPlanet = useCallback((name: string) => {
    setDrawModes((prev) => {
      if (!prev.has(name)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ registerPlanetDrawMode, unregisterPlanet, drawModes }),
    [registerPlanetDrawMode, unregisterPlanet, drawModes],
  );

  return (
    <PlanetBodyMeshLodCtx.Provider value={value}>
      {children}
    </PlanetBodyMeshLodCtx.Provider>
  );
}

export function usePlanetBodyMeshLodRegistry():
  | {
      registerPlanetDrawMode: (name: string, mode: PlanetBodyDrawMode) => void;
      unregisterPlanet: (name: string) => void;
    }
  | null {
  return useContext(PlanetBodyMeshLodCtx);
}

/** Pure helper — planets in mesh mode from registry map (tested). */
export function planetsInMeshModeFromDrawModes(
  drawModes: ReadonlyMap<string, PlanetBodyDrawMode>,
): ReadonlySet<string> {
  const mesh = new Set<string>();
  drawModes.forEach((mode, name) => {
    if (mode === "mesh") {
      mesh.add(name);
    }
  });
  return mesh;
}

/** Planets currently drawn as mesh (not map dot). Authority for moon orbit visibility. */
export function usePlanetsInMeshMode(): ReadonlySet<string> {
  const ctx = useContext(PlanetBodyMeshLodCtx);
  return useMemo(() => {
    if (!ctx) {
      return new Set<string>();
    }
    return planetsInMeshModeFromDrawModes(ctx.drawModes);
  }, [ctx?.drawModes]);
}
