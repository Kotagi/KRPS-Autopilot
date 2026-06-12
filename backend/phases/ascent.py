import asyncio
import logging
from typing import Any, Callable

from backend.core.connection import GameConnection
from backend.core.exceptions import MechJebNotReadyError, PhaseConflictError
from backend.core.mechjeb_actions import set_ascent_autopilot_engaged
from backend.core.mechjeb_ascent_settings import (
    legacy_pvg_targets_km,
    read_ascent_path,
    read_pvg_targets_km,
    write_ascent_path,
    write_pvg_targets_km,
)
from backend.core.mechjeb_units import (
    altitude_km_to_m,
    altitude_m_to_km,
    pressure_kpa_to_pa,
    pressure_pa_to_kpa,
    turn_shape_from_mechjeb,
    turn_shape_to_mechjeb,
)
from backend.models.ascent import (
    ASCENT_PATH_INDEX,
    INDEX_TO_ASCENT_PATH,
    AscentConfig,
    AscentPath,
    AscentStatus,
    ClassicPathConfig,
    GTPathConfig,
    PhaseState,
    PVGPathConfig,
)
from backend.phases.base import Phase

logger = logging.getLogger(__name__)


class AscentPhase(Phase):
    name = "ascent"

    def __init__(
        self,
        game: GameConnection,
        on_status_change: Callable[[AscentStatus], None] | None = None,
        is_other_phase_running: Callable[[], bool] | None = None,
    ) -> None:
        self._game = game
        self._on_status_change = on_status_change
        self._is_other_phase_running = is_other_phase_running
        self._config: AscentConfig | None = None
        self._state = PhaseState.idle
        self._last_error: str | None = None
        self._task: asyncio.Task[None] | None = None
        self._abort_requested = False
        self._autopilot_engaged = False

    @property
    def state(self) -> PhaseState:
        return self._state

    def configure(self, config: AscentConfig) -> None:
        self._game.require_flight()
        self._config = config
        self._state = PhaseState.configuring
        self._last_error = None
        self._apply_config(config)
        self._state = PhaseState.idle
        self._emit_status()

    def _resolve_config(self, config: AscentConfig | None) -> AscentConfig:
        if config is not None:
            return config
        if self._config is not None:
            return self._config
        return self.read_live_config()

    def _engage_ascent_autopilot(self, ascent: Any) -> None:
        """Engage MechJeb ascent guidance via the Ascent AP toggle action.

        kRPC.MechJeb's ascent_autopilot.enabled targets a legacy module that MechJeb
        2.14+ no longer drives; the in-game Engage button uses Ascent AP toggle instead.
        """
        self._refresh_ascent_path(ascent)
        self._autopilot_engaged = set_ascent_autopilot_engaged(
            self._game, engaged=True, currently_engaged=self._autopilot_engaged
        )
        logger.info("MechJeb ascent autopilot engaged via Ascent AP toggle")

    def _refresh_ascent_path(self, ascent: Any) -> None:
        path_idx = int(ascent.ascent_path_index)
        ascent.ascent_path_index = path_idx

    def read_live_config(self) -> AscentConfig:
        self._game.require_flight()
        ascent = self._game.mechjeb.ascent_autopilot
        self._refresh_ascent_path(ascent)
        path_idx = int(ascent.ascent_path_index)
        path = INDEX_TO_ASCENT_PATH.get(path_idx, "gt")

        classic = ascent.ascent_path_classic
        gt = ascent.ascent_path_gt
        pvg = ascent.ascent_path_pvg

        peri_km, apo_km = self._read_pvg_targets()
        bridge_path = read_ascent_path(self._game)
        if bridge_path is not None:
            path = bridge_path

        return AscentConfig(
            desired_orbit_altitude_km=peri_km,
            desired_inclination_deg=float(ascent.desired_inclination),
            launch_lan_difference_deg=float(ascent.launch_lan_difference),
            ascent_path=path,
            autostage=bool(ascent.autostage),
            force_roll=bool(ascent.force_roll),
            vertical_roll=float(ascent.vertical_roll),
            turn_roll=float(ascent.turn_roll),
            classic=ClassicPathConfig(
                turn_start_altitude_km=altitude_m_to_km(float(classic.turn_start_altitude)),
                turn_start_velocity_ms=float(classic.turn_start_velocity),
                turn_end_altitude_km=altitude_m_to_km(float(classic.turn_end_altitude)),
                turn_end_angle_deg=float(classic.turn_end_angle),
                turn_shape_exponent=turn_shape_from_mechjeb(
                    float(classic.turn_shape_exponent)
                ),
                auto_path=bool(classic.auto_path),
                auto_turn_percent=float(classic.auto_turn_percent),
                auto_turn_speed_factor=float(classic.auto_turn_speed_factor),
            ),
            gt=GTPathConfig(
                turn_start_altitude_km=altitude_m_to_km(float(gt.turn_start_altitude)),
                turn_start_velocity_ms=float(gt.turn_start_velocity),
                turn_start_pitch_deg=float(gt.turn_start_pitch),
                intermediate_altitude_km=altitude_m_to_km(float(gt.intermediate_altitude)),
                hold_ap_time_s=float(gt.hold_ap_time),
            ),
            pvg=PVGPathConfig(
                target_periapsis_km=peri_km,
                target_apoapsis_km=apo_km,
                attach_altitude_km=altitude_m_to_km(float(pvg.desired_attach_alt)),
                attach_alt_enabled=bool(pvg.attach_alt_flag),
                pitch_start_velocity_ms=float(pvg.pitch_start_velocity),
                pitch_rate_deg_per_s=float(pvg.pitch_rate),
                q_trigger_kpa=pressure_pa_to_kpa(float(pvg.dynamic_pressure_trigger)),
                pvg_after_stage=int(pvg.staging_trigger),
                pvg_after_stage_enabled=bool(pvg.staging_trigger_flag),
                fixed_coast=bool(pvg.fixed_coast),
                fixed_coast_length_s=float(pvg.fixed_coast_length),
            ),
        )

    def _read_pvg_targets(self) -> tuple[float, float]:
        targets = read_pvg_targets_km(self._game)
        if targets is not None:
            return targets
        return legacy_pvg_targets_km(self._game)

    @staticmethod
    def _normalize_pvg_config(config: AscentConfig) -> AscentConfig:
        """Keep PVG peri/apo fields aligned with what MechJeb stores."""
        if config.ascent_path != "pvg":
            return config
        peri = config.pvg.target_periapsis_km
        apo = config.pvg.target_apoapsis_km
        return config.model_copy(
            update={
                "desired_orbit_altitude_km": peri,
                "pvg": config.pvg.model_copy(
                    update={
                        "target_periapsis_km": peri,
                        "target_apoapsis_km": apo,
                    }
                ),
            }
        )

    def _apply_config(self, config: AscentConfig) -> None:
        config = self._normalize_pvg_config(config)
        ascent = self._game.mechjeb.ascent_autopilot
        ascent.ascent_path_index = ASCENT_PATH_INDEX[config.ascent_path]
        ascent.desired_inclination = config.desired_inclination_deg
        ascent.launch_lan_difference = config.launch_lan_difference_deg
        ascent.autostage = config.autostage
        ascent.force_roll = config.force_roll
        ascent.vertical_roll = config.vertical_roll
        ascent.turn_roll = config.turn_roll

        if config.ascent_path == "pvg":
            peri_km = config.pvg.target_periapsis_km
            apo_km = config.pvg.target_apoapsis_km
            if write_pvg_targets_km(self._game, peri_km, apo_km):
                write_ascent_path(self._game, config.ascent_path)
            ascent.desired_orbit_altitude = altitude_km_to_m(peri_km)
            self._apply_pvg(ascent.ascent_path_pvg, config.pvg)
        else:
            ascent.desired_orbit_altitude = altitude_km_to_m(
                config.desired_orbit_altitude_km
            )

        if config.ascent_path == "classic":
            self._apply_classic(ascent.ascent_path_classic, config.classic)
        elif config.ascent_path == "gt":
            self._apply_gt(ascent.ascent_path_gt, config.gt)

    @staticmethod
    def _apply_classic(classic: Any, cfg: ClassicPathConfig) -> None:
        classic.turn_start_altitude = altitude_km_to_m(cfg.turn_start_altitude_km)
        classic.turn_start_velocity = cfg.turn_start_velocity_ms
        classic.turn_end_altitude = altitude_km_to_m(cfg.turn_end_altitude_km)
        classic.turn_end_angle = cfg.turn_end_angle_deg
        classic.turn_shape_exponent = turn_shape_to_mechjeb(cfg.turn_shape_exponent)
        classic.auto_path = cfg.auto_path
        classic.auto_turn_percent = cfg.auto_turn_percent
        classic.auto_turn_speed_factor = cfg.auto_turn_speed_factor

    @staticmethod
    def _apply_gt(gt: Any, cfg: GTPathConfig) -> None:
        gt.turn_start_altitude = altitude_km_to_m(cfg.turn_start_altitude_km)
        gt.turn_start_velocity = cfg.turn_start_velocity_ms
        gt.turn_start_pitch = cfg.turn_start_pitch_deg
        gt.intermediate_altitude = altitude_km_to_m(cfg.intermediate_altitude_km)
        gt.hold_ap_time = cfg.hold_ap_time_s

    @staticmethod
    def _apply_pvg(pvg: Any, cfg: PVGPathConfig) -> None:
        peri_km = cfg.target_periapsis_km
        apo_km = cfg.target_apoapsis_km
        if apo_km <= 0 or apo_km <= peri_km:
            apo_m = 0.0
        else:
            apo_m = altitude_km_to_m(apo_km)

        pvg.desired_apoapsis = apo_m
        pvg.desired_attach_alt = altitude_km_to_m(cfg.attach_altitude_km)
        pvg.attach_alt_flag = cfg.attach_alt_enabled
        pvg.pitch_start_velocity = cfg.pitch_start_velocity_ms
        pvg.pitch_rate = cfg.pitch_rate_deg_per_s
        pvg.dynamic_pressure_trigger = pressure_kpa_to_pa(cfg.q_trigger_kpa)
        pvg.staging_trigger = cfg.pvg_after_stage
        pvg.staging_trigger_flag = cfg.pvg_after_stage_enabled
        pvg.fixed_coast = cfg.fixed_coast
        pvg.fixed_coast_length = cfg.fixed_coast_length_s

    def _require_mechjeb_target(self) -> None:
        space_center = self._game.space_center
        if space_center.target_body is None and space_center.target_vessel is None:
            raise MechJebNotReadyError(
                "No target selected. Lock a planet, moon, or vessel in Target Acquisition first."
            )
        try:
            if not bool(self._game.mechjeb.target_controller.normal_target_exists):
                raise MechJebNotReadyError(
                    "MechJeb has not synced the KSP target yet. Re-lock the target and try again."
                )
        except MechJebNotReadyError:
            raise
        except Exception as exc:
            raise MechJebNotReadyError(f"Cannot verify MechJeb target: {exc}") from exc

    def _ensure_can_start(self) -> None:
        if self._task is not None and not self._task.done():
            raise PhaseConflictError("Ascent is already running")
        if self._is_other_phase_running and self._is_other_phase_running():
            raise PhaseConflictError("Another flight phase is already running")

    async def launch_to_target_plane(
        self,
        config: AscentConfig | None = None,
        launch_lan_difference_deg: float | None = None,
    ) -> AscentStatus:
        self._ensure_can_start()

        self._abort_requested = False
        self._last_error = None
        self._game.require_flight()
        self._require_mechjeb_target()

        resolved = self._resolve_config(config)
        if launch_lan_difference_deg is not None:
            resolved = resolved.model_copy(
                update={"launch_lan_difference_deg": launch_lan_difference_deg}
            )
        self._config = resolved
        self._apply_config(resolved)

        ascent = self._game.mechjeb.ascent_autopilot
        self._engage_ascent_autopilot(ascent)
        ascent.launch_to_target_plane()

        self._state = PhaseState.running
        self._emit_status()
        self._task = asyncio.create_task(self._run())
        return self.get_status()

    async def start(self, config: AscentConfig | None = None) -> AscentStatus:
        self._ensure_can_start()

        self._abort_requested = False
        self._last_error = None

        self._game.require_flight()
        resolved = self._resolve_config(config)
        self._config = resolved
        self._apply_config(resolved)

        ascent = self._game.mechjeb.ascent_autopilot
        self._engage_ascent_autopilot(ascent)

        self._state = PhaseState.running
        self._emit_status()

        self._task = asyncio.create_task(self._run())
        return self.get_status()

    async def _run(self) -> None:
        try:
            while self._autopilot_engaged and not self._abort_requested:
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
                logger.exception("Ascent phase failed")
            self._last_error = str(exc)
            self._state = PhaseState.error
        finally:
            self._task = None
            self._emit_status()

    def abort(self) -> None:
        self._abort_requested = True
        try:
            ascent = self._game.mechjeb.ascent_autopilot
            launch_mode = str(ascent.launch_mode).lower()
            if "target_plane" in launch_mode or "rendezvous" in launch_mode:
                ascent.abort_timed_launch()
        except Exception:
            pass
        try:
            self._autopilot_engaged = set_ascent_autopilot_engaged(
                self._game, engaged=False, currently_engaged=self._autopilot_engaged
            )
        except Exception as exc:
            self._last_error = str(exc)
        if self._task is not None and not self._task.done():
            self._task.cancel()
        else:
            self._state = PhaseState.aborted
            self._emit_status()

    def get_status(self) -> AscentStatus:
        enabled = self._autopilot_engaged
        mj_status = ""
        launch_mode = "normal"
        live_path: AscentPath | None = None
        if self._game.is_connected():
            try:
                ascent = self._game.mechjeb.ascent_autopilot
                mj_status = str(ascent.status)
                launch_mode = str(ascent.launch_mode)
                live_path = INDEX_TO_ASCENT_PATH.get(int(ascent.ascent_path_index))
            except Exception:
                pass

        return AscentStatus(
            state=self._state,
            enabled=enabled,
            mj_status=mj_status,
            launch_mode=launch_mode,
            configured=self._config is not None,
            last_error=self._last_error,
            ascent_path=live_path or (self._config.ascent_path if self._config else None),
            desired_orbit_altitude_km=(
                self._config.desired_orbit_altitude_km if self._config else None
            ),
            desired_inclination_deg=(
                self._config.desired_inclination_deg if self._config else None
            ),
        )

    def _emit_status(self) -> None:
        if self._on_status_change:
            self._on_status_change(self.get_status())
