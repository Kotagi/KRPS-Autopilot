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


def compute_navball_heading(vessel: Any) -> float:
    """Compass heading in degrees [0, 360), matching the in-game navball HDG."""
    rotation = vessel.rotation(vessel.surface_reference_frame)
    q = tuple(float(v) for v in rotation)
    # Vessel +Z (bottom) projected onto the Y–Z horizon plane.
    _zenith, north, east = _quat_rotate(q, (0.0, 0.0, 1.0))
    if abs(north) < 1e-9 and abs(east) < 1e-9:
        return float(vessel.flight().heading)
    heading = math.degrees(math.atan2(east, north))
    return heading % 360.0


def read_surface_rotation(vessel: Any) -> tuple[float, float, float, float]:
    """Vessel attitude quaternion in surface reference frame (x, y, z, w)."""
    rotation = vessel.rotation(vessel.surface_reference_frame)
    return tuple(float(v) for v in rotation)
