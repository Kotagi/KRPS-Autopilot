"""TCP client for KRPS in-game navball telemetry."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from backend.config import KRPS_ADDRESS, KRPS_PORT, KRPS_RECONNECT_INTERVAL_S
from backend.core.krps_debug import krps_navball_debugger
from backend.core.navball_attitude import navball_heading_deg
from backend.core.navball_streams import NavballStreamSnapshot

logger = logging.getLogger(__name__)


def parse_krps_payload(payload: dict[str, Any]) -> NavballStreamSnapshot | None:
    krps_navball_debugger.record_raw_payload(payload)
    try:
        rotation = tuple(float(v) for v in payload["surface_rotation"])
        prograde = tuple(float(v) for v in payload["prograde"])
        if len(rotation) != 4 or len(prograde) != 3:
            krps_navball_debugger.record_parse_failure("invalid_vector_length")
            return None

        heading = navball_heading_deg(float(payload["heading_deg"]))

        return NavballStreamSnapshot(
            pitch_deg=float(payload["pitch_deg"]),
            roll_deg=float(payload["roll_deg"]),
            heading_deg=heading,
            surface_rotation=rotation,
            prograde=prograde,
            surface_speed_ms=float(payload["surface_speed_ms"]),
            orbital_speed_ms=float(payload["orbital_speed_ms"]),
        )
    except (KeyError, TypeError, ValueError) as exc:
        krps_navball_debugger.record_parse_failure(str(exc))
        logger.warning("KRPS payload parse failed: %s | payload=%s", exc, payload)
        return None


class KrpsTelemetryClient:
    """Reads newline-delimited JSON telemetry frames from the KRPS KSP plugin."""

    def __init__(
        self,
        host: str = KRPS_ADDRESS,
        port: int = KRPS_PORT,
        reconnect_interval_s: float = KRPS_RECONNECT_INTERVAL_S,
    ) -> None:
        self._host = host
        self._port = port
        self._reconnect_interval_s = reconnect_interval_s
        self._latest: NavballStreamSnapshot | None = None
        self._connected = False
        self._reader_task: asyncio.Task[None] | None = None

    def is_connected(self) -> bool:
        return self._connected

    def get_snapshot(self) -> NavballStreamSnapshot | None:
        return self._latest

    def reset(self) -> None:
        self._latest = None
        self._connected = False

    def ensure_running(self) -> None:
        if self._reader_task is None or self._reader_task.done():
            self._reader_task = asyncio.create_task(self._reader_loop())

    async def stop(self) -> None:
        if self._reader_task is not None:
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass
            self._reader_task = None
        self.reset()

    async def _reader_loop(self) -> None:
        while True:
            try:
                reader, writer = await asyncio.open_connection(self._host, self._port)
                self._connected = True
                logger.info("KRPS telemetry connected to %s:%s", self._host, self._port)
                try:
                    while True:
                        line = await reader.readline()
                        if not line:
                            break
                        payload = json.loads(line.decode("utf-8"))
                        snapshot = parse_krps_payload(payload)
                        if snapshot is not None:
                            self._latest = snapshot
                finally:
                    writer.close()
                    try:
                        await writer.wait_closed()
                    except Exception:
                        pass
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.debug("KRPS telemetry connection failed: %s", exc)
            finally:
                self._connected = False
                self._latest = None
            await asyncio.sleep(self._reconnect_interval_s)


krps_client = KrpsTelemetryClient()
