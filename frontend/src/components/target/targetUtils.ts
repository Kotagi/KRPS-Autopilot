import type { TargetKind, TargetNode } from "../../api/types";

export type SortMode = "kind" | "name";

export type KindFilter = Record<TargetKind, boolean>;

export const DEFAULT_KIND_FILTER: KindFilter = {
  star: true,
  planet: true,
  moon: true,
  asteroid: true,
  vessel: true,
};

const KIND_ORDER: Record<TargetKind, number> = {
  planet: 0,
  moon: 1,
  asteroid: 2,
  vessel: 3,
  star: 4,
};

export const KIND_LABELS: Record<TargetKind, string> = {
  star: "Stars",
  planet: "Planets",
  moon: "Moons",
  asteroid: "Asteroids",
  vessel: "Vessels",
};

export function kindGlyph(kind: TargetKind): string {
  switch (kind) {
    case "star":
      return "☀";
    case "planet":
      return "◉";
    case "moon":
      return "◦";
    case "asteroid":
      return "·";
    case "vessel":
      return "▲";
    default:
      return "•";
  }
}

export function sortNodes(nodes: TargetNode[], mode: SortMode): TargetNode[] {
  const sorted = [...nodes];
  if (mode === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }
  sorted.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.name.localeCompare(b.name)
  );
  return sorted;
}

export function sortNodesDeep(nodes: TargetNode[], mode: SortMode): TargetNode[] {
  return sortNodes(nodes, mode).map((node) => ({
    ...node,
    children: sortNodesDeep(node.children, mode),
  }));
}

export function filterNodeTree(
  nodes: TargetNode[],
  query: string,
  kinds: KindFilter
): TargetNode[] {
  const needle = query.trim().toLowerCase();

  const walk = (node: TargetNode): TargetNode | null => {
    const children = node.children
      .map(walk)
      .filter((child): child is TargetNode => child !== null);

    const kindVisible = kinds[node.kind];
    const nameMatch = !needle || node.name.toLowerCase().includes(needle);
    const selfVisible = kindVisible && (node.kind === "star" || nameMatch);
    const childVisible = children.length > 0;

    if (node.kind === "star" || selfVisible || childVisible) {
      return { ...node, children };
    }
    return null;
  };

  return nodes
    .map(walk)
    .filter((node): node is TargetNode => node !== null);
}

export function findNodeById(nodes: TargetNode[], id: string): TargetNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

export function findPathToNode(
  nodes: TargetNode[],
  id: string,
  trail: TargetNode[] = []
): TargetNode[] | null {
  for (const node of nodes) {
    const nextTrail = [...trail, node];
    if (node.id === id) return nextTrail;
    const found = findPathToNode(node.children, id, nextTrail);
    if (found) return found;
  }
  return null;
}

export function countKinds(nodes: TargetNode[]): Record<TargetKind, number> {
  const counts: Record<TargetKind, number> = {
    star: 0,
    planet: 0,
    moon: 0,
    asteroid: 0,
    vessel: 0,
  };

  const walk = (node: TargetNode) => {
    counts[node.kind] += 1;
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return counts;
}

export function formatDistance(meters: number | null): string {
  if (meters === null) return "—";
  if (meters >= 1_000_000) return `${(meters / 1_000_000).toFixed(2)} Mm`;
  if (meters >= 1_000) return `${(meters / 1_000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}
