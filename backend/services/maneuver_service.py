import math
from typing import Any

from backend.core.connection import GameConnection, game_connection
from backend.core.exceptions import MechJebNotReadyError
from backend.core.krpc_units import body_names_match, krpc_m_to_km
from backend.core.maneuver_tuner import (
    describe_orbit,
    find_encounter_pe,
    measure_approach,
    scan_encounters,
    tune_intercept_pe,
)
from backend.core.mechjeb_maneuvers import (
    OPERATION_SPECS,
    configure_operation,
    get_operation_spec,
)
from backend.models.maneuver import (
    ExecuteMode,
    ManeuverEncounterSummary,
    ManeuverExecuteRequest,
    ManeuverFineTunePreview,
    ManeuverFineTuneRequest,
    ManeuverFineTuneResult,
    ManeuverNodeSummary,
    ManeuverOperationSpec,
    ManeuverPlanRequest,
    ManeuverPlanResult,
    ManeuverWarpResult,
    TimeReferenceId,
)
from backend.services.target_service import target_service


class ManeuverService:
    def __init__(self, game: GameConnection = game_connection) -> None:
        self._game = game
        self._default_tolerance_ms = 0.5
        self._node_tolerances: dict[str, float] = {}

    def list_operations(self) -> list[ManeuverOperationSpec]:
        return OPERATION_SPECS

    def list_nodes(self) -> list[ManeuverNodeSummary]:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        ordered = self._ordered_nodes(vessel)
        self._prune_node_tolerances(ordered)
        return [self._summarize_node(node) for node in ordered]

    def set_node_tolerance(self, node_index: int, tolerance_ms: float) -> ManeuverNodeSummary:
        self._game.require_flight()
        if tolerance_ms <= 0:
            raise ValueError("Tolerance must be greater than 0 m/s.")

        vessel = self._game.active_vessel()
        nodes = self._ordered_nodes(vessel)
        if not nodes:
            raise MechJebNotReadyError("No maneuver nodes to update.")
        if node_index < 0 or node_index >= len(nodes):
            raise MechJebNotReadyError(
                f"Node index {node_index} is out of range (0–{len(nodes) - 1})."
            )

        node = nodes[node_index]
        self._node_tolerances[self._node_ut_key(node)] = float(tolerance_ms)
        return self._summarize_node(node)

    def set_default_tolerance(self, tolerance_ms: float) -> float:
        if tolerance_ms <= 0:
            raise ValueError("Tolerance must be greater than 0 m/s.")
        self._default_tolerance_ms = float(tolerance_ms)
        return self._default_tolerance_ms

    def preview_intercept_pe(
        self,
        node_index: int = 0,
        target_body_name: str | None = None,
    ) -> tuple[float, str] | None:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        nodes = self._ordered_nodes(vessel)
        if not nodes:
            return None
        if node_index < 0 or node_index >= len(nodes):
            raise MechJebNotReadyError(f"Node index {node_index} is out of range.")
        encounter = find_encounter_pe(
            nodes[node_index].orbit,
            self._resolve_target_body_name(target_body_name),
        )
        if encounter is None:
            return None
        return krpc_m_to_km(encounter.pe_altitude_m), encounter.body_name

    def clear_nodes(self) -> int:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        count = len(list(vessel.control.nodes))
        vessel.control.remove_nodes()
        self._node_tolerances.clear()
        return count

    def delete_node(self, node_index: int) -> list[ManeuverNodeSummary]:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        nodes = self._ordered_nodes(vessel)
        if not nodes:
            raise MechJebNotReadyError("No maneuver nodes to delete.")
        if node_index < 0 or node_index >= len(nodes):
            raise MechJebNotReadyError(
                f"Node index {node_index} is out of range (0–{len(nodes) - 1})."
            )

        node = nodes[node_index]
        self._node_tolerances.pop(self._node_ut_key(node), None)
        node.remove()
        return self.list_nodes()

    def preview_fine_tune(self, node_index: int = 0) -> ManeuverFineTunePreview:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        nodes = self._ordered_nodes(vessel)
        if not nodes:
            raise MechJebNotReadyError("No maneuver nodes to inspect.")

        if node_index < 0 or node_index >= len(nodes):
            raise MechJebNotReadyError(
                f"Node index {node_index} is out of range (0–{len(nodes) - 1})."
            )

        node = nodes[node_index]
        orbit = node.orbit
        encounters = scan_encounters(orbit)
        time_to_soi_s: float | None = None
        next_soi_body: str | None = None
        orbit_body: str | None = None

        try:
            orbit_body = str(orbit.body.name)
            raw_t_soi = float(orbit.time_to_soi_change)
            if math.isfinite(raw_t_soi):
                time_to_soi_s = raw_t_soi
            next_orbit = orbit.next_orbit
            if next_orbit is not None:
                next_soi_body = str(next_orbit.body.name)
        except Exception:
            pass

        target_body, resolved_target = self._resolve_fine_tune_target(
            None
        )
        approach = measure_approach(orbit, target_body, resolved_target)

        return ManeuverFineTunePreview(
            node_index=node_index,
            node_count=len(nodes),
            orbit_body=orbit_body,
            time_to_soi_s=time_to_soi_s,
            next_soi_body=next_soi_body,
            resolved_target=resolved_target,
            encounters=[
                ManeuverEncounterSummary(
                    body_name=enc.body_name,
                    pe_km=krpc_m_to_km(enc.pe_altitude_m),
                    pe_m=enc.pe_altitude_m,
                )
                for enc in encounters
            ],
            orbit_description=describe_orbit(orbit),
            tune_mode=approach.mode if approach else None,
            approach_altitude_km=(
                krpc_m_to_km(approach.altitude_m) if approach else None
            ),
            approach_altitude_m=approach.altitude_m if approach else None,
            miss_distance_km=(
                krpc_m_to_km(approach.miss_distance_m)
                if approach and approach.miss_distance_m is not None
                else None
            ),
            can_tune=approach is not None,
        )

    def fine_tune(self, request: ManeuverFineTuneRequest) -> ManeuverFineTuneResult:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        nodes = self._ordered_nodes(vessel)
        if not nodes:
            raise MechJebNotReadyError("No maneuver nodes to fine-tune.")

        if request.node_index < 0 or request.node_index >= len(nodes):
            raise MechJebNotReadyError(
                f"Node index {request.node_index} is out of range "
                f"(0–{len(nodes) - 1})."
            )

        node = nodes[request.node_index]
        target_body, target_body_name = self._resolve_fine_tune_target(
            request.target_body_name
        )
        outcome = tune_intercept_pe(
            node,
            request.desired_pe_km,
            target_body,
            target_body_name,
            tolerance_km=request.tolerance_km,
            max_iterations=request.max_iterations,
            max_prograde_delta_ms=request.max_prograde_delta_ms,
        )

        init = outcome.initial_dv
        final = outcome.final_dv

        return ManeuverFineTuneResult(
            success=outcome.success,
            target_body_name=outcome.target_body_name,
            initial_pe_km=outcome.initial_pe_km,
            final_pe_km=outcome.final_pe_km,
            initial_pe_m=outcome.initial_pe_m,
            final_pe_m=outcome.final_pe_m,
            desired_pe_km=outcome.desired_pe_km,
            iterations=outcome.iterations,
            initial_prograde_ms=init.prograde,
            final_prograde_ms=final.prograde,
            delta_prograde_ms=final.prograde - init.prograde,
            initial_normal_ms=init.normal,
            final_normal_ms=final.normal,
            delta_normal_ms=final.normal - init.normal,
            initial_radial_ms=init.radial,
            final_radial_ms=final.radial,
            delta_radial_ms=final.radial - init.radial,
            axes_adjusted=list(outcome.axes_adjusted),
            tune_mode=outcome.tune_mode,
            message=outcome.message,
            nodes=self.list_nodes(),
        )

    def plan(self, request: ManeuverPlanRequest) -> ManeuverPlanResult:
        self._game.require_flight()
        spec = get_operation_spec(request.operation)
        if spec.needs_target:
            self._require_target()

        if request.clear_existing:
            self.clear_nodes()

        planner = self._game.mechjeb.maneuver_planner
        target_status = target_service.get_status()
        operation = configure_operation(
            planner,
            self._game.mechjeb,
            request,
            target_status.target_type,
        )

        try:
            created = operation.make_nodes()
        except Exception as exc:
            raise MechJebNotReadyError(f"Maneuver planning failed: {exc}") from exc

        self._apply_x_from_now_fallback(created, request)

        warning = str(operation.error_message).strip() or None
        nodes = self.list_nodes()
        return ManeuverPlanResult(
            operation=request.operation,
            nodes_created=len(created),
            warning=warning,
            nodes=nodes,
        )

    def _apply_x_from_now_fallback(
        self,
        created: Any,
        request: ManeuverPlanRequest,
    ) -> None:
        """Shift immediate nodes forward when X-from-now timing was requested."""
        if request.time_reference != TimeReferenceId.x_from_now:
            return

        lead_time_s = request.lead_time_s
        if lead_time_s is None or lead_time_s <= 0:
            return

        try:
            ut_now = float(self._game.space_center.ut)
        except Exception:
            return

        target_ut = ut_now + float(lead_time_s)
        for node in created:
            try:
                if float(node.time_to) < 1.0:
                    node.ut = target_ut
            except Exception:
                continue

    def resolve_execute_tolerance(
        self,
        mode: ExecuteMode,
        override: float | None = None,
    ) -> float:
        if override is not None:
            return float(override)

        nodes = self.list_nodes()
        if not nodes:
            return self._default_tolerance_ms
        if mode == "one":
            return nodes[0].tolerance_ms
        return min(node.tolerance_ms for node in nodes)

    def configure_executor(self, request: ManeuverExecuteRequest) -> None:
        executor = self._game.mechjeb.node_executor
        executor.tolerance = self.resolve_execute_tolerance(
            request.mode,
            request.tolerance,
        )
        executor.autowarp = bool(request.autowarp)
        executor.lead_time = float(request.lead_time_s)

    def start_execution(self, request: ManeuverExecuteRequest) -> None:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        if len(list(vessel.control.nodes)) == 0:
            raise MechJebNotReadyError("No maneuver nodes to execute")

        self.configure_executor(request)
        executor = self._game.mechjeb.node_executor
        if request.mode == "one":
            executor.execute_one_node()
        else:
            executor.execute_all_nodes()

    def warp_to_next_node(self, lead_time_s: float = 3.0) -> ManeuverWarpResult:
        self._game.require_flight()
        if self.executor_enabled():
            raise MechJebNotReadyError("Cannot warp while a maneuver burn is active.")

        vessel = self._game.active_vessel()
        nodes = self._ordered_nodes(vessel)
        if not nodes:
            raise MechJebNotReadyError("No maneuver nodes to warp to.")

        node = nodes[0]
        ut_now = float(self._game.space_center.ut)
        delta_v_ms = float(node.delta_v)
        half_burn_s = 0.0
        mass = float(vessel.mass)
        thrust = float(vessel.available_thrust) or float(vessel.max_thrust)
        if thrust > 0 and mass > 0:
            half_burn_s = (delta_v_ms / (thrust / mass)) / 2.0

        warp_ut = float(node.ut) - half_burn_s - float(lead_time_s)
        if warp_ut <= ut_now:
            return ManeuverWarpResult(
                node_ut=float(node.ut),
                warp_ut=ut_now,
                time_to_node_s=float(node.time_to),
                delta_v_ms=delta_v_ms,
            )

        self._game.space_center.warp_to(warp_ut)
        return ManeuverWarpResult(
            node_ut=float(node.ut),
            warp_ut=warp_ut,
            time_to_node_s=float(node.time_to),
            delta_v_ms=delta_v_ms,
        )

    def abort_execution(self) -> None:
        if not self._game.is_connected():
            return
        try:
            self._game.mechjeb.node_executor.abort()
        except Exception:
            pass

    def executor_enabled(self) -> bool:
        if not self._game.is_connected():
            return False
        try:
            return bool(self._game.mechjeb.node_executor.enabled)
        except Exception:
            return False

    def _require_target(self) -> None:
        try:
            if not bool(self._game.mechjeb.target_controller.normal_target_exists):
                raise MechJebNotReadyError(
                    "A target must be locked before this maneuver can be planned."
                )
        except MechJebNotReadyError:
            raise
        except Exception as exc:
            raise MechJebNotReadyError(f"Cannot verify MechJeb target: {exc}") from exc

    @staticmethod
    def _ordered_nodes(vessel: Any) -> list[Any]:
        return sorted(list(vessel.control.nodes), key=lambda node: float(node.ut))

    def _locked_ksp_target_body(self) -> Any | None:
        try:
            return self._game.space_center.target_body
        except Exception:
            return None

    def _get_target_body(self, name: str | None) -> Any | None:
        locked = self._locked_ksp_target_body()
        if locked is not None:
            if name is None or body_names_match(str(locked.name), name):
                return locked

        if not name:
            return None

        try:
            bodies = self._game.space_center.bodies
            try:
                return bodies[name]
            except Exception:
                pass

            for body in bodies.values():
                body_name = str(body.name)
                if body_names_match(body_name, name):
                    return body

            for key in bodies:
                key_str = str(key)
                if body_names_match(key_str, name):
                    return bodies[key]
        except Exception:
            pass
        return None

    def _resolve_fine_tune_target(
        self,
        explicit: str | None,
    ) -> tuple[Any | None, str | None]:
        locked_body = self._locked_ksp_target_body()
        if locked_body is not None:
            return locked_body, str(locked_body.name)

        name = self._resolve_target_body_name(explicit)
        return self._get_target_body(name), name

    def _resolve_target_body_name(self, explicit: str | None) -> str | None:
        locked_body = self._locked_ksp_target_body()
        if locked_body is not None:
            return str(locked_body.name)

        status = target_service.get_status()
        locked: str | None = None
        if status.target_type == "body" and status.name:
            locked = status.name
        elif status.target_type == "vessel" and status.orbit_body:
            locked = status.orbit_body

        if locked:
            return self._normalize_body_name(locked)
        if explicit:
            return self._normalize_body_name(explicit)
        return None

    def _normalize_body_name(self, name: str | None) -> str | None:
        if not name:
            return None
        try:
            bodies = self._game.space_center.bodies
            if name in bodies:
                return name
            compact = name.lower().replace(" ", "")
            for key in bodies:
                key_str = str(key)
                key_compact = key_str.lower().replace(" ", "")
                if key_compact == compact or compact in key_compact or key_compact in compact:
                    return key_str
        except Exception:
            pass
        return name

    @staticmethod
    def _node_ut_key(node: Any) -> str:
        return f"{float(node.ut):.3f}"

    def _tolerance_for_node(self, node: Any) -> float:
        return self._node_tolerances.get(
            self._node_ut_key(node),
            self._default_tolerance_ms,
        )

    def _prune_node_tolerances(self, nodes: list[Any]) -> None:
        active = {self._node_ut_key(node) for node in nodes}
        self._node_tolerances = {
            key: value
            for key, value in self._node_tolerances.items()
            if key in active
        }

    def _summarize_node(self, node: Any) -> ManeuverNodeSummary:
        return ManeuverNodeSummary(
            ut=float(node.ut),
            delta_v_ms=float(node.delta_v),
            remaining_delta_v_ms=float(node.remaining_delta_v),
            time_to_s=float(node.time_to),
            tolerance_ms=self._tolerance_for_node(node),
        )


maneuver_service = ManeuverService()
