"""kRPC stream bundle for high-rate navball attitude telemetry."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Any

from backend.config import NAVBALL_STREAM_RATE, TELEMETRY_DEBUG_SLOW_PHASE_MS
from backend.core.connection import GameConnection
from backend.core.navball_attitude import navball_heading_deg

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class NavballStreamSnapshot:
    pitch_deg: float
    roll_deg: float
    heading_deg: float
    surface_rotation: tuple[float, float, float, float]
    prograde: tuple[float, float, float]
    surface_speed_ms: float
    orbital_speed_ms: float


class NavballStreamManager:
    """Streams navball fields from KSP; reads cached stream values without blocking."""

    def __init__(self, game: GameConnection, rate: float = NAVBALL_STREAM_RATE) -> None:
        self._game = game
        self._rate = rate
        self._vessel_key: int | None = None
        self._stream_refs: list[Any] = []
        self._pitch: Any | None = None
        self._roll: Any | None = None
        self._horizontal_speed: Any | None = None
        self._speed: Any | None = None
        self._prograde: Any | None = None
        self._rotation: Any | None = None
        self._heading_fallback: Any | None = None

    def reset(self) -> None:
        self._game.run_sync(self._reset_locked)

    def read_snapshot(self) -> NavballStreamSnapshot | None:
        """Read the latest cached stream values (non-blocking on the client)."""
        return self._game.run_sync(self._read_snapshot_locked)

    def _reset_locked(self) -> None:
        count = len(self._stream_refs)
        for stream in self._stream_refs:
            try:
                stream.remove()
            except Exception:
                pass
        self._stream_refs.clear()
        self._vessel_key = None
        self._pitch = None
        self._roll = None
        self._horizontal_speed = None
        self._speed = None
        self._prograde = None
        self._rotation = None
        self._heading_fallback = None
        if count:
            logger.info("navball streams removed (%d)", count)

    def _ensure_streams_locked(self, vessel: Any) -> None:
        vessel_key = int(vessel._object_id)
        if self._vessel_key == vessel_key and self._stream_refs:
            return

        setup_start = time.perf_counter()
        self._reset_locked()
        conn = self._game.conn
        surface_frame = vessel.surface_reference_frame
        flight = vessel.flight(surface_frame)

        self._pitch = conn.add_stream(getattr, flight, "pitch")
        self._roll = conn.add_stream(getattr, flight, "roll")
        self._horizontal_speed = conn.add_stream(getattr, flight, "horizontal_speed")
        self._speed = conn.add_stream(getattr, flight, "speed")
        vessel_flight = vessel.flight(vessel.reference_frame)
        self._prograde = conn.add_stream(getattr, vessel_flight, "prograde")
        self._rotation = conn.add_stream(vessel.rotation, surface_frame)
        self._heading_fallback = conn.add_stream(getattr, flight, "heading")

        self._stream_refs = [
            self._pitch,
            self._roll,
            self._horizontal_speed,
            self._speed,
            self._prograde,
            self._rotation,
            self._heading_fallback,
        ]
        for stream in self._stream_refs:
            stream.rate = self._rate
        self._vessel_key = vessel_key
        logger.info(
            "navball streams created for vessel %s (%d streams @ %.0f Hz) in %.1f ms",
            vessel_key,
            len(self._stream_refs),
            self._rate,
            (time.perf_counter() - setup_start) * 1000,
        )

    def _read_snapshot_locked(self) -> NavballStreamSnapshot | None:
        if not self._game.is_connected():
            self._reset_locked()
            return None

        read_start = time.perf_counter()
        try:
            vessel = self._game.active_vessel()
            self._ensure_streams_locked(vessel)

            pitch_deg = float(self._pitch())
            roll_deg = float(self._roll())
            flight_heading = float(self._heading_fallback())
            rotation = tuple(float(v) for v in self._rotation())
            prograde_raw = self._prograde()
            prograde = tuple(float(v) for v in prograde_raw)

            elapsed_ms = (time.perf_counter() - read_start) * 1000
            if elapsed_ms >= TELEMETRY_DEBUG_SLOW_PHASE_MS:
                logger.warning("navball stream read slow: %.1f ms", elapsed_ms)

            return NavballStreamSnapshot(
                pitch_deg=pitch_deg,
                roll_deg=roll_deg,
                heading_deg=navball_heading_deg(flight_heading),
                surface_rotation=rotation,
                prograde=prograde,
                surface_speed_ms=float(self._horizontal_speed()),
                orbital_speed_ms=float(self._speed()),
            )
        except Exception as exc:
            logger.warning(
                "navball stream read failed after %.1f ms: %s",
                (time.perf_counter() - read_start) * 1000,
                exc,
                exc_info=True,
            )
            self._reset_locked()
            return None
