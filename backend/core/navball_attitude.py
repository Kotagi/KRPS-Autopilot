"""Navball attitude helpers aligned with KSP / kRPC surface reference frame.

kRPC ``Vessel.surface_reference_frame`` axes:
  +X zenith (up), +Y north, +Z east

KSP's navball HDG readout matches the compass heading of the vessel's bottom
(+Z in vessel frame) projected onto the local horizon — not ``Flight.heading``,
which follows the nose and becomes unstable when pointing near zenith.
"""

from __future__ import annotations

import math
from typing import Any


def _quat_rotate(q: tuple[float, float, float, float], v: tuple[float, float, float]) -> tuple[float, float, float]:
    qx, qy, qz, qw = q
    vx, vy, vz = v
    ix = qw * vx + qy * vz - qz * vy
    iy = qw * vy + qz * vx - qx * vz
    iz = qw * vz + qx * vy - qy * vx
    iw = -qx * vx - qy * vy - qz * vz
    return (
        ix * qw + iw * -qx + iy * -qz - iz * -qy,
        iy * qw + iw * -qy + iz * -qx - ix * -qz,
        iz * qw + iw * -qz + ix * -qy - iy * -qx,
    )


def heading_from_surface_rotation(
    rotation: tuple[float, float, float, float],
    fallback_heading_deg: float = 0.0,
) -> float:
    """Compass heading in degrees [0, 360), matching the in-game navball HDG."""
    q = rotation
    _zenith, north, east = _quat_rotate(q, (0.0, 0.0, 1.0))
    if abs(north) < 1e-9 and abs(east) < 1e-9:
        return fallback_heading_deg % 360.0
    heading = math.degrees(math.atan2(east, north))
    return heading % 360.0


def navball_heading_deg(flight_heading_deg: float) -> float:
    """Match KSP navball HDG readout: ``Flight.heading`` (nose on the horizon)."""
    return flight_heading_deg % 360.0


def compute_navball_heading(vessel: Any) -> float:
    """Compass heading via a one-off kRPC read (prefer navball streams in telemetry)."""
    flight = vessel.flight(vessel.surface_reference_frame)
    return navball_heading_deg(float(flight.heading))


def read_surface_rotation(vessel: Any) -> tuple[float, float, float, float]:
    """Vessel attitude quaternion in surface reference frame (x, y, z, w)."""
    rotation = vessel.rotation(vessel.surface_reference_frame)
    return tuple(float(v) for v in rotation)
