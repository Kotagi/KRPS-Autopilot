import asyncio
import logging
import time
from typing import Any

from fastapi import WebSocket

from backend.config import (
    CONTROLS_POLL_EVERY_N_FAST_TICKS,
    TELEMETRY_DEBUG_LOG_INTERVAL_S,
    TELEMETRY_FAST_INTERVAL_S,
    TELEMETRY_SLOW_INTERVAL_S,
)
from backend.core.connection import GameConnection, game_connection
from backend.core.delta_v import read_vessel_delta_v
from backend.core.json_utils import finite_or_none, sanitize_json_floats
from backend.core.krps_client import krps_client
from backend.core.krps_debug import krps_navball_debugger
from backend.core.navball_streams import NavballStreamManager, NavballStreamSnapshot
from backend.core.telemetry_debug import TelemetryLoopProfiler
from backend.models.ascent import AscentStatus
from backend.models.connection import ConnectionStatus
from backend.models.events import WsEvent
from backend.models.flight_deck import VesselDeltaV, VesselTelemetry
from backend.models.maneuver import ManeuverStatus
from backend.models.navball import NavballSource, NavballSourceStatus
from backend.models.resources import StageFuelSnapshot
from backend.models.target import TargetStatus
from backend.models.vessel import VesselControlsState
from backend.services.game_service import GameService
from backend.services.resource_service import resource_service
from backend.services.target_service import target_service
from backend.services.vessel_service import VesselService

logger = logging.getLogger(__name__)


