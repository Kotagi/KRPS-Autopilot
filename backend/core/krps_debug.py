"""Periodic KRPS vs kRPC navball comparison logging."""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any

from backend.core.navball_attitude import heading_from_surface_rotation
from backend.core.navball_streams import NavballStreamSnapshot

logger = logging.getLogger(__name__)


def _finite(value: float) -> bool:
    return math.isfinite(value)


def _fmt_quat(q: tuple[float, float, float, float]) -> str:
    return f"({q[0]:.4f}, {q[1]:.4f}, {q[2]:.4f}, {q[3]:.4f})"


def _heading_from_rotation(rotation: tuple[float, float, float, float]) -> float:
    return heading_from_surface_rotation(rotation)


@dataclass
class KrpsDebugSnapshot:
    seq: int | None = None
    raw_heading_deg: float | None = None
    raw_pitch_deg: float | None = None
    raw_roll_deg: float | None = None
    surface_rotation: tuple[float, float, float, float] | None = None
    heading_from_quat_deg: float | None = None
    debug_heading_nose_deg: float | None = None
    debug_heading_bottom_deg: float | None = None
    debug_ksp_heading_deg: float | None = None
    parse_ok: bool = False
    parse_error: str | None = None


@dataclass
class KrpsCompareReport:
    timestamp_ms: int
    krps_connected: bool
    krpc_connected: bool
    active_source: str
    krps: KrpsDebugSnapshot = field(default_factory=KrpsDebugSnapshot)
    krpc: dict[str, Any] = field(default_factory=dict)
    deltas: dict[str, float | None] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


