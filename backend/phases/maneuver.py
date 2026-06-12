import asyncio
import logging
from typing import Callable

from backend.core.connection import GameConnection
from backend.core.exceptions import PhaseConflictError
from backend.models.ascent import PhaseState
from backend.models.maneuver import (
    ManeuverExecuteRequest,
    ManeuverFineTuneRequest,
    ManeuverFineTuneResult,
    ManeuverOperationId,
    ManeuverPlanRequest,
    ManeuverPlanResult,
    ManeuverStatus,
)
from backend.phases.base import Phase
from backend.services.maneuver_service import maneuver_service

logger = logging.getLogger(__name__)


class ManeuverPhase(Phase):
    name = "maneuver"

    def __init__(
        self,
        game: GameConnection,
        on_status_change: Callable[[ManeuverStatus], None] | None = None,
        is_other_phase_running: Callable[[], bool] | None = None,
    ) -> None:
        self._game = game
        self._on_status_change = on_status_change
        self._is_other_phase_running = is_other_phase_running
        self._state = PhaseState.idle
        self._last_error: str | None = None
        self._last_warning: str | None = None
        self._last_operation: ManeuverOperationId | None = None
        self._task: asyncio.Task[None] | None = None
        self._abort_requested = False

    @property
    def state(self) -> PhaseState:
        return self._state

    def configure(self, request: ManeuverExecuteRequest) -> None:
        self._game.require_flight()
        maneuver_service.configure_executor(request)

    def plan(self, request: ManeuverPlanRequest) -> ManeuverPlanResult:
        if self._task is not None and not self._task.done():
            raise PhaseConflictError("Cannot plan while a maneuver burn is running")

        result = maneuver_service.plan(request)
        self._last_operation = request.operation
        self._last_warning = result.warning
        self._last_error = None
        self._emit_status()
        return result

    def fine_tune(self, request: ManeuverFineTuneRequest) -> ManeuverFineTuneResult:
        if self._task is not None and not self._task.done():
            raise PhaseConflictError("Cannot fine-tune while a maneuver burn is running")

        result = maneuver_service.fine_tune(request)
        self._last_error = None
        self._last_warning = None if result.success else result.message
        self._emit_status()
        return result

    def clear_nodes(self) -> int:
        if self._task is not None and not self._task.done():
            raise PhaseConflictError("Cannot clear nodes while a maneuver burn is running")
        removed = maneuver_service.clear_nodes()
        self._emit_status()
        return removed

    async def start(self, request: ManeuverExecuteRequest | None = None) -> ManeuverStatus:
        if self._task is not None and not self._task.done():
            raise PhaseConflictError("Maneuver execution is already running")
        if self._is_other_phase_running and self._is_other_phase_running():
            raise PhaseConflictError("Another flight phase is already running")

        self._abort_requested = False
        self._last_error = None
        execute_request = request or ManeuverExecuteRequest()
        maneuver_service.start_execution(execute_request)

        self._state = PhaseState.running
        self._emit_status()
        self._task = asyncio.create_task(self._run())
        return self.get_status()

    async def _run(self) -> None:
        try:
            while maneuver_service.executor_enabled() and not self._abort_requested:
                self._emit_status()
                await asyncio.sleep(0.5)
            if self._abort_requested:
                self._state = PhaseState.aborted
            else:
                self._state = PhaseState.completed
        except asyncio.CancelledError:
            self._state = PhaseState.aborted
            raise
        except Exception as exc:
            if self._game.is_connected():
                logger.exception("Maneuver phase failed")
            self._last_error = str(exc)
            self._state = PhaseState.error
        finally:
            self._task = None
            self._emit_status()

    def abort(self) -> None:
        self._abort_requested = True
        maneuver_service.abort_execution()
        if self._task is not None and not self._task.done():
            self._task.cancel()
        else:
            self._state = PhaseState.aborted
            self._emit_status()

    def get_status(self) -> ManeuverStatus:
        executor_enabled = False
        node_count = 0
        next_ut: float | None = None
        next_time_to: float | None = None

        if self._game.is_connected():
            try:
                executor_enabled = maneuver_service.executor_enabled()
                nodes = maneuver_service.list_nodes()
                node_count = len(nodes)
                if nodes:
                    next_ut = nodes[0].ut
                    next_time_to = nodes[0].time_to_s
            except Exception:
                pass

        return ManeuverStatus(
            state=self._state,
            executor_enabled=executor_enabled,
            node_count=node_count,
            next_node_ut=next_ut,
            next_node_time_to_s=next_time_to,
            last_operation=self._last_operation,
            last_error=self._last_error,
            last_warning=self._last_warning,
        )

    def _emit_status(self) -> None:
        if self._on_status_change is not None:
            self._on_status_change(self.get_status())
