"""Strict unit conversions for native kRPC values (always SI metres)."""

from __future__ import annotations

import math
from typing import Any


def krpc_m_to_km(value_m: float) -> float:
    return float(value_m) / 1000.0


def krpc_km_to_m(value_km: float) -> float:
    return float(value_km) * 1000.0


def read_orbit_pe_altitude_m(orbit: Any) -> float:
    """Read periapsis altitude above the body's surface in metres.

    kRPC reports ``periapsis_altitude`` in metres. Cross-check against
    ``periapsis - equatorial_radius`` and correct common km/m mismatches.
    """
    try:
        reported = float(orbit.periapsis_altitude)
        body_radius = float(orbit.body.equatorial_radius)
        derived = float(orbit.periapsis) - body_radius
    except Exception:
        return 0.0

    if not math.isfinite(reported) and math.isfinite(derived):
        return derived
    if not math.isfinite(derived):
        return reported
    if not math.isfinite(reported):
        return derived

    if derived <= 0:
        return reported if reported > 0 else derived

    if reported <= 0:
        return derived

    ratio = reported / derived
    if ratio < 0.05:
        return reported * 1000.0
    if ratio > 20.0:
        return reported / 1000.0

    if abs(reported - derived) / max(abs(derived), 1.0) < 0.02:
        return reported

    return derived


STAR_BODY_NAMES = frozenset({"sun", "kerbol"})


def is_star_like_body(body: Any) -> bool:
    if bool(getattr(body, "is_star", False)):
        return True
    return str(body.name).lower().strip() in STAR_BODY_NAMES


def body_names_match(candidate: str, target: str) -> bool:
    a = candidate.lower().strip().replace(" ", "")
    b = target.lower().strip().replace(" ", "")
    if not a or not b:
        return False
    return a == b or a in b or b in a
