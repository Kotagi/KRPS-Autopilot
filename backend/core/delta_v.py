"""Stage and total delta-v estimates from MechJeb (preferred) or kRPC staging data."""

from __future__ import annotations

import math
from typing import Any

from backend.core.connection import GameConnection

G0 = 9.80665


def _stage_isp_vac(vessel: Any, stage: int) -> float:
    thrust_sum = 0.0
    isp_sum = 0.0
    try:
        parts = vessel.parts.in_decouple_stage(stage)
    except Exception:
        return 0.0

    for part in parts:
        try:
            engine = part.engine
        except Exception:
            continue
        if engine is None:
            continue
        try:
            thrust = float(engine.max_vacuum_thrust)
            isp = float(engine.vacuum_specific_impulse)
        except Exception:
            continue
        if thrust <= 0 or isp <= 0:
            continue
        thrust_sum += thrust
        isp_sum += isp * thrust

    if thrust_sum <= 0:
        return 0.0
    return isp_sum / thrust_sum


def _stage_masses(vessel: Any, stage: int) -> tuple[float, float]:
    try:
        parts = vessel.parts.in_decouple_stage(stage)
    except Exception:
        return 0.0, 0.0

    wet = 0.0
    dry = 0.0
    for part in parts:
        try:
            wet += float(part.mass)
            dry += float(part.dry_mass)
        except Exception:
            continue
    return wet, dry


def _stage_delta_v(vessel: Any, stage: int) -> float:
    wet, dry = _stage_masses(vessel, stage)
    if wet <= dry or wet <= 0:
        return 0.0

    isp = _stage_isp_vac(vessel, stage)
    if isp <= 0:
        try:
            isp = float(vessel.vacuum_specific_impulse)
        except Exception:
            return 0.0
    if isp <= 0:
        return 0.0

    return isp * G0 * math.log(wet / dry)


def _read_mechjeb_delta_v(game: GameConnection | None) -> dict[str, float | int] | None:
    if game is None:
        return None

    try:
        bridge = getattr(game.conn, "kprs_autopilot", None)
    except Exception:
        return None

    if bridge is None:
        return None

    try:
        if not bridge.available:
            return None
        vessel = game.active_vessel()
        current_stage = int(vessel.control.current_stage)
        return {
            "current_stage": current_stage,
            "stage_vac_ms": float(bridge.stage_delta_v_vacuum_ms),
            "total_vac_ms": float(bridge.total_delta_v_vacuum_ms),
            "surface_twr": float(bridge.surface_twr),
        }
    except Exception:
        return None


def read_vessel_delta_v(
    vessel: Any, game: GameConnection | None = None
) -> dict[str, float | int]:
    """Return total and current-stage delta-v estimates in m/s."""
    mechjeb = _read_mechjeb_delta_v(game)
    if mechjeb is not None:
        return mechjeb

    try:
        current_stage = int(vessel.control.current_stage)
    except Exception:
        current_stage = 0

    stage_dvs: list[float] = []
    for stage in range(current_stage, 0, -1):
        dv = _stage_delta_v(vessel, stage)
        if dv > 0:
            stage_dvs.append(dv)

    total_vac = sum(stage_dvs)
    stage_vac = stage_dvs[0] if stage_dvs else 0.0

    try:
        mass = float(vessel.mass)
        thrust = float(vessel.available_thrust)
        surface_twr = thrust / (mass * G0) if mass > 0 else 0.0
    except Exception:
        surface_twr = 0.0

    return {
        "current_stage": current_stage,
        "stage_vac_ms": stage_vac,
        "total_vac_ms": total_vac,
        "surface_twr": surface_twr,
    }
