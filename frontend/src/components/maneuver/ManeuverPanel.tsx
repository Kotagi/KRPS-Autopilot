import { useEffect, useMemo, useState } from "react";

import { api } from "../../api/client";
import type {
  ManeuverExecuteRequest,
  ManeuverFineTunePreview,
  ManeuverFineTuneResult,
  ManeuverNodeSummary,
  ManeuverOperationId,
  ManeuverOperationSpec,
  ManeuverParamSpec,
  TimeReferenceId,
} from "../../api/types";
import { useAppStore } from "../../store/appStore";

const ORBIT_TIME_REFERENCES: { value: TimeReferenceId; label: string }[] = [
  { value: "computed", label: "Optimum time" },
  { value: "x_from_now", label: "X from now" },
  { value: "apoapsis", label: "Apoapsis" },
  { value: "periapsis", label: "Periapsis" },
  { value: "altitude", label: "Altitude" },
  { value: "eq_ascending", label: "Eq. ascending" },
  { value: "eq_descending", label: "Eq. descending" },
  { value: "eq_highest_ad", label: "Eq. cheapest AN/DN" },
  { value: "eq_nearest_ad", label: "Eq. nearest AN/DN" },
];

const TARGET_TIME_REFERENCES: { value: TimeReferenceId; label: string }[] = [
  { value: "computed", label: "Optimum time" },
  { value: "x_from_now", label: "X from now" },
  { value: "closest_approach", label: "Closest approach" },
  { value: "rel_ascending", label: "Rel. ascending" },
  { value: "rel_descending", label: "Rel. descending" },
  { value: "rel_highest_ad", label: "Rel. cheapest AN/DN" },
  { value: "rel_nearest_ad", label: "Rel. nearest AN/DN" },
  { value: "apoapsis", label: "Apoapsis" },
  { value: "periapsis", label: "Periapsis" },
  { value: "altitude", label: "Altitude" },
];

