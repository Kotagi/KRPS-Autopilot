import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../api/client";
import type { TargetKind, TargetNode, TargetStatus } from "../../api/types";
import { useAppStore } from "../../store/appStore";
import {
  DEFAULT_KIND_FILTER,
  KIND_LABELS,
  countKinds,
  filterNodeTree,
  findNodeById,
  findPathToNode,
  formatDistance,
  kindGlyph,
  sortNodesDeep,
  type KindFilter,
  type SortMode,
} from "./targetUtils";

function TargetReadout({ target }: { target: TargetStatus | null }) {
  if (!target || target.target_type === "none" || !target.name) {
    return (
      <div className="target-readout idle">
        <span className="target-readout-label">Tracking Status</span>
        <strong>NO TARGET LOCK</strong>
        <span className="target-readout-sub">Select an object in the SOI catalog</span>
      </div>
    );
  }

  return (
    <div className="target-readout active">
      <span className="target-readout-label">Target Locked</span>
      <strong>{target.name.toUpperCase()}</strong>
      <span className="target-readout-sub">
        {target.kind ? KIND_LABELS[target.kind].slice(0, -1) : "Object"}
        {target.orbit_body ? ` · SOI ${target.orbit_body}` : ""}
        {target.distance_m !== null
          ? ` · Range ${formatDistance(target.distance_m)}`
          : ""}
        {" · Plane launch available"}
      </span>
    </div>
  );
}

function TreeRow({
  node,
  depth,
  selectedId,
  expanded,
  onToggleExpand,
  onSelect,
  onEnter,
}: {
  node: TargetNode;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (node: TargetNode) => void;
  onEnter: (node: TargetNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  const canDrill = hasChildren && node.kind !== "vessel";

  return (
    <>
      <button
        type="button"
        className={`target-row ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${0.75 + depth * 1.1}rem` }}
        onClick={() => onSelect(node)}
        onDoubleClick={() => {
          if (canDrill) onEnter(node);
        }}
      >
        {hasChildren ? (
          <span
            className="target-expand"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? "▾" : "▸"}
          </span>
        ) : (
          <span className="target-expand spacer" />
        )}
        <span className={`target-kind target-kind-${node.kind}`}>
          {kindGlyph(node.kind)}
        </span>
        <span className="target-name">{node.name}</span>
        <span className="target-kind-tag">{node.kind}</span>
        {canDrill && (
          <span
            className="target-enter"
            onClick={(event) => {
              event.stopPropagation();
              onEnter(node);
            }}
          >
            OPEN SOI
          </span>
        )}
      </button>
      {hasChildren && isExpanded &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
            onEnter={onEnter}
          />
        ))}
    </>
  );
}