class TelemetryService:
    def __init__(self, game: GameConnection = game_connection) -> None:
        self._game = game
        self._clients: set[WebSocket] = set()
        self._fast_task: asyncio.Task[None] | None = None
        self._slow_task: asyncio.Task[None] | None = None
        self._game_service = GameService(game)
        self._vessel_service = VesselService(game)
        self._navball_streams = NavballStreamManager(game)
        self._cached_slow: VesselTelemetry | None = None
        self._slow_cache_task: asyncio.Task[None] | None = None
        self._fast_tick = 0
        self._last_controls: VesselControlsState | None = None
        self._fast_profiler = TelemetryLoopProfiler(
            "fast-telemetry",
            log_interval_s=TELEMETRY_DEBUG_LOG_INTERVAL_S,
        )
        self._slow_profiler = TelemetryLoopProfiler(
            "slow-telemetry",
            log_interval_s=TELEMETRY_DEBUG_LOG_INTERVAL_S,
        )
        self._ascent_status_provider: Any = None
        self._maneuver_status_provider: Any = None
        self._krpc_was_connected = False
        self._last_broadcast_navball: NavballStreamSnapshot | None = None
        self._telemetry_seq = 0
        self._slow_cache_generation = 0
        self._last_broadcast_slow_generation = -1
        self._navball_source: NavballSource = "krpc"
        self._krps = krps_client

    def set_ascent_status_provider(self, provider: Any) -> None:
        self._ascent_status_provider = provider

    def set_maneuver_status_provider(self, provider: Any) -> None:
        self._maneuver_status_provider = provider

    def reset_navball_streams(self) -> None:
        """Drop only kRPC stream subscriptions; keep cached orbit snapshot."""
        self._fast_profiler.record_event("reset navball streams")
        self._navball_streams.reset()
        self._fast_tick = 0

    def reset_telemetry_state(self) -> None:
        """Full telemetry reset on disconnect."""
        self.reset_navball_streams()
        self._cached_slow = None
        self._slow_cache_task = None
        self._last_controls = None
        self._krpc_was_connected = False
        self._last_broadcast_navball = None
        self._telemetry_seq = 0
        self._last_broadcast_slow_generation = -1

    def _on_krpc_disconnected(self) -> None:
        if self._krpc_was_connected:
            self._fast_profiler.record_event("krpc disconnected — resetting telemetry state")
            self.reset_telemetry_state()
        self._krpc_was_connected = False

    def _on_krpc_connected(self) -> None:
        self._krpc_was_connected = True

    def get_navball_source_status(self) -> NavballSourceStatus:
        return NavballSourceStatus(
            source=self._navball_source,
            krps_connected=self._krps.is_connected(),
            krpc_connected=self._game.is_connected(),
        )

    async def set_navball_source(self, source: NavballSource) -> NavballSourceStatus:
        self._navball_source = source
        self._last_broadcast_navball = None
        if source == "krps":
            self._krps.ensure_running()
        else:
            self.reset_navball_streams()
        await self.broadcast_navball_source()
        return self.get_navball_source_status()

    async def broadcast_navball_source(self) -> None:
        await self.broadcast("navball_source", self.get_navball_source_status().model_dump())

    def get_krps_debug_report(self) -> dict[str, Any]:
        report = krps_navball_debugger.get_last_report()
        if report is None:
            return {
                "timestamp_ms": int(time.time() * 1000),
                "krps_connected": self._krps.is_connected(),
                "krpc_connected": self._game.is_connected(),
                "active_source": self._navball_source,
                "warnings": ["no_report_yet"],
            }
        return {
            "timestamp_ms": report.timestamp_ms,
            "krps_connected": report.krps_connected,
            "krpc_connected": report.krpc_connected,
            "active_source": report.active_source,
            "krps": {
                "seq": report.krps.seq,
                "raw_heading_deg": report.krps.raw_heading_deg,
                "raw_pitch_deg": report.krps.raw_pitch_deg,
                "raw_roll_deg": report.krps.raw_roll_deg,
                "heading_from_quat_deg": report.krps.heading_from_quat_deg,
                "debug_heading_nose_deg": report.krps.debug_heading_nose_deg,
                "debug_heading_bottom_deg": report.krps.debug_heading_bottom_deg,
                "debug_ksp_heading_deg": report.krps.debug_ksp_heading_deg,
                "surface_rotation": report.krps.surface_rotation,
                "parse_ok": report.krps.parse_ok,
            },
            "krpc": report.krpc,
            "deltas": report.deltas,
            "warnings": report.warnings,
        }

    async def _record_krps_debug(self, navball: NavballStreamSnapshot | None) -> None:
        if not self._krps.is_connected() and self._navball_source != "krps":
            return
        krpc_snapshot = None
        if self._game.is_connected():
            krpc_snapshot = await asyncio.to_thread(self._navball_streams.read_snapshot)
        krps_navball_debugger.build_report(
            active_source=self._navball_source,
            krps_connected=self._krps.is_connected(),
            krpc_connected=self._game.is_connected(),
            krps_snapshot=self._krps.get_snapshot(),
            krpc_snapshot=krpc_snapshot,
        )

    async def connect_client(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)
        self._krps.ensure_running()
        if self._fast_task is None or self._fast_task.done():
            self._fast_task = asyncio.create_task(self._fast_broadcast_loop())
        if self._slow_task is None or self._slow_task.done():
            self._slow_task = asyncio.create_task(self._slow_broadcast_loop())
        await self.broadcast_navball_source()

    def disconnect_client(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)
        if not self._clients:
            for task in (self._fast_task, self._slow_task):
                if task is not None:
                    task.cancel()
            self._fast_task = None
            self._slow_task = None
            self.reset_telemetry_state()

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        if not self._clients:
            return
        message = WsEvent(
            type=event_type,
            payload=sanitize_json_floats(payload),
        ).model_dump()
        dead: list[WebSocket] = []
        for client in list(self._clients):
            try:
                await client.send_json(message)
            except Exception:
                dead.append(client)
        for client in dead:
            self._clients.discard(client)

    async def broadcast_connection(self) -> None:
        status = self._game_service.get_status()
        await self.broadcast("connection", status.model_dump())

    async def broadcast_ascent(self, status: AscentStatus) -> None:
        await self.broadcast("ascent", status.model_dump())

    async def broadcast_maneuver(self, status: ManeuverStatus) -> None:
        await self.broadcast("maneuver", status.model_dump())

    async def broadcast_target(self, status: TargetStatus) -> None:
        await self.broadcast("target", status.model_dump())

    async def broadcast_error(self, message: str, source: str) -> None:
        await self.broadcast("error", {"message": message, "source": source})

    async def _fast_broadcast_loop(self) -> None:
        """Read cached kRPC stream values and broadcast without blocking for updates."""
        loop = asyncio.get_event_loop()
        self._fast_profiler.record_event("fast loop started")
        try:
            while self._clients:
                tick_start = loop.time()
                has_krpc = self._game.is_connected()
                if has_krpc:
                    self._on_krpc_connected()
                else:
                    self._fast_profiler.record_skip("krpc_disconnected")
                    self._on_krpc_disconnected()

                if self._navball_source == "krpc" and not has_krpc:
                    await asyncio.sleep(TELEMETRY_FAST_INTERVAL_S)
                    continue

                if self._navball_source == "krps":
                    self._krps.ensure_running()
                    if not self._krps.is_connected():
                        self._fast_profiler.record_skip("krps_disconnected")

                try:
                    if has_krpc:
                        self._schedule_slow_cache_load()

                    read_start = time.perf_counter()
                    navball, controls = await self._read_fast_bundle()
                    self._fast_profiler.record_phase(
                        "read_fast_bundle",
                        (time.perf_counter() - read_start) * 1000,
                    )

                    if navball is None:
                        self._fast_profiler.record_skip("navball_read_failed")
                        await asyncio.sleep(TELEMETRY_FAST_INTERVAL_S)
                        continue

                    await self._record_krps_debug(navball)

                    telemetry = self._build_fast_telemetry(navball)
                    if controls is not None:
                        self._last_controls = controls

                    slow_changed = (
                        self._last_broadcast_slow_generation != self._slow_cache_generation
                    )
                    navball_changed = (
                        self._last_broadcast_navball is None
                        or not self._navball_snapshots_equal(
                            self._last_broadcast_navball, navball
                        )
                    )
                    if not navball_changed and not slow_changed:
                        self._fast_profiler.record_skip("unchanged_attitude")
                        elapsed = loop.time() - tick_start
                        sleep_s = max(0.0, TELEMETRY_FAST_INTERVAL_S - elapsed)
                        if sleep_s > 0:
                            await asyncio.sleep(sleep_s)
                        continue

                    self._last_broadcast_navball = navball
                    self._last_broadcast_slow_generation = self._slow_cache_generation

                    broadcast_start = time.perf_counter()
                    if self._last_controls is not None:
                        await self.broadcast("vessel_controls", self._last_controls.model_dump())
                    self._telemetry_seq += 1
                    telemetry_payload = telemetry.model_dump()
                    telemetry_payload["server_ts_ms"] = int(time.time() * 1000)
                    telemetry_payload["server_ts"] = telemetry_payload["server_ts_ms"] / 1000.0
                    telemetry_payload["server_seq"] = self._telemetry_seq
                    telemetry_payload["navball_source"] = self._navball_source
                    await self.broadcast("telemetry", telemetry_payload)
                    self._fast_profiler.record_phase(
                        "broadcast",
                        (time.perf_counter() - broadcast_start) * 1000,
                    )
                    self._fast_profiler.record_broadcast()
                except Exception as exc:
                    self._fast_profiler.record_skip("fast_loop_exception")
                    logger.warning("Fast telemetry snapshot failed: %s", exc, exc_info=True)
                    if self._navball_source == "krpc":
                        self.reset_navball_streams()

                elapsed = loop.time() - tick_start
                sleep_s = max(0.0, TELEMETRY_FAST_INTERVAL_S - elapsed)
                if sleep_s > 0:
                    self._fast_profiler.record_phase("sleep", sleep_s * 1000)
                    await asyncio.sleep(sleep_s)
        except asyncio.CancelledError:
            self._fast_profiler.record_event("fast loop stopped")
            pass

    def _navball_snapshots_equal(
        self,
        left: NavballStreamSnapshot,
        right: NavballStreamSnapshot,
        eps: float = 1e-4,
    ) -> bool:
        if (
            abs(left.pitch_deg - right.pitch_deg) > 0.01
            or abs(left.roll_deg - right.roll_deg) > 0.01
            or abs(left.heading_deg - right.heading_deg) > 0.01
            or abs(left.surface_speed_ms - right.surface_speed_ms) > 0.05
            or abs(left.orbital_speed_ms - right.orbital_speed_ms) > 0.05
        ):
            return False
        for a, b in zip(left.surface_rotation, right.surface_rotation, strict=True):
            if abs(a - b) > eps:
                return False
        for a, b in zip(left.prograde, right.prograde, strict=True):
            if abs(a - b) > eps:
                return False
        return True

    def _build_fast_telemetry(self, navball: NavballStreamSnapshot) -> VesselTelemetry:
        if self._cached_slow is None:
            self._fast_profiler.record_skip("slow_cache_missing_using_navball_only")
            return self._telemetry_from_navball(navball)
        return self._merge_navball(self._cached_slow, navball)

    def _telemetry_from_navball(self, navball: NavballStreamSnapshot) -> VesselTelemetry:
        return VesselTelemetry(
            vessel_name="—",
            situation="—",
            altitude_m=0.0,
            apoapsis_m=0.0,
            periapsis_m=0.0,
            pitch_deg=navball.pitch_deg,
            heading_deg=navball.heading_deg,
            roll_deg=navball.roll_deg,
            surface_rotation=navball.surface_rotation,
            prograde=navball.prograde,
            surface_speed_ms=navball.surface_speed_ms,
            orbital_speed_ms=navball.orbital_speed_ms,
        )

    def _schedule_slow_cache_load(self) -> None:
        if self._cached_slow is not None:
            return
        if self._slow_cache_task is not None and not self._slow_cache_task.done():
            return
        self._slow_cache_task = asyncio.create_task(self._load_slow_cache())

    async def _load_slow_cache(self) -> None:
        started = time.perf_counter()
        try:
            if self._game.is_connected():
                self._cached_slow = await asyncio.to_thread(self._read_slow_telemetry)
                self._slow_cache_generation += 1
                elapsed_ms = (time.perf_counter() - started) * 1000
                self._fast_profiler.record_phase("slow_cache_load", elapsed_ms)
                self._fast_profiler.record_event(
                    f"slow cache loaded in {elapsed_ms:.1f} ms"
                )
        except Exception as exc:
            self._fast_profiler.record_skip("slow_cache_load_failed")
            logger.warning("Slow cache preload failed: %s", exc, exc_info=True)

    async def _read_fast_bundle(
        self,
    ) -> tuple[NavballStreamSnapshot | None, VesselControlsState | None]:
        """Read navball from KRPS or kRPC plus occasional kRPC controls."""
        if self._navball_source == "krps":
            navball = self._krps.get_snapshot()
            controls = None
            if self._game.is_connected():
                controls = await asyncio.to_thread(
                    lambda: self._game.run_sync(self._read_controls_if_needed)
                )
            return navball, controls
        return await asyncio.to_thread(self._read_krpc_fast_bundle)

    def _read_krpc_fast_bundle(
        self,
    ) -> tuple[NavballStreamSnapshot | None, VesselControlsState | None]:
        def _locked() -> tuple[NavballStreamSnapshot | None, VesselControlsState | None]:
            self._fast_tick += 1
            navball = self._navball_streams._read_snapshot_locked()
            if navball is None:
                return None, None
            poll_controls = (
                self._last_controls is None
                or self._fast_tick % CONTROLS_POLL_EVERY_N_FAST_TICKS == 0
            )
            controls = (
                self._vessel_service._read_controls() if poll_controls else None
            )
            return navball, controls

        return self._game.run_sync(_locked)

    def _read_controls_if_needed(self) -> VesselControlsState | None:
        if not self._game.is_connected():
            return None
        self._fast_tick += 1
        poll_controls = (
            self._last_controls is None
            or self._fast_tick % CONTROLS_POLL_EVERY_N_FAST_TICKS == 0
        )
        if not poll_controls:
            return None
        return self._vessel_service._read_controls()

    async def _slow_broadcast_loop(self) -> None:
        """Lower-rate orbit resources and phase status."""
        try:
            while self._clients:
                await self._emit_slow_snapshot()
                await asyncio.sleep(TELEMETRY_SLOW_INTERVAL_S)
        except asyncio.CancelledError:
            pass

    async def _emit_slow_snapshot(self) -> None:
        started = time.perf_counter()
        await self.broadcast_connection()

        if not self._game.is_connected():
            self._on_krpc_disconnected()
            return

        try:
            slow_read_start = time.perf_counter()
            self._cached_slow = await asyncio.to_thread(self._read_slow_telemetry)
            self._slow_cache_generation += 1
            self._slow_profiler.record_phase(
                "read_slow_telemetry",
                (time.perf_counter() - slow_read_start) * 1000,
            )

            delta_v_start = time.perf_counter()
            delta_v = await asyncio.to_thread(self._read_delta_v)
            self._slow_profiler.record_phase(
                "read_delta_v",
                (time.perf_counter() - delta_v_start) * 1000,
            )
            await self.broadcast("delta_v", delta_v.model_dump())

            fuels_start = time.perf_counter()
            stage_fuels = await asyncio.to_thread(self._read_stage_fuels)
            self._slow_profiler.record_phase(
                "read_stage_fuels",
                (time.perf_counter() - fuels_start) * 1000,
            )
            await self.broadcast("stage_resources", stage_fuels.model_dump())
            if self._ascent_status_provider is not None:
                ascent = self._ascent_status_provider()
                await self.broadcast("ascent", ascent.model_dump())
            if self._maneuver_status_provider is not None:
                maneuver = self._maneuver_status_provider()
                await self.broadcast("maneuver", maneuver.model_dump())
            target = target_service.get_status()
            await self.broadcast("target", target.model_dump())
            self._slow_profiler.record_broadcast()
        except Exception as exc:
            self._slow_profiler.record_skip("slow_snapshot_exception")
            logger.warning("Slow telemetry snapshot failed: %s", exc, exc_info=True)
        finally:
            self._slow_profiler.record_phase(
                "slow_snapshot_total",
                (time.perf_counter() - started) * 1000,
            )

    def _merge_navball(
        self,
        base: VesselTelemetry,
        navball: NavballStreamSnapshot,
    ) -> VesselTelemetry:
        return base.model_copy(
            update={
                "pitch_deg": navball.pitch_deg,
                "roll_deg": navball.roll_deg,
                "heading_deg": navball.heading_deg,
                "surface_rotation": navball.surface_rotation,
                "prograde": navball.prograde,
                "surface_speed_ms": navball.surface_speed_ms,
                "orbital_speed_ms": navball.orbital_speed_ms,
            }
        )

    def _read_stage_fuels(self) -> StageFuelSnapshot:
        return resource_service.get_stage_fuels()

    def _read_delta_v(self) -> VesselDeltaV:
        vessel = self._game.active_vessel()
        return VesselDeltaV(**read_vessel_delta_v(vessel, self._game))

    def _read_slow_telemetry(self) -> VesselTelemetry:
        """Orbit and environment fields polled at low rate (not streamed)."""
        vessel = self._game.active_vessel()
        flight = vessel.flight()
        orbit = vessel.orbit

        time_to_ap: float | None = None
        time_to_pe: float | None = None
        time_to_soi: float | None = None
        try:
            time_to_ap = finite_or_none(float(orbit.time_to_apoapsis))
        except Exception:
            pass
        try:
            time_to_pe = finite_or_none(float(orbit.time_to_periapsis))
        except Exception:
            pass
        try:
            time_to_soi = finite_or_none(float(orbit.time_to_soi_change))
        except Exception:
            pass

        node_count = 0
        next_node_time: float | None = None
        try:
            nodes = vessel.control.nodes
            node_count = len(nodes)
            if node_count > 0:
                next_node_time = finite_or_none(float(nodes[0].time_to))
        except Exception:
            pass

        orbit_body: str | None = None
        try:
            orbit_body = str(orbit.body.name)
        except Exception:
            pass

        return VesselTelemetry(
            vessel_name=str(vessel.name),
            situation=(
                vessel.situation.name
                if hasattr(vessel.situation, "name")
                else str(vessel.situation)
            ),
            orbit_body=orbit_body,
            altitude_m=float(flight.mean_altitude),
            surface_altitude_m=float(flight.surface_altitude),
            apoapsis_m=float(orbit.apoapsis_altitude),
            periapsis_m=float(orbit.periapsis_altitude),
            inclination_deg=float(orbit.inclination),
            eccentricity=float(orbit.eccentricity),
            orbital_speed_ms=float(flight.speed),
            surface_speed_ms=float(flight.horizontal_speed),
            vertical_speed_ms=float(flight.vertical_speed),
            pitch_deg=0.0,
            heading_deg=0.0,
            roll_deg=0.0,
            surface_rotation=(0.0, 0.0, 0.0, 1.0),
            angle_of_attack_deg=float(flight.angle_of_attack),
            sideslip_angle_deg=float(flight.sideslip_angle),
            dynamic_pressure_pa=float(flight.dynamic_pressure),
            mach=float(flight.mach),
            g_force=float(flight.g_force),
            time_to_apoapsis_s=time_to_ap,
            time_to_periapsis_s=time_to_pe,
            time_to_soi_s=time_to_soi,
            prograde=(0.0, 0.0, 1.0),
            maneuver_node_count=node_count,
            next_node_time_to_s=next_node_time,
        )


telemetry_service = TelemetryService()
