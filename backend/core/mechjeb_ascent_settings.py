"""Read/write MechJeb 2.14 ascent targets via KPRS.AutopilotBridge when available."""

from typing import Any, Literal

from backend.core.connection import GameConnection
from backend.core.mechjeb_units import pvg_target_apo_km
from backend.models.ascent import AscentPath

MECHJEB_ASCENT_TYPE: dict[AscentPath, int] = {"classic": 0, "gt": 1, "pvg": 1}
BRIDGE_ASCENT_TYPE: dict[int, AscentPath] = {0: "classic", 1: "pvg"}


def bridge_available(game: GameConnection) -> bool:
    bridge = _bridge_service(game)
    if bridge is None:
        return False
    try:
        return bool(bridge.available)
    except Exception:
        return False


def read_pvg_targets_km(game: GameConnection) -> tuple[float, float] | None:
    """Return (peri_km, apo_km) from MechJeb AscentSettings, or None if unavailable."""
    bridge = _bridge_service(game)
    if bridge is None:
        return None
    try:
        if not bridge.available:
            return None
        peri_km = float(bridge.target_periapsis_km)
        apo_km = float(bridge.target_apoapsis_km)
        return peri_km, apo_km
    except Exception:
        return None


def write_pvg_targets_km(game: GameConnection, peri_km: float, apo_km: float) -> bool:
    bridge = _bridge_service(game)
    if bridge is None:
        return False
    try:
        if not bridge.available:
            return False
        bridge.target_periapsis_km = float(peri_km)
        bridge.target_apoapsis_km = float(apo_km)
        return True
    except Exception:
        return False


def read_ascent_path(game: GameConnection) -> AscentPath | None:
    bridge = _bridge_service(game)
    if bridge is None:
        return None
    try:
        if not bridge.available:
            return None
        ascent_type = int(bridge.ascent_type)
        return BRIDGE_ASCENT_TYPE.get(ascent_type, "pvg")
    except Exception:
        return None


def write_ascent_path(game: GameConnection, path: AscentPath) -> bool:
    bridge = _bridge_service(game)
    if bridge is None:
        return False
    try:
        if not bridge.available:
            return False
        bridge.ascent_type = MECHJEB_ASCENT_TYPE.get(path, 1)
        return True
    except Exception:
        return False


def legacy_pvg_targets_km(game: GameConnection) -> tuple[float, float]:
    from backend.core.mechjeb_units import altitude_m_to_km

    ascent = game.mechjeb.ascent_autopilot
    pvg = ascent.ascent_path_pvg
    peri_km = altitude_m_to_km(float(ascent.desired_orbit_altitude))
    apo_km = pvg_target_apo_km(peri_km, float(pvg.desired_apoapsis))
    return peri_km, apo_km


def _bridge_service(game: GameConnection) -> Any | None:
    try:
        return getattr(game.conn, "kprs_autopilot", None)
    except Exception:
        return None
