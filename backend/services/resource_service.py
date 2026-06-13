from collections import defaultdict
from typing import Any

from backend.core.connection import GameConnection, game_connection
from backend.models.resources import StageFuel, StageFuelSnapshot

FUEL_RESOURCES = ("LiquidFuel", "Oxidizer", "SolidFuel", "Monopropellant")


def _decouple_band(part: Any) -> int:
    """Decoupler staging band for a part (uses part.decouple_stage when set)."""
    stage = int(getattr(part, "decouple_stage", -1))
    if stage >= 0:
        return stage

    current = part
    while current is not None:
        if getattr(current, "decoupler", None) is not None:
            decouple_stage = int(getattr(current, "decouple_stage", -1))
            if decouple_stage >= 0:
                return decouple_stage
        current = current.parent
    return -1


def _position_key(part: Any, vessel: Any) -> tuple[float, float, float]:
    try:
        position = part.position(vessel.reference_frame)
        return (
            round(float(position[0]), 1),
            round(float(position[1]), 1),
            round(float(position[2]), 1),
        )
    except Exception:
        return (0.0, 0.0, 0.0)


def _stable_group_id(part: Any, vessel: Any) -> str:
    """Stable identity for a fuel stack that does not flicker across kRPC reads."""
    decouple_band = _decouple_band(part)
    if decouple_band >= 0:
        return f"dec:{decouple_band}"

    x, y, z = _position_key(part, vessel)
    return f"pos:{x}:{y}:{z}"


def _part_fuel(part: Any) -> tuple[float, float]:
    amount = 0.0
    capacity = 0.0
    try:
        resources = part.resources
    except Exception:
        return amount, capacity

    for name in FUEL_RESOURCES:
        if name not in resources.names:
            continue
        max_amount = float(resources.max(name))
        if max_amount <= 0:
            continue
        amount += float(resources.amount(name))
        capacity += max_amount
    return amount, capacity


def _engine_stage_by_decouple(engines: list[Any]) -> dict[int, int]:
    stages: dict[int, int] = {}
    for engine in engines:
        decouple_band = int(engine.part.decouple_stage)
        if decouple_band < 0:
            continue
        stage_number = int(engine.part.stage)
        stages[decouple_band] = max(stages.get(decouple_band, -1), stage_number)
    return stages


def _engine_stage_by_position(
    fuel_parts: list[Any], vessel: Any, engines: list[Any]
) -> dict[str, int]:
    twitch_stages = sorted(
        {
            int(engine.part.stage)
            for engine in engines
            if int(engine.part.decouple_stage) < 0
        }
    )
    if not twitch_stages:
        return {}

    ranked_parts = sorted(
        fuel_parts,
        key=lambda part: _position_key(part, vessel)[1],
    )
    labels: dict[str, int] = {}
    for index, part in enumerate(ranked_parts):
        group_id = _stable_group_id(part, vessel)
        stage_number = twitch_stages[min(index, len(twitch_stages) - 1)]
        labels[group_id] = stage_number
    return labels


def _stage_label(stage_number: int) -> str:
    if stage_number >= 0:
        return f"S{stage_number}"
    return "AUX"


def _is_group_active(group_id: str, stage_number: int, engines: list[Any]) -> bool:
    if group_id.startswith("dec:"):
        decouple_band = int(group_id.split(":", 1)[1])
        return any(
            int(engine.part.decouple_stage) == decouple_band and bool(engine.active)
            for engine in engines
        )

    active_stages = {int(engine.part.stage) for engine in engines if engine.active}
    return stage_number in active_stages


class ResourceService:
    def __init__(self, game: GameConnection = game_connection) -> None:
        self._game = game

    def get_stage_fuels(self) -> StageFuelSnapshot:
        self._game.require_flight()
        vessel = self._game.active_vessel()
        parts = vessel.parts
        current_stage = int(vessel.control.current_stage)
        engines = list(parts.engines)

        fuel_parts = [
            part
            for part in parts.all
            if _part_fuel(part)[1] > 0
        ]

        radial_fuel_parts = [
            part for part in fuel_parts if _decouple_band(part) < 0
        ]

        decouple_stage_numbers = _engine_stage_by_decouple(engines)
        position_stage_numbers = _engine_stage_by_position(
            radial_fuel_parts, vessel, engines
        )

        fuel_by_group: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])

        for part in fuel_parts:
            amount, capacity = _part_fuel(part)
            group_id = _stable_group_id(part, vessel)
            fuel_by_group[group_id][0] += amount
            fuel_by_group[group_id][1] += capacity

        stages: list[StageFuel] = []

        for group_id, totals in fuel_by_group.items():
            amount, capacity = totals
            if capacity <= 0:
                continue

            if group_id.startswith("dec:"):
                decouple_band = int(group_id.split(":", 1)[1])
                stage_number = decouple_stage_numbers.get(decouple_band, decouple_band)
            else:
                stage_number = position_stage_numbers.get(group_id, -1)

            label = _stage_label(stage_number)
            percent = max(0.0, min(100.0, (amount / capacity) * 100.0))
            is_active = _is_group_active(group_id, stage_number, engines)
            has_engine = stage_number >= 0 or group_id.startswith("dec:")

            stages.append(
                StageFuel(
                    group_id=group_id,
                    stage_number=stage_number,
                    label=label,
                    percent=percent,
                    fuel_remaining=amount,
                    fuel_capacity=capacity,
                    is_active=is_active,
                    has_engine=has_engine,
                )
            )

        stages.sort(key=lambda item: item.stage_number, reverse=True)

        return StageFuelSnapshot(
            vessel_name=str(vessel.name),
            current_stage=current_stage,
            stages=stages,
        )


resource_service = ResourceService()
