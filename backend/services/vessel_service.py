from typing import Any

from backend.core.connection import GameConnection, game_connection
from backend.core.exceptions import VesselControlError
from backend.models.vessel import VesselControlsState, VesselPointMode

STAGE_ALLOWED_SITUATIONS = {"pre_launch", "flying", "orbiting"}

_POINT_MODE_ATTR: dict[VesselPointMode, str] = {
    VesselPointMode.prograde: "prograde",
    VesselPointMode.retrograde: "retrograde",
    VesselPointMode.normal: "normal",
    VesselPointMode.anti_normal: "anti_normal",
    VesselPointMode.radial: "radial",
    VesselPointMode.anti_radial: "anti_radial",
    VesselPointMode.maneuver: "maneuver",
    VesselPointMode.target: "target",
    VesselPointMode.anti_target: "anti_target",
    VesselPointMode.stability_assist: "stability_assist",
}


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
            sas_mode=self._read_sas_mode(control),
        )

    @staticmethod
    def _read_sas_mode(control: Any) -> VesselPointMode | None:
        if not bool(control.sas):
            return None
        try:
            raw_mode = control.sas_mode
            mode_name = str(getattr(raw_mode, "name", raw_mode))
            if "." in mode_name:
                mode_name = mode_name.split(".")[-1]
            return VesselPointMode(mode_name)
        except Exception:
            return None

    def _resolve_sas_mode(self, mode: VesselPointMode) -> Any:
        sas_modes = self._game.space_center.SASMode
        attr = _POINT_MODE_ATTR[mode]
        try:
            return getattr(sas_modes, attr)
        except AttributeError as exc:
            raise VesselControlError(f"Unsupported SAS mode '{mode.value}'.") from exc

    def point_to(self, mode: VesselPointMode) -> VesselControlsState:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        control = vessel.control
        try:
            control.sas_mode = self._resolve_sas_mode(mode)
            control.sas = True
        except VesselControlError:
            raise
        except Exception as exc:
            raise VesselControlError(f"Cannot point {mode.value}: {exc}") from exc
        return self.get_controls()

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
