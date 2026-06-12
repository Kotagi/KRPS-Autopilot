import asyncio
import logging
from typing import Any

from fastapi import WebSocket

from backend.config import TELEMETRY_FAST_INTERVAL_S, TELEMETRY_SLOW_INTERVAL_S
from backend.core.connection import GameConnection, game_connection
from backend.models.ascent import AscentStatus
from backend.models.maneuver import ManeuverStatus
from backend.models.connection import ConnectionStatus
from backend.models.events import WsEvent
from backend.models.target import TargetStatus
from backend.models.resources import StageFuelSnapshot
from backend.core.navball_attitude import compute_navball_heading, read_surface_rotation
from backend.core.json_utils import finite_or_none, sanitize_json_floats
from backend.models.flight_deck import VesselDeltaV, VesselTelemetry
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
        self._ascent_status_provider: Any = None
        self._maneuver_status_provider: Any = None

    def set_ascent_status_provider(self, provider: Any) -> None:
        self._ascent_status_provider = provider

    def set_maneuver_status_provider(self, provider: Any) -> None:
        self._maneuver_status_provider = provider

    async def connect_client(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._clients.add(websocket)
        if self._fast_task is None or self._fast_task.done():
            self._fast_task = asyncio.create_task(self._fast_broadcast_loop())
        if self._slow_task is None or self._slow_task.done():
            self._slow_task = asyncio.create_task(self._slow_broadcast_loop())

    def disconnect_client(self, websocket: WebSocket) -> None:
        self._clients.discard(websocket)
        if not self._clients:
            for task in (self._fast_task, self._slow_task):
                if task is not None:
                    task.cancel()
            self._fast_task = None
            self._slow_task = None

    async def broadcast(self, event_type: str, payload: dict[str, Any]) -> None:
        if not self._clients:
            return
        message = WsEvent(
            type=event_type,
            payload=sanitize_json_floats(payload),
        ).model_dump()
        dead: list[WebSocket] = []
        for client in self._clients:
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
        """High-rate attitude + controls for navball and vessel toggles."""
        try:
            while self._clients:
                if self._game.is_connected():
                    try:
                        telemetry = self._read_telemetry()
                        controls = self._vessel_service.get_controls()
                        await self.broadcast("telemetry", telemetry.model_dump())
                        await self.broadcast("vessel_controls", controls.model_dump())
                    except Exception as exc:
                        logger.debug("Fast telemetry snapshot failed: %s", exc)
                await asyncio.sleep(TELEMETRY_FAST_INTERVAL_S)
        except asyncio.CancelledError:
            pass

    async def _slow_broadcast_loop(self) -> None:
        """Lower-rate orbit resources and phase status."""
        try:
            while self._clients:
                await self._emit_slow_snapshot()
                await asyncio.sleep(TELEMETRY_SLOW_INTERVAL_S)
        except asyncio.CancelledError:
            pass

    async def _emit_slow_snapshot(self) -> None:
        await self.broadcast_connection()

        if not self._game.is_connected():
            return

        try:
            delta_v = self._read_delta_v()
            await self.broadcast("delta_v", delta_v.model_dump())
            stage_fuels = self._read_stage_fuels()
            await self.broadcast("stage_resources", stage_fuels.model_dump())
            if self._ascent_status_provider is not None:
                ascent = self._ascent_status_provider()
                await self.broadcast("ascent", ascent.model_dump())
            if self._maneuver_status_provider is not None:
                maneuver = self._maneuver_status_provider()
                await self.broadcast("maneuver", maneuver.model_dump())
            target = target_service.get_status()
            await self.broadcast("target", target.model_dump())
        except Exception as exc:
            logger.debug("Slow telemetry snapshot failed: %s", exc)

    def _read_stage_fuels(self) -> StageFuelSnapshot:
        return resource_service.get_stage_fuels()

    def _read_delta_v(self) -> VesselDeltaV:
        vessel = self._game.active_vessel()
        return VesselDeltaV(**read_vessel_delta_v(vessel))

    def _read_telemetry(self) -> VesselTelemetry:
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

        prograde = (0.0, 0.0, 1.0)
        try:
            prograde = tuple(float(v) for v in flight.prograde)
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
            pitch_deg=float(flight.pitch),
            heading_deg=compute_navball_heading(vessel),
            roll_deg=float(flight.roll),
            surface_rotation=read_surface_rotation(vessel),
            angle_of_attack_deg=float(flight.angle_of_attack),
            sideslip_angle_deg=float(flight.sideslip_angle),
            dynamic_pressure_pa=float(flight.dynamic_pressure),
            mach=float(flight.mach),
            g_force=float(flight.g_force),
            time_to_apoapsis_s=time_to_ap,
            time_to_periapsis_s=time_to_pe,
            time_to_soi_s=time_to_soi,
            prograde=prograde,
            maneuver_node_count=node_count,
            next_node_time_to_s=next_node_time,
        )


telemetry_service = TelemetryService()