export function TargetPanel() {
  const connected = useAppStore((s) => s.connection.connected);
  const target = useAppStore((s) => s.target);
  const setLastError = useAppStore((s) => s.setLastError);

  const [tree, setTree] = useState<TargetNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [locking, setLocking] = useState(false);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("kind");
  const [kindFilter, setKindFilter] = useState<KindFilter>(DEFAULT_KIND_FILTER);
  const [selected, setSelected] = useState<TargetNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusRootId, setFocusRootId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<TargetNode[]>([]);

  const refreshTree = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    try {
      const data = await api.targetTree();
      setTree(data.roots);
      if (data.roots.length > 0 && !focusRootId) {
        setFocusRootId(data.roots[0].id);
        setExpanded(new Set([data.roots[0].id]));
      }
      const current = await api.targetCurrent();
      useAppStore.getState().setTarget(current);
      if (current.id) {
        const path = findPathToNode(data.roots, current.id);
        if (path) {
          setBreadcrumb(path.slice(0, -1));
          setSelected(path[path.length - 1]);
          setExpanded((prev) => {
            const next = new Set(prev);
            path.forEach((node) => next.add(node.id));
            return next;
          });
        }
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Failed to load targets");
    } finally {
      setLoading(false);
    }
  }, [connected, focusRootId, setLastError]);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  const focusedTree = useMemo(() => {
    if (!focusRootId) return tree;
    const focus = findNodeById(tree, focusRootId);
    return focus ? [focus] : tree;
  }, [tree, focusRootId]);

  const displayTree = useMemo(() => {
    const filtered = filterNodeTree(focusedTree, query, kindFilter);
    return sortNodesDeep(filtered, sortMode);
  }, [focusedTree, query, kindFilter, sortMode]);

  const kindCounts = useMemo(() => countKinds(tree), [tree]);

  const toggleKind = (kind: TargetKind) => {
    setKindFilter((prev) => ({ ...prev, [kind]: !prev[kind] }));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterNode = (node: TargetNode) => {
    setFocusRootId(node.id);
    setBreadcrumb(findPathToNode(tree, node.id) ?? [node]);
    setExpanded((prev) => new Set(prev).add(node.id));
  };

  const jumpBreadcrumb = (node: TargetNode | null) => {
    if (!node) {
      const star = tree[0];
      if (!star) return;
      setFocusRootId(star.id);
      setBreadcrumb([]);
      return;
    }
    setFocusRootId(node.id);
    setBreadcrumb(findPathToNode(tree, node.id)?.slice(0, -1) ?? []);
  };

  const lockTarget = async () => {
    if (!selected?.selectable) return;
    setLocking(true);
    try {
      const status = await api.selectTarget(selected.id);
      useAppStore.getState().setTarget(status);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Failed to lock target");
    } finally {
      setLocking(false);
    }
  };

  const releaseTarget = async () => {
    setLocking(true);
    try {
      const status = await api.clearTarget();
      useAppStore.getState().setTarget(status);
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Failed to release target");
    } finally {
      setLocking(false);
    }
  };

  return (
    <section className="panel target-panel">
      <div className="target-header">
        <div>
          <h2>Target Acquisition</h2>
          <p className="target-tagline">SOI catalog · flight software interface</p>
        </div>
        <button
          className="secondary"
          disabled={!connected || loading}
          onClick={() => void refreshTree()}
        >
          {loading ? "Scanning..." : "Rescan System"}
        </button>
      </div>

      <TargetReadout target={target} />

      {!connected ? (
        <div className="meta">Connect to kRPC to open the target catalog.</div>
      ) : (
        <>
          <div className="target-toolbar">
            <input
              className="target-search"
              placeholder="Filter by designation..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="target-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="kind">Sort: SOI class</option>
              <option value="name">Sort: Name A→Z</option>
            </select>
          </div>

          <div className="target-filters">
            {(Object.keys(KIND_LABELS) as TargetKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`target-filter ${kindFilter[kind] ? "on" : ""}`}
                onClick={() => toggleKind(kind)}
              >
                {KIND_LABELS[kind]} ({kindCounts[kind]})
              </button>
            ))}
          </div>

          <div className="target-breadcrumb">
            <button type="button" className="crumb" onClick={() => jumpBreadcrumb(null)}>
              SYSTEM ROOT
            </button>
            {breadcrumb.map((node) => (
              <button
                key={node.id}
                type="button"
                className="crumb"
                onClick={() => jumpBreadcrumb(node)}
              >
                {node.name.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="target-catalog">
            {displayTree.length === 0 ? (
              <div className="meta">No objects match the current filter.</div>
            ) : (
              displayTree.map((node) => (
                <TreeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selected?.id ?? null}
                  expanded={expanded}
                  onToggleExpand={toggleExpand}
                  onSelect={setSelected}
                  onEnter={enterNode}
                />
              ))
            )}
          </div>

          <div className="target-actions">
            <div className="target-selection-meta">
              {selected ? (
                <>
                  <span className="label">Selected</span>
                  <strong>{selected.name}</strong>
                  <span className="sub">
                    {selected.kind}
                    {selected.orbit_body ? ` · orbiting ${selected.orbit_body}` : ""}
                  </span>
                </>
              ) : (
                <span className="sub">No object selected in catalog</span>
              )}
            </div>
            <div className="row">
              <button
                className="target-lock"
                disabled={!selected?.selectable || locking}
                onClick={() => void lockTarget()}
              >
                {locking ? "Locking..." : "Lock Target"}
              </button>
              <button
                className="secondary"
                disabled={locking || target?.target_type === "none"}
                onClick={() => void releaseTarget()}
              >
                Release Target
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
