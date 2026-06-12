from typing import Any

from backend.core.connection import GameConnection, game_connection
from backend.core.exceptions import VesselControlError
from backend.models.vessel import VesselControlsState

STAGE_ALLOWED_SITUATIONS = {"pre_launch", "flying", "orbiting"}


def _situation_name(vessel: Any) -> str:
    situation = vessel.situation
    if hasattr(situation, "name"):
        return str(situation.name)
    text = str(situation)
    return text.split(".")[-1] if "." in text else text


class VesselService:
    def __init__(self, game: GameConnection = game_connection) -> None:
        self._game = game

    def get_controls(self) -> VesselControlsState:
        return self._game.run_sync(self._read_controls)

    def _read_controls(self) -> VesselControlsState:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        control = vessel.control
        return VesselControlsState(
            sas=bool(control.sas),
            rcs=bool(control.rcs),
            lights=bool(control.lights),
            throttle=float(control.throttle),
            current_stage=int(control.current_stage),
        )

    def stage(self) -> VesselControlsState:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        situation = _situation_name(vessel)
        if situation not in STAGE_ALLOWED_SITUATIONS:
            raise VesselControlError(
                f"Cannot stage in situation '{situation}'. "
                f"Allowed: {', '.join(sorted(STAGE_ALLOWED_SITUATIONS))}"
            )
        try:
            vessel.control.activate_next_stage()
        except Exception as exc:
            message = str(exc)
            if "staging" in message.lower() or "locked" in message.lower():
                raise VesselControlError(f"Staging failed: {message}") from exc
            raise VesselControlError(f"Staging failed: {message}") from exc
        return self.get_controls()

    def set_sas(self, enabled: bool) -> VesselControlsState:
        self._game.require_flight()
        self._game.active_vessel().control.sas = enabled
        return self.get_controls()

    def set_rcs(self, enabled: bool) -> VesselControlsState:
        self._game.require_flight()
        self._game.active_vessel().control.rcs = enabled
        return self.get_controls()

    def set_lights(self, enabled: bool) -> VesselControlsState:
        self._game.require_flight()
        self._game.active_vessel().control.lights = enabled
        return self.get_controls()
