"""Unit conversions between MechJeb internal values and UI-friendly units.

MechJeb stores most altitude and pressure targets in EditableDoubleMult with a
multiplier of 1000. kRPC exposes the internal stored value (meters / Pascals),
while the in-game UI shows kilometres / kilopascals.
"""


def altitude_m_to_km(value_m: float) -> float:
    return altitude_km_from_krpc(value_m)


def altitude_km_from_krpc(raw: float) -> float:
    """Convert a MechJeb/kRPC altitude to kilometres.

    MechJeb normally stores altitudes as metres (e.g. 250 km → 250_000), but
    values below 10_000 are treated as already being in kilometres. That covers
    corrupted or legacy writes that stored ``250`` instead of ``250_000``.
    """
    raw = float(raw)
    if abs(raw) < 10_000:
        return raw
    return raw / 1000.0


def altitude_km_to_m(value_km: float) -> float:
    return float(value_km) * 1000.0


def pressure_pa_to_kpa(value_pa: float) -> float:
    return float(value_pa) / 1000.0


def pressure_kpa_to_pa(value_kpa: float) -> float:
    return float(value_kpa) * 1000.0


def turn_shape_from_mechjeb(raw: float) -> float:
    # EditableDoubleMult(…, 0.01): UI percent = internal / 0.01
    return float(raw) / 0.01


def turn_shape_to_mechjeb(percent: float) -> float:
    return float(percent) * 0.01


def pvg_target_apo_km(peri_km: float, apo_raw: float) -> float:
    """Match MechJeb PVG targeting rules for displayed apoapsis."""
    apo_km = altitude_km_from_krpc(apo_raw)
    if apo_raw <= 0 or apo_km < peri_km:
        return peri_km
    # Circular/equal targets: MechJeb UI shows peri when apo is unset or matched.
    if abs(apo_km - peri_km) < 0.05:
        return peri_km
    return apo_km
