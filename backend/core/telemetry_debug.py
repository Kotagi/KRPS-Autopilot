"""Timing counters and periodic summaries for navball telemetry debugging."""

from __future__ import annotations

import logging
import time
from collections import defaultdict

from backend.config import TELEMETRY_DEBUG_SLOW_PHASE_MS

logger = logging.getLogger(__name__)


class TelemetryLoopProfiler:
    """Aggregate fast-loop timings and emit a summary every N seconds."""

    def __init__(self, name: str, log_interval_s: float = 5.0) -> None:
        self.name = name
        self.log_interval_s = log_interval_s
        self._started_at = time.monotonic()
        self._last_log_at = self._started_at
        self._broadcasts = 0
        self._skips: dict[str, int] = defaultdict(int)
        self._phase_total_ms: dict[str, float] = defaultdict(float)
        self._phase_count: dict[str, int] = defaultdict(int)
        self._phase_max_ms: dict[str, float] = defaultdict(float)
        self._warnings = 0

    def record_skip(self, reason: str) -> None:
        self._skips[reason] += 1
        self.maybe_log_summary()

    def record_broadcast(self) -> None:
        self._broadcasts += 1
        self.maybe_log_summary()

    def record_phase(self, phase: str, duration_ms: float) -> None:
        self._phase_total_ms[phase] += duration_ms
        self._phase_count[phase] += 1
        if duration_ms > self._phase_max_ms[phase]:
            self._phase_max_ms[phase] = duration_ms
        if duration_ms >= TELEMETRY_DEBUG_SLOW_PHASE_MS:
            self._warnings += 1
            logger.warning(
                "[%s] slow phase %s took %.1f ms",
                self.name,
                phase,
                duration_ms,
            )
        self.maybe_log_summary()

    def record_event(self, message: str) -> None:
        logger.info("[%s] %s", self.name, message)

    def maybe_log_summary(self) -> None:
        now = time.monotonic()
        if now - self._last_log_at < self.log_interval_s:
            return

        window_s = now - self._last_log_at
        hz = self._broadcasts / window_s if window_s > 0 else 0.0
        skip_parts = ", ".join(f"{k}={v}" for k, v in sorted(self._skips.items()))
        phase_parts: list[str] = []
        for phase in sorted(self._phase_count):
            count = self._phase_count[phase]
            if count == 0:
                continue
            avg_ms = self._phase_total_ms[phase] / count
            max_ms = self._phase_max_ms[phase]
            phase_parts.append(f"{phase}:avg={avg_ms:.1f}ms max={max_ms:.1f}ms n={count}")

        logger.info(
            "[%s] %.1fs window | telemetry=%.1f Hz (%d sent) | skips{%s} | %s | warnings=%d",
            self.name,
            window_s,
            hz,
            self._broadcasts,
            skip_parts or "none",
            " | ".join(phase_parts) or "no phases",
            self._warnings,
        )

        self._last_log_at = now
        self._broadcasts = 0
        self._skips.clear()
        self._phase_total_ms.clear()
        self._phase_count.clear()
        self._phase_max_ms.clear()
        self._warnings = 0
