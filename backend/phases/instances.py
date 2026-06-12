from backend.core.async_utils import schedule_coroutine
from backend.core.connection import game_connection
from backend.models.ascent import AscentStatus, PhaseState
from backend.models.maneuver import ManeuverStatus
from backend.phases.ascent import AscentPhase
from backend.phases.maneuver import ManeuverPhase
from backend.services.telemetry_service import telemetry_service


def _on_ascent_status_change(status: AscentStatus) -> None:
    schedule_coroutine(telemetry_service.broadcast_ascent(status))


def _on_maneuver_status_change(status: ManeuverStatus) -> None:
    schedule_coroutine(telemetry_service.broadcast_maneuver(status))


ascent_phase = AscentPhase(
    game_connection,
    on_status_change=_on_ascent_status_change,
)
maneuver_phase = ManeuverPhase(
    game_connection,
    on_status_change=_on_maneuver_status_change,
    is_other_phase_running=lambda: ascent_phase.state == PhaseState.running,
)
ascent_phase._is_other_phase_running = (
    lambda: maneuver_phase.state == PhaseState.running
)

telemetry_service.set_ascent_status_provider(ascent_phase.get_status)
telemetry_service.set_maneuver_status_provider(maneuver_phase.get_status)
