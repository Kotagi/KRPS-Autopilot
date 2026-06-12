"""Iterative maneuver-node tuner for intercept periapsis at a target body."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Callable, Literal

from backend.core.krpc_units import (
    body_names_match,
    is_star_like_body,
    krpc_km_to_m,
    krpc_m_to_km,
    read_orbit_pe_altitude_m,
)

MAX_SOI_HOPS = 48
AxisName = Literal["prograde", "normal", "radial"]
AXIS_ORDER: tuple[AxisName, ...] = ("prograde", "normal", "radial")
MAX_PASSES = 5
MICRO_STEP_MS = 0.0002
ALTITUDE_UNCHANGED_M = 1.0


TuneMode = Literal["intercept_pe", "closest_approach"]


@dataclass(frozen=True)
class EncounterPe:
    pe_altitude_m: float
    body_name: str


@dataclass(frozen=True)
class ApproachMetric:
    mode: TuneMode
    body_name: str
    altitude_m: float
    miss_distance_m: float | None = None


@dataclass(frozen=True)
class NodeDv:
    prograde: float
    normal: float
    radial: float

    def with_axis(self, axis: AxisName, value: float) -> NodeDv:
        if axis == "prograde":
            return NodeDv(value, self.normal, self.radial)
        if axis == "normal":
            return NodeDv(self.prograde, value, self.radial)
        return NodeDv(self.prograde, self.normal, value)

    def axis_value(self, axis: AxisName) -> float:
        return getattr(self, axis)


@dataclass(frozen=True)
class TuneOutcome:
    success: bool
    target_body_name: str
    initial_pe_km: float
    final_pe_km: float
    initial_pe_m: float
    final_pe_m: float
    desired_pe_km: float
    iterations: int
    initial_dv: NodeDv
    final_dv: NodeDv
    axes_adjusted: tuple[AxisName, ...]
    tune_mode: TuneMode
    message: str | None = None


def describe_orbit(orbit: Any) -> str:
    try:
        body_name = str(orbit.body.name)
    except Exception:
        body_name = "?"

    try:
        t_soi = float(orbit.time_to_soi_change)
        t_soi_text = f"{t_soi:.1f}s" if math.isfinite(t_soi) else "none"
    except Exception:
        t_soi_text = "unknown"

    try:
        next_orbit = orbit.next_orbit
        next_body = str(next_orbit.body.name) if next_orbit is not None else "none"
    except Exception:
        next_body = "unknown"

    return (
        f"orbiting {body_name}, SOI change in {t_soi_text}, "
        f"next SOI body {next_body}"
    )


def scan_encounters(
    orbit: Any,
    *,
    skip_stars: bool = True,
) -> list[EncounterPe]:
    """List all future non-star SOI entries along patched conics."""
    encounters: list[EncounterPe] = []
    current = orbit

    for _ in range(MAX_SOI_HOPS):
        try:
            next_orbit = current.next_orbit
        except Exception:
            break

        if next_orbit is None:
            break

        try:
            t_soi = float(current.time_to_soi_change)
        except Exception:
            break

        if not math.isfinite(t_soi) or t_soi < 0:
            break

        body = next_orbit.body
        body_name = str(body.name)

        if skip_stars and is_star_like_body(body):
            current = next_orbit
            continue

        encounters.append(
            EncounterPe(
                pe_altitude_m=read_orbit_pe_altitude_m(next_orbit),
                body_name=body_name,
            )
        )
        current = next_orbit

    return encounters


def find_encounter_pe(
    orbit: Any,
    target_body_name: str | None = None,
    *,
    skip_stars: bool = True,
) -> EncounterPe | None:
    """Walk patched conics and return periapsis altitude at the target SOI entry."""
    encounters = scan_encounters(orbit, skip_stars=skip_stars)
    if not encounters:
        return None

    if target_body_name is None:
        return encounters[0]

    for encounter in encounters:
        if body_names_match(encounter.body_name, target_body_name):
            return encounter

    if len(encounters) == 1:
        return encounters[0]

    # Interplanetary transfers usually encounter the destination last.
    return encounters[-1]


def encounter_not_found_message(
    target_body_name: str | None,
    encounters: list[EncounterPe],
) -> str:
    if not encounters:
        return (
            "No SOI encounter found after this maneuver node. "
            "Plan a transfer that intercepts a body, or select an earlier node. "
            "The node may not escape your current SOI yet."
        )

    lines = [
        f"{enc.body_name} (Pe {krpc_m_to_km(enc.pe_altitude_m):.1f} km)"
        for enc in encounters
    ]
    found = ", ".join(lines)
    if target_body_name:
        return (
            f"No encounter with {target_body_name!r} after this node. "
            f"Found: {found}. Lock the target body or pick a different node."
        )
    return f"No matching encounter. Found: {found}."


def measure_approach(
    orbit: Any,
    target_body: Any | None,
    target_body_name: str | None,
    *,
    force_mode: TuneMode | None = None,
) -> ApproachMetric | None:
    """Prefer SOI intercept Pe; fall back to closest-approach altitude vs target."""
    resolved_name = target_body_name
    if target_body is not None:
        resolved_name = str(target_body.name)

    if force_mode != "closest_approach" and resolved_name:
        encounter = find_encounter_pe(orbit, resolved_name)
        if encounter is not None:
            return ApproachMetric(
                mode="intercept_pe",
                body_name=encounter.body_name,
                altitude_m=encounter.pe_altitude_m,
            )

    if target_body is None:
        return None

    dist: float | None = None
    for target in (target_body, getattr(target_body, "orbit", None)):
        if target is None:
            continue
        try:
            candidate = float(orbit.distance_at_closest_approach(target))
            if math.isfinite(candidate):
                dist = candidate
                break
        except Exception:
            continue

    if dist is None:
        return None

    try:
        radius = float(target_body.equatorial_radius)
    except Exception:
        return None

    return ApproachMetric(
        mode="closest_approach",
        body_name=str(target_body.name),
        altitude_m=dist - radius,
        miss_distance_m=dist,
    )


def _read_dv(node: Any) -> NodeDv:
    return NodeDv(
        prograde=float(node.prograde),
        normal=float(node.normal),
        radial=float(node.radial),
    )


def _apply_dv(node: Any, dv: NodeDv) -> None:
    node.prograde = dv.prograde
    node.normal = dv.normal
    node.radial = dv.radial


def _approach_error(metric: ApproachMetric, desired_pe_m: float) -> float:
    return metric.altitude_m - desired_pe_m


def _measure(
    node: Any,
    dv: NodeDv,
    target_body: Any | None,
    target_body_name: str | None,
    *,
    force_mode: TuneMode | None = None,
) -> ApproachMetric | None:
    _apply_dv(node, dv)
    return measure_approach(
        node.orbit,
        target_body,
        target_body_name,
        force_mode=force_mode,
    )


def _has_target_intercept(
    node: Any,
    dv: NodeDv,
    target_body_name: str | None,
) -> bool:
    _apply_dv(node, dv)
    return find_encounter_pe(node.orbit, target_body_name) is not None


def _resolve_force_mode(
    node: Any,
    dv: NodeDv,
    target_body_name: str | None,
) -> TuneMode | None:
    """Only use closest-approach when patched conics show no target SOI intercept."""
    if _has_target_intercept(node, dv, target_body_name):
        return None
    return "closest_approach"


def _mode_note(metric: ApproachMetric, force_mode: TuneMode | None) -> str:
    if force_mode == "closest_approach":
        return "Using closest approach (no SOI intercept yet)."
    if metric.mode == "intercept_pe":
        return "Using SOI intercept Pe."
    return "Using closest approach."


def _sensitivity_probes_ms(err_km: float) -> tuple[float, ...]:
    if err_km > 100_000:
        return (5.0, 20.0, 100.0, 500.0)
    if err_km > 10_000:
        return (2.0, 10.0, 50.0, 200.0)
    return (2.0, 10.0, 50.0)


def _axis_is_sensitive(
    node: Any,
    dv: NodeDv,
    axis: AxisName,
    target_body: Any | None,
    target_body_name: str | None,
    force_mode: TuneMode | None,
    probes_ms: tuple[float, ...],
) -> bool:
    """Return False when ±Δv probes leave the objective unchanged."""
    center = dv.axis_value(axis)
    baseline = _measure(
        node, dv, target_body, target_body_name, force_mode=force_mode
    )
    if baseline is None:
        return False

    base_alt = baseline.altitude_m
    for step in probes_ms:
        for sign in (-1.0, 1.0):
            metric = _measure(
                node,
                dv.with_axis(axis, center + sign * step),
                target_body,
                target_body_name,
                force_mode=force_mode,
            )
            if metric is None:
                continue
            if abs(metric.altitude_m - base_alt) > ALTITUDE_UNCHANGED_M:
                return True
    return False


def _wide_axis_explore(
    node: Any,
    dv: NodeDv,
    axis: AxisName,
    target_body: Any | None,
    target_body_name: str | None,
    desired_pe_m: float,
    base_span_ms: float,
    iteration_budget: int,
    force_mode: TuneMode | None,
) -> tuple[NodeDv, ApproachMetric | None, float, int]:
    """Try explicit large Δv offsets before multiscale refinement."""
    center = dv.axis_value(axis)
    best_dv = dv
    best_metric = _measure(
        node, dv, target_body, target_body_name, force_mode=force_mode
    )
    if best_metric is None:
        return best_dv, None, math.inf, 0

    best_err = abs(_approach_error(best_metric, desired_pe_m))
    used = 1
    span = min(float(base_span_ms), 2000.0)
    multipliers = (
        -10.0,
        -5.0,
        -2.0,
        -1.0,
        -0.5,
        -0.25,
        -0.1,
        0.1,
        0.25,
        0.5,
        1.0,
        2.0,
        5.0,
        10.0,
    )

    for mult in multipliers:
        if used >= iteration_budget:
            break
        delta = span * mult
        if abs(delta) < MICRO_STEP_MS:
            continue
        metric = _measure(
            node,
            dv.with_axis(axis, center + delta),
            target_body,
            target_body_name,
            force_mode=force_mode,
        )
        used += 1
        if metric is None:
            continue
        err = abs(_approach_error(metric, desired_pe_m))
        if err < best_err:
            best_err = err
            best_metric = metric
            best_dv = dv.with_axis(axis, center + delta)

    return best_dv, best_metric, best_err, used


def _span_schedule(
    err_km: float,
    base_span_ms: float,
    axis: AxisName,
) -> list[float]:
    """Coarse-to-micro Δv scales in m/s for one axis."""
    cap = min(max(float(base_span_ms), 20.0), 500.0)
    if axis == "prograde" and err_km > 50_000:
        cap = min(float(base_span_ms), 2000.0)

    candidates = [
        cap,
        cap * 0.5,
        cap * 0.25,
        200.0,
        100.0,
        50.0,
        30.0,
        20.0,
        10.0,
        5.0,
        2.0,
        1.0,
        0.5,
        0.2,
        0.1,
        0.05,
        0.02,
        0.01,
        0.005,
        0.002,
        0.001,
        0.0005,
        MICRO_STEP_MS,
    ]

    floor = 0.01
    if err_km > 50_000:
        floor = 0.05
    elif err_km > 5000:
        floor = 0.002
    elif err_km > 500:
        floor = 0.0005
    elif err_km > 50:
        floor = MICRO_STEP_MS

    spans: list[float] = []
    for span in candidates:
        if span < floor:
            continue
        if not spans or span < spans[-1] * 0.8:
            spans.append(span)
    return spans or [floor]


def _adaptive_search_span(
    err_m: float,
    base_span_ms: float,
    reference_dv_ms: float,
    *,
    axis_value_ms: float = 0.0,
) -> float:
    """Pick a Δv search window in m/s (not tied linearly to km altitude error)."""
    err_km = krpc_m_to_km(abs(err_m))
    ref = max(abs(reference_dv_ms), abs(axis_value_ms), 1.0)
    cap = max(10.0, min(float(base_span_ms), ref * 0.5))

    if err_km < 2.0:
        return max(1.0, cap * 0.05)
    if err_km < 20.0:
        return max(5.0, cap * 0.12)
    if err_km < 200.0:
        return max(20.0, cap * 0.25)
    if err_km < 2000.0:
        return max(50.0, cap * 0.4)
    return max(100.0, min(cap, 500.0))


def _axes_changed(initial: NodeDv, final: NodeDv) -> tuple[AxisName, ...]:
    return tuple(
        axis
        for axis in AXIS_ORDER
        if abs(final.axis_value(axis) - initial.axis_value(axis)) > 1e-4
    )


def _coarse_axis_probe(
    node: Any,
    dv: NodeDv,
    axis: AxisName,
    target_body: Any | None,
    target_body_name: str | None,
    desired_pe_m: float,
    search_span: float,
) -> tuple[NodeDv, ApproachMetric | None, float]:
    """Sample −span, centre, +span before fine search on an axis."""
    center = dv.axis_value(axis)
    samples = (
        center - search_span,
        center - search_span * 0.5,
        center,
        center + search_span * 0.5,
        center + search_span,
    )

    best_dv = dv
    best_metric: ApproachMetric | None = None
    best_err = math.inf

    for value in samples:
        metric = _measure(node, dv.with_axis(axis, value), target_body, target_body_name)
        if metric is None:
            continue
        err = abs(_approach_error(metric, desired_pe_m))
        if err < best_err:
            best_err = err
            best_metric = metric
            best_dv = dv.with_axis(axis, value)

    return best_dv, best_metric, best_err


def _expand_bracket(
    measure: Callable[[float], ApproachMetric | None],
    center: float,
    search_span: float,
    desired_pe_m: float,
    *,
    max_expansions: int = 6,
) -> tuple[float, float, float | None, float | None]:
    span = search_span
    err_lo: float | None = None
    err_hi: float | None = None
    for _ in range(max_expansions + 1):
        lo = center - span
        hi = center + span
        metric_lo = measure(lo)
        metric_hi = measure(hi)
        err_lo = _approach_error(metric_lo, desired_pe_m) if metric_lo else None
        err_hi = _approach_error(metric_hi, desired_pe_m) if metric_hi else None
        if err_lo is not None and err_hi is not None and err_lo * err_hi <= 0:
            return lo, hi, err_lo, err_hi
        span *= 1.6
    return center - span, center + span, err_lo, err_hi


def _directional_line_search(
    measure: Callable[[float], ApproachMetric | None],
    center: float,
    search_span: float,
    desired_pe_m: float,
    iteration_budget: int,
) -> tuple[float, ApproachMetric | None, float, int]:
    """Walk along an axis in the direction that reduces |altitude error|."""
    metric_center = measure(center)
    if metric_center is None:
        return center, None, math.inf, 0

    err_center = _approach_error(metric_center, desired_pe_m)
    best_value = center
    best_metric = metric_center
    best_err = abs(err_center)
    iterations = 1

    eps = max(MICRO_STEP_MS, min(search_span * 0.02, 1.0))
    metric_eps = measure(center + eps)
    if metric_eps is None:
        return best_value, best_metric, best_err, iterations

    slope = (_approach_error(metric_eps, desired_pe_m) - err_center) / eps
    iterations += 1

    directions: list[float]
    if abs(slope) > 1e-12:
        directions = [-math.copysign(1.0, slope)]
    else:
        directions = [-1.0, 1.0]

    for direction in directions:
        step = search_span * 0.15
        value = center
        stall = 0

        while iterations < iteration_budget and stall < 4:
            candidate = value + direction * step
            metric = measure(candidate)
            iterations += 1
            if metric is None:
                stall += 1
                step *= 0.5
                continue

            err = abs(_approach_error(metric, desired_pe_m))
            if err < best_err:
                best_err = err
                best_metric = metric
                best_value = candidate
                value = candidate
                stall = 0
                step = min(step * 1.35, search_span)
            else:
                stall += 1
                step *= 0.45

    return best_value, best_metric, best_err, iterations


def _tune_axis(
    node: Any,
    dv: NodeDv,
    axis: AxisName,
    target_body: Any | None,
    target_body_name: str | None,
    desired_pe_m: float,
    tolerance_m: float,
    search_span: float,
    iteration_budget: int,
) -> tuple[NodeDv, ApproachMetric | None, float, int, bool]:
    """Probe retrograde/prograde (or −/+ on other axes) then bisect or step on one axis."""
    dv, coarse_metric, coarse_err = _coarse_axis_probe(
        node, dv, axis, target_body, target_body_name, desired_pe_m, search_span
    )
    if coarse_metric is None:
        return dv, None, math.inf, 0, False

    if coarse_err <= tolerance_m:
        return dv, coarse_metric, coarse_err, 1, True

    center = dv.axis_value(axis)

    def measure_axis(value: float) -> ApproachMetric | None:
        return _measure(node, dv.with_axis(axis, value), target_body, target_body_name)

    initial_metric = coarse_metric
    initial_err = _approach_error(initial_metric, desired_pe_m)

    lo, hi, err_lo, err_hi = _expand_bracket(
        measure_axis, center, search_span, desired_pe_m
    )

    best_value = center
    best_metric = initial_metric
    best_err = min(coarse_err, abs(initial_err))
    iterations = 1

    if err_lo is not None and err_hi is not None and err_lo * err_hi <= 0:
        while iterations < iteration_budget:
            mid = (lo + hi) / 2.0
            metric_mid = measure_axis(mid)
            iterations += 1
            if metric_mid is None:
                break

            err_mid = _approach_error(metric_mid, desired_pe_m)
            if abs(err_mid) < best_err:
                best_err = abs(err_mid)
                best_metric = metric_mid
                best_value = mid

            if abs(err_mid) <= tolerance_m:
                return (
                    dv.with_axis(axis, mid),
                    metric_mid,
                    abs(err_mid),
                    iterations,
                    True,
                )

            if err_lo * err_mid <= 0:
                hi = mid
                err_hi = err_mid
            else:
                lo = mid
                err_lo = err_mid
    else:
        remaining = max(0, iteration_budget - iterations)
        if remaining > 0:
            ls_value, ls_metric, ls_err, ls_used = _directional_line_search(
                measure_axis,
                center,
                search_span,
                desired_pe_m,
                remaining,
            )
            iterations += ls_used
            if ls_metric is not None and ls_err < best_err:
                best_err = ls_err
                best_metric = ls_metric
                best_value = ls_value

            if ls_metric is not None and ls_err <= tolerance_m:
                return (
                    dv.with_axis(axis, ls_value),
                    ls_metric,
                    ls_err,
                    iterations,
                    True,
                )

        value = best_value
        metric = best_metric
        if metric is None:
            return dv.with_axis(axis, best_value), best_metric, best_err, iterations, False

        while iterations < iteration_budget:
            err = _approach_error(metric, desired_pe_m)
            if abs(err) <= tolerance_m:
                return (
                    dv.with_axis(axis, value),
                    metric,
                    abs(err),
                    iterations,
                    True,
                )

            step_eps = max(MICRO_STEP_MS, min(search_span * 0.01, 0.5))
            metric_step = measure_axis(value + step_eps)
            iterations += 1
            if metric_step is None:
                break

            slope = (_approach_error(metric_step, desired_pe_m) - err) / step_eps
            if abs(slope) < 1e-12:
                break

            trial = value - (err / slope) * 0.85
            trial = max(lo, min(hi, trial))
            if abs(trial - value) < MICRO_STEP_MS:
                break

            metric_trial = measure_axis(trial)
            iterations += 1
            if metric_trial is None:
                break

            err_trial = _approach_error(metric_trial, desired_pe_m)
            if abs(err_trial) < best_err:
                best_err = abs(err_trial)
                best_metric = metric_trial
                best_value = trial

            if abs(err_trial) <= tolerance_m:
                return (
                    dv.with_axis(axis, trial),
                    metric_trial,
                    abs(err_trial),
                    iterations,
                    True,
                )

            value = trial
            metric = metric_trial

    return dv.with_axis(axis, best_value), best_metric, best_err, iterations, False


def _refine_at_scale(
    measure: Callable[[float], ApproachMetric | None],
    center: float,
    span: float,
    desired_pe_m: float,
    tolerance_m: float,
    iteration_budget: int,
) -> tuple[float, ApproachMetric | None, float, int]:
    """Probe and walk one axis at a single Δv scale down to sub-mm/s steps."""
    metric_center = measure(center)
    if metric_center is None:
        return center, None, math.inf, 0

    best_value = center
    best_metric = metric_center
    best_err = abs(_approach_error(metric_center, desired_pe_m))
    used = 1

    if best_err <= tolerance_m:
        return best_value, best_metric, best_err, used

    for frac in (-1.0, -0.5, -0.25, 0.25, 0.5, 1.0):
        if used >= iteration_budget:
            break
        candidate = center + span * frac
        metric = measure(candidate)
        used += 1
        if metric is None:
            continue
        err = abs(_approach_error(metric, desired_pe_m))
        if err < best_err:
            best_err = err
            best_metric = metric
            best_value = candidate

    if best_err <= tolerance_m:
        return best_value, best_metric, best_err, used

    min_step = max(MICRO_STEP_MS, span / 128.0)
    step = max(min_step, span / 8.0)
    eps = max(min_step, span / 64.0)

    metric_eps = measure(best_value + eps)
    used += 1
    directions: list[float]
    if metric_eps is not None:
        slope = (
            _approach_error(metric_eps, desired_pe_m)
            - _approach_error(best_metric, desired_pe_m)
        ) / eps
        err_signed = _approach_error(best_metric, desired_pe_m)
        if abs(slope) > 1e-15:
            directions = [-math.copysign(1.0, err_signed * slope)]
        else:
            directions = [-1.0, 1.0]
    else:
        directions = [-1.0, 1.0]

    value = best_value
    stall = 0
    while used < iteration_budget and stall < 8:
        if step < min_step:
            break

        improved = False
        for direction in directions:
            if used >= iteration_budget:
                break
            candidate = value + direction * step
            metric = measure(candidate)
            used += 1
            if metric is None:
                continue
            err = abs(_approach_error(metric, desired_pe_m))
            if err < best_err:
                best_err = err
                best_metric = metric
                best_value = candidate
                value = candidate
                improved = True
                stall = 0
                if err <= tolerance_m:
                    return best_value, best_metric, best_err, used
                break

        if not improved:
            stall += 1
            step *= 0.5

    return best_value, best_metric, best_err, used


def _multiscale_axis_tune(
    node: Any,
    dv: NodeDv,
    axis: AxisName,
    target_body: Any | None,
    target_body_name: str | None,
    desired_pe_m: float,
    tolerance_m: float,
    base_span_ms: float,
    iteration_budget: int,
    force_mode: TuneMode | None,
) -> tuple[NodeDv, ApproachMetric | None, float, int, bool]:
    """Walk from multi-km/s down to sub-mm/s increments on one axis."""
    best_dv = dv
    best_metric = _measure(
        node,
        best_dv,
        target_body,
        target_body_name,
        force_mode=force_mode,
    )
    if best_metric is None:
        return best_dv, None, math.inf, 0, False

    best_err = abs(_approach_error(best_metric, desired_pe_m))
    total_used = 1
    if best_err <= tolerance_m:
        return best_dv, best_metric, best_err, total_used, True

    err_km = krpc_m_to_km(best_err)
    if err_km > 5000.0 and axis == "prograde" and total_used < iteration_budget:
        explored_dv, explored_metric, explored_err, explore_used = _wide_axis_explore(
            node,
            best_dv,
            axis,
            target_body,
            target_body_name,
            desired_pe_m,
            base_span_ms,
            iteration_budget - total_used,
            force_mode,
        )
        total_used += explore_used
        if explored_metric is not None and explored_err < best_err:
            best_dv = explored_dv
            best_metric = explored_metric
            best_err = explored_err
            if best_err <= tolerance_m:
                return best_dv, best_metric, best_err, total_used, True
            err_km = krpc_m_to_km(best_err)

    center = best_dv.axis_value(axis)

    def measure_axis(value: float) -> ApproachMetric | None:
        return _measure(
            node,
            best_dv.with_axis(axis, value),
            target_body,
            target_body_name,
            force_mode=force_mode,
        )

    for span in _span_schedule(err_km, base_span_ms, axis):
        if total_used >= iteration_budget:
            break

        remaining = iteration_budget - total_used
        new_value, metric, axis_err, used = _refine_at_scale(
            measure_axis,
            center,
            span,
            desired_pe_m,
            tolerance_m,
            max(6, remaining),
        )
        total_used += used

        if metric is not None and axis_err < best_err:
            best_err = axis_err
            best_metric = metric
            best_value = new_value
            best_dv = best_dv.with_axis(axis, best_value)
            center = best_value

        if best_err <= tolerance_m:
            return best_dv, best_metric, best_err, total_used, True

    return best_dv, best_metric, best_err, total_used, False


def tune_intercept_pe(
    node: Any,
    desired_pe_km: float,
    target_body: Any | None,
    target_body_name: str | None,
    *,
    tolerance_km: float = 1.0,
    max_iterations: int = 40,
    max_prograde_delta_ms: float = 500.0,
) -> TuneOutcome:
    """Adjust node Δv until intercept Pe or closest-approach altitude converges."""
    if target_body is None and not target_body_name:
        raise ValueError(
            "Lock a target body before fine-tuning. "
            "Closest-approach mode needs a target to measure against."
        )

    desired_pe_m = krpc_km_to_m(desired_pe_km)
    tolerance_m = krpc_km_to_m(tolerance_km)
    initial_dv = _read_dv(node)

    _apply_dv(node, initial_dv)
    try:
        post_burn_orbit = node.orbit
    except Exception as exc:
        raise ValueError(f"Cannot read post-burn orbit for this node: {exc}") from exc

    initial_metric = measure_approach(post_burn_orbit, target_body, target_body_name)
    if initial_metric is None:
        orbit_encounters = scan_encounters(post_burn_orbit)
        raise ValueError(
            f"Cannot measure approach to the target from this node. "
            f"{encounter_not_found_message(target_body_name, orbit_encounters)} "
            f"Orbit after node: {describe_orbit(post_burn_orbit)}."
        )

    resolved_target = initial_metric.body_name
    initial_pe_km = krpc_m_to_km(initial_metric.altitude_m)
    best_dv = initial_dv
    best_metric = initial_metric
    best_err = abs(_approach_error(initial_metric, desired_pe_m))
    total_iterations = 0
    reference_dv = max(
        abs(initial_dv.prograde),
        abs(initial_dv.normal),
        abs(initial_dv.radial),
        1.0,
    )
    base_span_ms = float(max_prograde_delta_ms)
    initial_force_mode = _resolve_force_mode(node, best_dv, target_body_name)
    mode_note = _mode_note(initial_metric, initial_force_mode)

    if best_err <= tolerance_m:
        return TuneOutcome(
            success=True,
            target_body_name=resolved_target,
            initial_pe_km=initial_pe_km,
            final_pe_km=initial_pe_km,
            initial_pe_m=initial_metric.altitude_m,
            final_pe_m=initial_metric.altitude_m,
            desired_pe_km=desired_pe_km,
            iterations=0,
            initial_dv=initial_dv,
            final_dv=initial_dv,
            axes_adjusted=(),
            tune_mode=initial_metric.mode,
            message=f"Already within tolerance. {mode_note}",
        )

    if not _axis_is_sensitive(
        node,
        best_dv,
        "prograde",
        target_body,
        target_body_name,
        initial_force_mode,
        _sensitivity_probes_ms(krpc_m_to_km(best_err)),
    ):
        raise ValueError(
            "Intercept altitude is unchanged for ±2/±10/±50 m/s prograde tweaks. "
            "This node may not control the Venus encounter — replan the transfer "
            "or pick the main departure burn node."
        )

    per_axis_budget = max(30, max_iterations // len(AXIS_ORDER))
    stall_passes = 0

    def run_axis(
        axis: AxisName,
        budget: int,
    ) -> bool:
        nonlocal best_dv, best_metric, best_err, total_iterations, mode_note

        if budget <= 0:
            return False

        force_mode = _resolve_force_mode(node, best_dv, target_body_name)
        mode_note = _mode_note(best_metric, force_mode)

        tuned_dv, metric, axis_err, used, converged = _multiscale_axis_tune(
            node,
            best_dv,
            axis,
            target_body,
            target_body_name,
            desired_pe_m,
            tolerance_m,
            base_span_ms,
            budget,
            force_mode,
        )
        total_iterations += used

        if metric is not None and axis_err < best_err:
            best_dv = tuned_dv
            best_metric = metric
            best_err = axis_err

        if converged and best_metric is not None:
            _apply_dv(node, best_dv)
            return True
        return False

    if krpc_m_to_km(best_err) > 5000.0:
        coarse_budget = min(
            max_iterations - total_iterations,
            max(int(max_iterations * 0.45), per_axis_budget * 2),
        )
        if run_axis("prograde", coarse_budget):
            return TuneOutcome(
                success=True,
                target_body_name=resolved_target,
                initial_pe_km=initial_pe_km,
                final_pe_km=krpc_m_to_km(best_metric.altitude_m),
                initial_pe_m=initial_metric.altitude_m,
                final_pe_m=best_metric.altitude_m,
                desired_pe_km=desired_pe_km,
                iterations=total_iterations,
                initial_dv=initial_dv,
                final_dv=best_dv,
                axes_adjusted=_axes_changed(initial_dv, best_dv),
                tune_mode=best_metric.mode,
                message=mode_note,
            )

    for _pass in range(MAX_PASSES):
        if total_iterations >= max_iterations or best_err <= tolerance_m:
            break

        pass_start_err = best_err
        for axis in AXIS_ORDER:
            if total_iterations >= max_iterations or best_err <= tolerance_m:
                break

            remaining = max_iterations - total_iterations
            budget = min(per_axis_budget, remaining)
            if run_axis(axis, budget):
                return TuneOutcome(
                    success=True,
                    target_body_name=resolved_target,
                    initial_pe_km=initial_pe_km,
                    final_pe_km=krpc_m_to_km(best_metric.altitude_m),
                    initial_pe_m=initial_metric.altitude_m,
                    final_pe_m=best_metric.altitude_m,
                    desired_pe_km=desired_pe_km,
                    iterations=total_iterations,
                    initial_dv=initial_dv,
                    final_dv=best_dv,
                    axes_adjusted=_axes_changed(initial_dv, best_dv),
                    tune_mode=best_metric.mode,
                    message=mode_note if best_metric.mode == "closest_approach" else None,
                )

        if best_err <= pass_start_err - tolerance_m:
            stall_passes = 0
        else:
            stall_passes += 1
            if stall_passes >= 2 and best_err > tolerance_m * 10:
                stall_passes = 0
            elif stall_passes >= 2:
                break

    _apply_dv(node, best_dv)
    final_pe_km = krpc_m_to_km(best_metric.altitude_m)
    success = best_err <= tolerance_m
    axes_adjusted = _axes_changed(initial_dv, best_dv)
    axis_summary = ", ".join(axes_adjusted) if axes_adjusted else "none"
    metric_label = (
        "intercept Pe"
        if best_metric.mode == "intercept_pe"
        else "closest-approach altitude"
    )

    return TuneOutcome(
        success=success,
        target_body_name=resolved_target,
        initial_pe_km=initial_pe_km,
        final_pe_km=final_pe_km,
        initial_pe_m=initial_metric.altitude_m,
        final_pe_m=best_metric.altitude_m,
        desired_pe_km=desired_pe_km,
        iterations=total_iterations,
        initial_dv=initial_dv,
        final_dv=best_dv,
        axes_adjusted=axes_adjusted,
        tune_mode=best_metric.mode,
        message=None
        if success
        else (
            f"Best effort: {metric_label} {final_pe_km:.1f} km "
            f"({best_metric.altitude_m:.0f} m, target {desired_pe_km:.1f} km, "
            f"tolerance ±{tolerance_km:.1f} km). "
            f"Adjusted axes: {axis_summary}. {mode_note}"
            + (
                " Objective did not respond to node Δv — try replanning the transfer."
                if not axes_adjusted
                else ""
            )
        ),
    )
