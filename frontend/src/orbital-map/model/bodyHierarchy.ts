import type { TelemetrySnapshot } from "../telemetry/schema-v6";

export interface BodyHierarchy {
  rootBody: string;
  planetNames: string[];
  moonsByPlanet: Record<string, string[]>;
  /** Moon → host planet; planet → itself; Sun → Sun */
  planetForBody: Record<string, string>;
  allMoonNames: string[];
}

function parentOf(
  body: NonNullable<TelemetrySnapshot["bodies"]>[number],
): string | null {
  return body.orbitReferenceBody ?? body.parentBody ?? null;
}

export function buildBodyHierarchy(
  bodies: NonNullable<TelemetrySnapshot["bodies"]>,
  rootBody: string,
): BodyHierarchy {
  const planetForBody: Record<string, string> = {};
  const moonsByPlanet: Record<string, string[]> = {};
  const planetNames: string[] = [];
  const allMoonNames: string[] = [];

  const names = new Set(
    bodies.map((b) => b.name).filter((n): n is string => !!n),
  );

  bodies.forEach((body) => {
    const name = body.name;
    if (!name) {
      return;
    }
    const parent = parentOf(body);
    if (name === rootBody) {
      planetForBody[name] = name;
      return;
    }
    if (parent === rootBody || parent == null) {
      planetNames.push(name);
      planetForBody[name] = name;
      if (!moonsByPlanet[name]) {
        moonsByPlanet[name] = [];
      }
      return;
    }
    if (parent && names.has(parent)) {
      allMoonNames.push(name);
      planetForBody[name] = parent;
      if (!moonsByPlanet[parent]) {
        moonsByPlanet[parent] = [];
      }
      moonsByPlanet[parent].push(name);
    }
  });

  planetNames.sort();
  Object.values(moonsByPlanet).forEach((moons) => moons.sort());
  allMoonNames.sort();

  return {
    rootBody,
    planetNames,
    moonsByPlanet,
    planetForBody,
    allMoonNames,
  };
}

export function isMoon(
  hierarchy: BodyHierarchy,
  bodyName: string,
): boolean {
  return hierarchy.allMoonNames.includes(bodyName);
}

export function moonsOf(
  hierarchy: BodyHierarchy,
  planetName: string,
): string[] {
  return hierarchy.moonsByPlanet[planetName] ?? [];
}