function defaultParams(spec: ManeuverOperationSpec | undefined): Record<string, number | boolean> {
  if (!spec) return {};
  const params: Record<string, number | boolean> = {};
  for (const field of spec.params) {
    if (field.default !== undefined && field.default !== null) {
      params[field.name] = field.default;
    } else if (field.kind === "bool") {
      params[field.name] = false;
    } else if (field.kind === "int") {
      params[field.name] = 0;
    } else {
      params[field.name] = 0;
    }
  }
  return params;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function ParamField({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: ManeuverParamSpec;
  value: number | boolean | undefined;
  disabled: boolean;
  onChange: (value: number | boolean) => void;
}) {
  if (spec.kind === "bool") {
    return (
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        {spec.label}
      </label>
    );
  }

  return (
    <div className="field">
      <label>{spec.label}</label>
      <input
        type="number"
        step={spec.kind === "int" ? 1 : spec.kind === "degrees" ? 0.1 : 0.01}
        value={Number(value ?? 0)}
        onChange={(e) =>
          onChange(
            spec.kind === "int"
              ? parseInt(e.target.value, 10)
              : parseFloat(e.target.value)
          )
        }
        disabled={disabled}
      />
    </div>
  );
}

export function ManeuverPanel() {
  const connection = useAppStore((s) => s.connection);
  const target = useAppStore((s) => s.target);
  const maneuver = useAppStore((s) => s.maneuver);
  const setManeuver = useAppStore((s) => s.setManeuver);
  const setLastError = useAppStore((s) => s.setLastError);

  const [operations, setOperations] = useState<ManeuverOperationSpec[]>([]);
  const [operation, setOperation] = useState<ManeuverOperationId>("circularize");
  const [timeReference, setTimeReference] = useState<TimeReferenceId>("computed");
  const [leadTimeS, setLeadTimeS] = useState(300);
  const [clearExisting, setClearExisting] = useState(true);
  const [params, setParams] = useState<Record<string, number | boolean>>({});
  const [nodes, setNodes] = useState<ManeuverNodeSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [defaultTolerance, setDefaultTolerance] = useState(0.5);
  const [autowarp, setAutowarp] = useState(true);
  const [tuneNodeIndex, setTuneNodeIndex] = useState(0);
  const [desiredPeKm, setDesiredPeKm] = useState(100);
  const [tuneToleranceKm, setTuneToleranceKm] = useState(1);
  const [tuneResult, setTuneResult] = useState<ManeuverFineTuneResult | null>(null);
  const [tunePreview, setTunePreview] = useState<ManeuverFineTunePreview | null>(
    null
  );

  const selectedSpec = useMemo(
    () => operations.find((op) => op.id === operation),
    [operations, operation]
  );

  const visibleParams = useMemo(() => {
    if (!selectedSpec) return [];

    return selectedSpec.params.filter((field) => {
      if (!field.for_target_type) return true;
      if (!target?.mechjeb_locked || target.target_type === "none") {
        return field.for_target_type === "vessel";
      }
      return field.for_target_type === target.target_type;
    });
  }, [selectedSpec, target]);

  const timeReferences = useMemo(
    () =>
      selectedSpec?.needs_target
        ? TARGET_TIME_REFERENCES
        : ORBIT_TIME_REFERENCES,
    [selectedSpec?.needs_target]
  );

  useEffect(() => {
    if (!selectedSpec?.timed) return;

    if (
      operation === "course_correction" ||
      operation === "interplanetary_transfer"
    ) {
      setTimeReference("x_from_now");
      setLeadTimeS((prev) => (prev > 0 ? prev : 3600));
      return;
    }

    setTimeReference("computed");
  }, [operation, selectedSpec?.timed]);

  useEffect(() => {
    if (!selectedSpec?.timed) return;

    if (!timeReferences.some((ref) => ref.value === timeReference)) {
      setTimeReference(timeReferences[0]?.value ?? "computed");
    }
  }, [selectedSpec?.timed, timeReferences, timeReference]);

  const running = maneuver?.state === "running";
  const ready = connection.connected;
  const formDisabled = !ready || busy || running;

  useEffect(() => {
    api.maneuverOperations().then(setOperations).catch(() => {});
  }, []);

  useEffect(() => {
    setParams(defaultParams(selectedSpec));
  }, [selectedSpec]);

  useEffect(() => {
    if (!ready) {
      setNodes([]);
      setTuneResult(null);
      return;
    }
    api
      .maneuverNodes()
      .then((nextNodes) => {
        setNodes(nextNodes);
        setTuneNodeIndex((prev) =>
          prev >= nextNodes.length ? Math.max(0, nextNodes.length - 1) : prev
        );
      })
      .catch(() => setNodes([]));
  }, [ready, maneuver?.node_count, maneuver?.state]);

  useEffect(() => {
    if (!ready || nodes.length === 0) {
      setTunePreview(null);
      return;
    }
    api
      .fineTunePreview(tuneNodeIndex)
      .then(setTunePreview)
      .catch(() => setTunePreview(null));
  }, [
    ready,
    nodes.length,
    tuneNodeIndex,
    maneuver?.node_count,
    target?.name,
    target?.target_type,
  ]);

  const handlePlan = async () => {
    setBusy(true);
    setLastError(null);
    try {
      const result = await api.planManeuver({
        operation,
        clear_existing: clearExisting,
        time_reference: timeReference,
        lead_time_s:
          selectedSpec?.timed && timeReference === "x_from_now"
            ? Math.max(leadTimeS, 1)
            : null,
        params,
      });
      setNodes(result.nodes);
      if (result.warning) {
        setLastError(result.warning);
      }
      const status = await api.maneuverStatus();
      setManeuver(status);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Maneuver planning failed");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setLastError(null);
    try {
      await api.clearManeuverNodes();
      setNodes([]);
      setTuneNodeIndex(0);
      setManeuver(await api.maneuverStatus());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Failed to clear nodes");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteNode = async (index: number) => {
    setBusy(true);
    setLastError(null);
    try {
      const result = await api.deleteManeuverNode(index);
      setNodes(result.nodes);
      setTuneNodeIndex((prev) => {
        if (result.nodes.length === 0) return 0;
        if (prev > index) return prev - 1;
        if (prev >= result.nodes.length) return result.nodes.length - 1;
        return prev;
      });
      setManeuver(await api.maneuverStatus());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Failed to delete node");
    } finally {
      setBusy(false);
    }
  };

  const handleExecute = async (mode: ManeuverExecuteRequest["mode"]) => {
    setBusy(true);
    setLastError(null);
    try {
      const status = await api.executeManeuver({
        mode,
        autowarp,
        lead_time_s: 3,
      });
      setManeuver(status);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Execute failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFineTune = async () => {
    setBusy(true);
    setLastError(null);
    setTuneResult(null);
    try {
      const result = await api.fineTuneManeuver({
        desired_pe_km: desiredPeKm,
        node_index: tuneNodeIndex,
        tolerance_km: tuneToleranceKm,
        max_iterations: 250,
        max_prograde_delta_ms: 2000,
      });
      setTuneResult(result);
      setNodes(result.nodes);
      api.fineTunePreview(tuneNodeIndex).then(setTunePreview).catch(() => {});
      if (!result.success && result.message) {
        setLastError(result.message);
      } else if (result.message) {
        setLastError(result.message);
      }
      setManeuver(await api.maneuverStatus());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Fine-tune failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDefaultToleranceChange = async (value: number) => {
    setDefaultTolerance(value);
    if (!ready || value <= 0) return;
    try {
      await api.setDefaultNodeTolerance(value);
      const nextNodes = await api.maneuverNodes();
      setNodes(nextNodes);
    } catch (err) {
      setLastError(
        err instanceof Error ? err.message : "Failed to update default tolerance"
      );
    }
  };

  const handleNodeToleranceChange = async (index: number, value: number) => {
    setNodes((prev) =>
      prev.map((node, nodeIndex) =>
        nodeIndex === index ? { ...node, tolerance_ms: value } : node
      )
    );
    if (!ready || value <= 0) return;
    try {
      const updated = await api.setNodeTolerance(index, value);
      setNodes((prev) =>
        prev.map((node, nodeIndex) => (nodeIndex === index ? updated : node))
      );
    } catch (err) {
      setLastError(
        err instanceof Error ? err.message : "Failed to update node tolerance"
      );
      const nextNodes = await api.maneuverNodes();
      setNodes(nextNodes);
    }
  };

  const handleAbort = async () => {
    setBusy(true);
    setLastError(null);
    try {
      setManeuver(await api.abortManeuver());
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "Abort failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2>Maneuver Planner</h2>

      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <div className="field" style={{ minWidth: "220px" }}>
          <label>Operation</label>
          <select
            value={operation}
            onChange={(e) => setOperation(e.target.value as ManeuverOperationId)}
            disabled={formDisabled}
          >
            {operations.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
        {selectedSpec?.timed && (
          <div className="field">
            <label>Time reference</label>
            <select
              value={timeReference}
              onChange={(e) =>
                setTimeReference(e.target.value as TimeReferenceId)
              }
              disabled={formDisabled}
            >
              {timeReferences.map((ref) => (
                <option key={ref.value} value={ref.value}>
                  {ref.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {selectedSpec?.timed && timeReference === "x_from_now" && (
          <div className="field">
            <label>Lead time (s)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={leadTimeS}
              onChange={(e) => setLeadTimeS(Number(e.target.value))}
              disabled={formDisabled}
            />
          </div>
        )}
      </div>

      {selectedSpec && (
        <p className="meta" style={{ marginBottom: "0.75rem" }}>
          {selectedSpec.description}
          {selectedSpec.needs_target && !target?.mechjeb_locked
            ? " · Lock a target first."
            : ""}
          {selectedSpec.timed && timeReference === "computed"
            ? " · Node scheduled at MechJeb's optimum time."
            : selectedSpec.timed && timeReference === "x_from_now"
            ? ` · Node scheduled ${leadTimeS}s from now.`
            : selectedSpec.timed && timeReference === "closest_approach"
              ? " · Node scheduled at closest approach to target."
              : ""}
        </p>
      )}

      {selectedSpec && visibleParams.length > 0 && (
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          {visibleParams.map((field) => (
            <ParamField
              key={field.name}
              spec={field}
              value={params[field.name]}
              disabled={formDisabled}
              onChange={(value) =>
                setParams((prev) => ({ ...prev, [field.name]: value }))
              }
            />
          ))}
        </div>
      )}

      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <label>
          <input
            type="checkbox"
            checked={clearExisting}
            onChange={(e) => setClearExisting(e.target.checked)}
            disabled={formDisabled}
          />{" "}
          Clear existing nodes before planning
        </label>
      </div>

      <div className="row" style={{ marginBottom: "1rem" }}>
        <button onClick={handlePlan} disabled={formDisabled}>
          Create Maneuver
        </button>
        <button className="secondary" onClick={handleClear} disabled={formDisabled}>
          Clear Nodes
        </button>
      </div>

      <div className="maneuver-node-list">
        <div className="maneuver-node-list-header">
          <h3>Planned nodes</h3>
          <div className="field maneuver-node-default-tolerance">
            <label>Default tolerance (m/s)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={defaultTolerance}
              onChange={(e) => setDefaultTolerance(Number(e.target.value))}
              onBlur={(e) =>
                handleDefaultToleranceChange(Number(e.target.value))
              }
              disabled={formDisabled}
            />
          </div>
        </div>
        <p className="meta maneuver-node-tolerance-hint">
          MechJeb burn cutoff per node. Execute Next uses that node&apos;s value;
          Execute All uses the tightest tolerance across nodes.
        </p>
        {nodes.length === 0 ? (
          <div className="meta">No maneuver nodes.</div>
        ) : (
          nodes.map((node, index) => (
            <div key={`${node.ut}-${index}`} className="maneuver-node-item">
              <strong>Node {index + 1}</strong>
              <span>Δv {node.delta_v_ms.toFixed(1)} m/s</span>
              <span>T− {formatDuration(node.time_to_s)}</span>
              <span>
                Remaining {node.remaining_delta_v_ms.toFixed(1)} m/s
              </span>
              <label className="maneuver-node-tolerance">
                <span>Tolerance (m/s)</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={node.tolerance_ms}
                  onChange={(e) =>
                    setNodes((prev) =>
                      prev.map((entry, nodeIndex) =>
                        nodeIndex === index
                          ? { ...entry, tolerance_ms: Number(e.target.value) }
                          : entry
                      )
                    )
                  }
                  onBlur={(e) =>
                    handleNodeToleranceChange(index, Number(e.target.value))
                  }
                  disabled={formDisabled}
                />
              </label>
              <button
                type="button"
                className="secondary maneuver-node-delete"
                onClick={() => handleDeleteNode(index)}
                disabled={formDisabled}
                aria-label={`Delete node ${index + 1}`}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      <div className="maneuver-fine-tune">
        <h3>Intercept fine-tune</h3>
        <p className="meta">
          Probes prograde/retrograde first, then normal and radial. Uses SOI
          intercept Pe when available; otherwise tunes closest-approach altitude
          until an intercept forms.
          {tunePreview?.resolved_target
            ? ` Target: ${tunePreview.resolved_target}.`
            : target?.name
              ? ` Target: ${target.name}.`
              : " Lock a target body for best results."}
        </p>
        {tunePreview && (
          <div className="meta" style={{ marginBottom: "0.75rem" }}>
            {tunePreview.tune_mode === "intercept_pe" ? (
              <span>
                SOI intercept:{" "}
                {tunePreview.encounters
                  .map(
                    (enc) =>
                      `${enc.body_name} Pe ${enc.pe_km.toFixed(1)} km (${enc.pe_m.toFixed(0)} m)`
                  )
                  .join(" · ")}
              </span>
            ) : tunePreview.tune_mode === "closest_approach" ? (
              <span>
                No SOI intercept yet — closest approach to{" "}
                {tunePreview.resolved_target ?? "target"}:{" "}
                {tunePreview.approach_altitude_km?.toFixed(1) ?? "—"} km
                {tunePreview.approach_altitude_m != null
                  ? ` (${tunePreview.approach_altitude_m.toFixed(0)} m surface-relative)`
                  : ""}
                {tunePreview.orbit_description
                  ? ` · ${tunePreview.orbit_description}`
                  : ""}
              </span>
            ) : (
              <span>
                Cannot measure approach
                {tunePreview.orbit_description
                  ? ` (${tunePreview.orbit_description})`
                  : ""}
                . Lock a target body and pick the main transfer node.
              </span>
            )}
          </div>
        )}
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          <div className="field">
            <label>Node</label>
            <select
              value={tuneNodeIndex}
              onChange={(e) => setTuneNodeIndex(Number(e.target.value))}
              disabled={formDisabled || nodes.length === 0}
            >
              {nodes.length === 0 ? (
                <option value={0}>No nodes</option>
              ) : (
                nodes.map((node, index) => (
                  <option key={`${node.ut}-${index}`} value={index}>
                    Node {index + 1} · {node.delta_v_ms.toFixed(1)} m/s · T−{" "}
                    {formatDuration(node.time_to_s)}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="field">
            <label>Desired intercept Pe (km)</label>
            <input
              type="number"
              step="1"
              value={desiredPeKm}
              onChange={(e) => setDesiredPeKm(Number(e.target.value))}
              disabled={formDisabled || nodes.length === 0}
            />
          </div>
          <div className="field">
            <label>Pe tolerance (km)</label>
            <input
              type="number"
              step="0.1"
              value={tuneToleranceKm}
              onChange={(e) => setTuneToleranceKm(Number(e.target.value))}
              disabled={formDisabled || nodes.length === 0}
            />
          </div>
        </div>
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          <button
            onClick={handleFineTune}
            disabled={
              formDisabled ||
              nodes.length === 0 ||
              !(tunePreview?.can_tune ?? false)
            }
          >
            Fine Tune Intercept Pe
          </button>
        </div>
        {tuneResult && (
          <div
            className={`maneuver-tune-result${tuneResult.success ? "" : " warn"}`}
          >
            <span>
              {tuneResult.target_body_name ?? "Body"}
              {tuneResult.tune_mode === "closest_approach"
                ? " (closest approach)"
                : ""}
              : {tuneResult.initial_pe_km?.toFixed(1) ?? "—"} km →{" "}
              {tuneResult.final_pe_km?.toFixed(1) ?? "—"} km (target{" "}
              {tuneResult.desired_pe_km.toFixed(1)} km)
            </span>
            {tuneResult.initial_pe_m != null && (
              <span>
                Raw: {tuneResult.initial_pe_m.toFixed(0)} m →{" "}
                {tuneResult.final_pe_m?.toFixed(0) ?? "—"} m
              </span>
            )}
            {tuneResult.axes_adjusted.length > 0 && (
              <span>Axes: {tuneResult.axes_adjusted.join(", ")}</span>
            )}
            {tuneResult.delta_prograde_ms != null &&
              Math.abs(tuneResult.delta_prograde_ms) > 0.001 && (
                <span>
                  P{" "}
                  {tuneResult.delta_prograde_ms >= 0 ? "+" : ""}
                  {tuneResult.delta_prograde_ms.toFixed(2)} m/s
                </span>
              )}
            {tuneResult.delta_normal_ms != null &&
              Math.abs(tuneResult.delta_normal_ms) > 0.001 && (
                <span>
                  N{" "}
                  {tuneResult.delta_normal_ms >= 0 ? "+" : ""}
                  {tuneResult.delta_normal_ms.toFixed(2)} m/s
                </span>
              )}
            {tuneResult.delta_radial_ms != null &&
              Math.abs(tuneResult.delta_radial_ms) > 0.001 && (
                <span>
                  R{" "}
                  {tuneResult.delta_radial_ms >= 0 ? "+" : ""}
                  {tuneResult.delta_radial_ms.toFixed(2)} m/s
                </span>
              )}
            <span>{tuneResult.iterations} iterations</span>
            {tuneResult.message && <span>{tuneResult.message}</span>}
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: "1rem" }}>
        <label style={{ alignSelf: "end" }}>
          <input
            type="checkbox"
            checked={autowarp}
            onChange={(e) => setAutowarp(e.target.checked)}
            disabled={!ready || busy}
          />{" "}
          Autowarp
        </label>
      </div>

      <div className="row" style={{ marginTop: "0.75rem" }}>
        <button
          onClick={() => handleExecute("one")}
          disabled={!ready || busy || running || nodes.length === 0}
        >
          Execute Next
        </button>
        <button
          onClick={() => handleExecute("all")}
          disabled={!ready || busy || running || nodes.length === 0}
        >
          Execute All
        </button>
        <button
          className="danger"
          onClick={handleAbort}
          disabled={!ready || busy || (!running && !maneuver?.executor_enabled)}
        >
          Abort Burn
        </button>
      </div>

      {maneuver && (
        <div className="meta" style={{ marginTop: "0.75rem" }}>
          State: {maneuver.state}
          {maneuver.executor_enabled ? " · burning" : ""}
          {maneuver.last_warning ? ` · ${maneuver.last_warning}` : ""}
          {maneuver.last_error ? ` · ${maneuver.last_error}` : ""}
        </div>
      )}
    </section>
  );
}