class KrpsNavballDebugger:
    def __init__(self, log_interval_s: float = 5.0) -> None:
        self.log_interval_s = log_interval_s
        self._last_log_at = 0.0
        self._last_raw: dict[str, Any] | None = None
        self._last_report: KrpsCompareReport | None = None
        self._frames = 0
        self._parse_failures = 0

    def record_raw_payload(self, payload: dict[str, Any]) -> None:
        self._last_raw = payload
        self._frames += 1

    def record_parse_failure(self, reason: str) -> None:
        self._parse_failures += 1
        logger.warning("[krps-debug] parse failure: %s | raw=%s", reason, self._last_raw)

    def build_report(
        self,
        *,
        active_source: str,
        krps_connected: bool,
        krpc_connected: bool,
        krps_snapshot: NavballStreamSnapshot | None,
        krpc_snapshot: NavballStreamSnapshot | None,
    ) -> KrpsCompareReport:
        raw = self._last_raw or {}
        krps_debug = KrpsDebugSnapshot(
            seq=int(raw["seq"]) if isinstance(raw.get("seq"), (int, float)) else None,
            raw_heading_deg=_maybe_float(raw.get("heading_deg")),
            raw_pitch_deg=_maybe_float(raw.get("pitch_deg")),
            raw_roll_deg=_maybe_float(raw.get("roll_deg")),
            parse_ok=krps_snapshot is not None,
        )

        if krps_snapshot is not None:
            krps_debug.surface_rotation = krps_snapshot.surface_rotation
            krps_debug.heading_from_quat_deg = _heading_from_rotation(
                krps_snapshot.surface_rotation
            )
        krps_debug.debug_heading_nose_deg = _maybe_float(raw.get("debug_heading_nose_deg"))
        krps_debug.debug_heading_bottom_deg = _maybe_float(raw.get("debug_heading_bottom_deg"))
        krps_debug.debug_ksp_heading_deg = _maybe_float(raw.get("debug_ksp_heading_deg"))

        warnings: list[str] = []
        if krps_snapshot is None:
            warnings.append("krps_snapshot_missing")
        elif krps_debug.raw_heading_deg is not None and not _finite(krps_debug.raw_heading_deg):
            warnings.append("krps_heading_not_finite")
        elif krps_debug.heading_from_quat_deg is not None and not _finite(
            krps_debug.heading_from_quat_deg
        ):
            warnings.append("krps_heading_from_quat_not_finite")

        if (
            krps_debug.raw_heading_deg is not None
            and krps_debug.heading_from_quat_deg is not None
            and _finite(krps_debug.raw_heading_deg)
            and _finite(krps_debug.heading_from_quat_deg)
            and abs(krps_debug.raw_heading_deg - krps_debug.heading_from_quat_deg) > 15.0
        ):
            warnings.append("krps_heading_raw_vs_quat_mismatch")

        krpc_data: dict[str, Any] = {}
        deltas: dict[str, float | None] = {}
        if krpc_snapshot is not None:
            krpc_hdg_from_quat = _heading_from_rotation(krpc_snapshot.surface_rotation)
            krpc_data = {
                "pitch_deg": krpc_snapshot.pitch_deg,
                "roll_deg": krpc_snapshot.roll_deg,
                "heading_deg": krpc_snapshot.heading_deg,
                "heading_from_quat_deg": krpc_hdg_from_quat,
                "surface_rotation": krpc_snapshot.surface_rotation,
            }
            if krps_snapshot is not None:
                deltas = {
                    "pitch_deg": krps_snapshot.pitch_deg - krpc_snapshot.pitch_deg,
                    "roll_deg": krps_snapshot.roll_deg - krpc_snapshot.roll_deg,
                    "heading_deg": _angle_delta(
                        krps_snapshot.heading_deg, krpc_snapshot.heading_deg
                    ),
                    "heading_from_quat_deg": _angle_delta(
                        krps_debug.heading_from_quat_deg or 0.0,
                        krpc_hdg_from_quat,
                    ),
                }
                for key, delta in deltas.items():
                    if delta is not None and abs(delta) > 5.0:
                        warnings.append(f"delta_{key}_{delta:.1f}")

        report = KrpsCompareReport(
            timestamp_ms=int(time.time() * 1000),
            krps_connected=krps_connected,
            krpc_connected=krpc_connected,
            active_source=active_source,
            krps=krps_debug,
            krpc=krpc_data,
            deltas=deltas,
            warnings=warnings,
        )
        self._last_report = report
        self._maybe_log(report)
        return report

    def get_last_report(self) -> KrpsCompareReport | None:
        return self._last_report

    def _maybe_log(self, report: KrpsCompareReport) -> None:
        now = time.monotonic()
        if now - self._last_log_at < self.log_interval_s:
            return
        self._last_log_at = now

        krps = report.krps
        logger.info(
            "[krps-debug] source=%s | krps=%s krpc=%s | frames=%d parse_fail=%d | "
            "krps raw hdg=%s pitch=%s roll=%s | krps quat_hdg=%s | krps quat=%s | "
            "krpc hdg=%s quat_hdg=%s | deltas=%s | warn=%s",
            report.active_source,
            report.krps_connected,
            report.krpc_connected,
            self._frames,
            self._parse_failures,
            _fmt(krps.raw_heading_deg),
            _fmt(krps.raw_pitch_deg),
            _fmt(krps.raw_roll_deg),
            _fmt(krps.heading_from_quat_deg),
            _fmt_quat(krps.surface_rotation) if krps.surface_rotation else "none",
            _fmt(report.krpc.get("heading_deg")),
            _fmt(report.krpc.get("heading_from_quat_deg")),
            report.deltas or "none",
            ",".join(report.warnings) or "none",
        )
        if krps.debug_heading_bottom_deg is not None or krps.debug_ksp_heading_deg is not None:
            logger.info(
                "[krps-debug] plugin headings nose=%s bottom=%s ksp=%s",
                _fmt(krps.debug_heading_nose_deg),
                _fmt(krps.debug_heading_bottom_deg),
                _fmt(krps.debug_ksp_heading_deg),
            )
        self._frames = 0
        self._parse_failures = 0


def _maybe_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        parsed = float(value)
        return parsed if _finite(parsed) else None
    except (TypeError, ValueError):
        return None


def _fmt(value: Any) -> str:
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def _angle_delta(a: float, b: float) -> float:
    delta = (a - b + 180.0) % 360.0 - 180.0
    return delta


krps_navball_debugger = KrpsNavballDebugger()
